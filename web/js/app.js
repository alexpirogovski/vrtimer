const prepSelect = document.getElementById("prep-select");
const workoutSelect = document.getElementById("workout-select");
const breakSelect = document.getElementById("break-select");
const addButton = document.getElementById("add-button");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const stopButton = document.getElementById("stop-button");
const timersList = document.getElementById("timers");
const limitMessage = document.getElementById("limit-message");
const statusMessage = document.getElementById("status-message");
const countdownDisplay = document.getElementById("countdown");

const MAX_TIMERS = 10;
const PREP_OPTIONS = [1, 2, 3, 4, 5];
const WORKOUT_OPTIONS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const BREAK_OPTIONS = [1, 2, 3, 4, 5];

let timers = [];
let isRunning = false;
let isPaused = false;
let activeIndex = 0;
let currentPhase = "idle"; // idle | prep | workout | break
let countdownInterval = null;
let remainingSeconds = 0;
let countdownTotalSeconds = 0;
let countdownOnComplete = null;
let timerSpeedMultiplier = 1;
let pauseReminderInterval = null;
let pendingPhaseAdvance = false;
let workoutAnnouncementMinutes = new Set();

function populateSelect(selectEl, values, defaultValue) {
  const fragment = document.createDocumentFragment();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = `${value} minute${value === 1 ? "" : "s"}`;
    if (value === defaultValue) {
      option.selected = true;
    }
    fragment.appendChild(option);
  });
  selectEl.appendChild(fragment);
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    console.log(text);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = navigator.language || "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function updateLimitMessage() {
  if (timers.length >= MAX_TIMERS) {
    limitMessage.textContent = "Timer limit reached. Start your workout or remove an entry.";
  } else {
    limitMessage.textContent = "";
  }
}

function renderTimers() {
  timersList.innerHTML = "";

  timers.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "timer-item";

    const info = document.createElement("div");
    info.className = "timer-item__info";
    info.textContent = `Workout ${item.workout} min • Break ${item.break} min`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "timer-item__remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      if (isRunning) {
        return;
      }
      timers.splice(index, 1);
      renderTimers();
      updateControls();
    });

    li.appendChild(info);
    li.appendChild(removeButton);
    timersList.appendChild(li);
  });

  updateLimitMessage();
}

function addTimer() {
  if (timers.length >= MAX_TIMERS) {
    updateLimitMessage();
    return;
  }

  const workoutMinutes = Number(workoutSelect.value);
  const breakMinutes = Number(breakSelect.value);

  timers.push({ workout: workoutMinutes, break: breakMinutes });
  renderTimers();
  updateControls();
}

function updateControls() {
  const hasTimers = timers.length > 0;
  startButton.disabled = !hasTimers || isRunning;
  stopButton.disabled = !isRunning;
  pauseButton.disabled = !isRunning;
  pauseButton.textContent = isPaused ? "Resume" : "Pause";
  addButton.disabled = isRunning || timers.length >= MAX_TIMERS;

  const selectsDisabled = isRunning;
  prepSelect.disabled = selectsDisabled;
  workoutSelect.disabled = selectsDisabled;
  breakSelect.disabled = selectsDisabled;
}

function clearPauseReminders() {
  if (pauseReminderInterval) {
    clearInterval(pauseReminderInterval);
    pauseReminderInterval = null;
  }
}

function startPauseReminders() {
  clearPauseReminders();
  speak("Paused. Shall we continue?");
  pauseReminderInterval = setInterval(() => {
    speak("Paused. Shall we continue?");
  }, 60_000);
}

function resetState({ preserveStatusMessage = false, cancelSpeech = true } = {}) {
  isRunning = false;
  isPaused = false;
  activeIndex = 0;
  currentPhase = "idle";
  clearInterval(countdownInterval);
  countdownInterval = null;
  remainingSeconds = 0;
  countdownTotalSeconds = 0;
  countdownOnComplete = null;
  pendingPhaseAdvance = false;
  workoutAnnouncementMinutes = new Set();
  clearPauseReminders();
  countdownDisplay.textContent = "--:--";
  if (!preserveStatusMessage) {
    statusMessage.textContent = timers.length
      ? "Ready when you are."
      : "Add timers to build your workout.";
  }
  if (cancelSpeech && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  updateControls();
}

async function loadTimerSettings() {
  try {
    const response = await fetch("config.json", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const multiplier = Number(data.timerSpeedMultiplier);
    if (Number.isFinite(multiplier) && multiplier > 0) {
      timerSpeedMultiplier = multiplier;
    }
  } catch (error) {
    console.error("Failed to load timer settings", error);
  }
}

function formatTime(secondsRemaining) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function handleWorkoutAnnouncements(displaySeconds) {
  const totalMinutes = Math.ceil(countdownTotalSeconds / 60);
  const remainingMinutes = Math.ceil(displaySeconds / 60);
  if (
    remainingMinutes > 0 &&
    remainingMinutes % 5 === 0 &&
    remainingMinutes !== totalMinutes &&
    !workoutAnnouncementMinutes.has(remainingMinutes)
  ) {
    workoutAnnouncementMinutes.add(remainingMinutes);
    speak(`${remainingMinutes} minutes left.`);
  }
}

function startCountdown(durationSeconds, phase, onComplete, options = {}) {
  const speed = timerSpeedMultiplier > 0 ? timerSpeedMultiplier : 1;
  remainingSeconds = durationSeconds;
  countdownOnComplete = onComplete;
  if (!options.resume) {
    countdownTotalSeconds = options.totalSeconds ?? durationSeconds;
    if (phase === "workout") {
      workoutAnnouncementMinutes = new Set();
    }
    pendingPhaseAdvance = false;
  }
  countdownDisplay.textContent = formatTime(Math.ceil(remainingSeconds));

  clearInterval(countdownInterval);
  const nowFn =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();
  let previousTimestamp = nowFn();
  countdownInterval = setInterval(() => {
    const now = nowFn();
    const deltaSeconds = ((now - previousTimestamp) / 1000) * speed;
    previousTimestamp = now;
    remainingSeconds = Math.max(0, remainingSeconds - deltaSeconds);
    const displaySeconds = Math.ceil(remainingSeconds);
    countdownDisplay.textContent = formatTime(displaySeconds);
    if (phase === "workout") {
      handleWorkoutAnnouncements(displaySeconds);
    }
    if (remainingSeconds <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownDisplay.textContent = formatTime(0);
      onComplete();
    }
  }, Math.max(100, 200 / speed));
}

function completeWorkout() {
  speak("Workout done. Good job!");
  statusMessage.textContent = "Workout complete. Great job!";
  resetState({ preserveStatusMessage: true, cancelSpeech: false });
}

function handlePhaseCompletion() {
  isPaused = false;
  pendingPhaseAdvance = false;
  clearPauseReminders();
  const currentTimer = timers[activeIndex];

  if (currentPhase === "prep") {
    beginTimer();
    return;
  }

  if (currentPhase === "workout") {
    const isLastInterval = activeIndex === timers.length - 1;
    if (isLastInterval) {
      completeWorkout();
      return;
    }

    speak(`${currentTimer.workout} minutes passed, resting for ${currentTimer.break} minute${
      currentTimer.break === 1 ? "" : "s"
    }.`);
    currentPhase = "break";
    statusMessage.textContent = `Rest for ${currentTimer.break} minute${
      currentTimer.break === 1 ? "" : "s"
    }.`;
    startCountdown(currentTimer.break * 60, "break", handlePhaseCompletion);
  } else if (currentPhase === "break") {
    activeIndex += 1;
    if (activeIndex >= timers.length) {
      completeWorkout();
    } else {
      beginTimer();
    }
  }
}

function beginTimer() {
  const currentTimer = timers[activeIndex];
  currentPhase = "workout";
  const workoutText = `${currentTimer.workout} minute${currentTimer.workout === 1 ? "" : "s"}`;
  statusMessage.textContent = `Workout for ${workoutText}.`;
  speak(`Starting workout for ${workoutText}.`);
  startCountdown(currentTimer.workout * 60, "workout", handlePhaseCompletion, {
    totalSeconds: currentTimer.workout * 60,
  });
}

function startSession() {
  if (isRunning || timers.length === 0) {
    return;
  }
  isRunning = true;
  isPaused = false;
  activeIndex = 0;
  currentPhase = "idle";
  clearPauseReminders();
  updateControls();
  const prepMinutes = Number(prepSelect.value);
  if (prepMinutes > 0) {
    currentPhase = "prep";
    const prepText = `${prepMinutes} minute${prepMinutes === 1 ? "" : "s"}`;
    statusMessage.textContent = `Prep for ${prepText}.`;
    speak(`Get ready. Workout starts in ${prepText}.`);
    startCountdown(prepMinutes * 60, "prep", handlePhaseCompletion);
  } else {
    beginTimer();
  }
}

function stopSession() {
  if (!isRunning) {
    return;
  }
  clearPauseReminders();
  resetState();
  statusMessage.textContent = "Session stopped.";
}

function pauseSession() {
  if (!isRunning) {
    return;
  }

  if (isPaused) {
    resumeSession();
    return;
  }

  if (currentPhase === "workout") {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownDisplay.textContent = formatTime(Math.ceil(remainingSeconds));
    isPaused = true;
    pendingPhaseAdvance = false;
    statusMessage.textContent = "Workout paused.";
    startPauseReminders();
  } else if (currentPhase === "prep" || currentPhase === "break") {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    remainingSeconds = 0;
    countdownDisplay.textContent = formatTime(0);
    isPaused = true;
    pendingPhaseAdvance = true;
    const phaseLabel = currentPhase === "prep" ? "Prep" : "Break";
    statusMessage.textContent = `${phaseLabel} paused. Ready to resume.`;
    startPauseReminders();
  } else {
    return;
  }

  updateControls();
}

function resumeSession() {
  if (!isRunning || !isPaused) {
    return;
  }

  isPaused = false;
  clearPauseReminders();

  if (pendingPhaseAdvance) {
    pendingPhaseAdvance = false;
    if (typeof countdownOnComplete === "function") {
      countdownOnComplete();
    }
    updateControls();
    return;
  }

  if (currentPhase === "workout") {
    startCountdown(remainingSeconds, currentPhase, countdownOnComplete, {
      resume: true,
    });
    speak("Resuming workout.");
  }

  updateControls();
}

async function init() {
  await loadTimerSettings();
  populateSelect(prepSelect, PREP_OPTIONS, 1);
  populateSelect(workoutSelect, WORKOUT_OPTIONS, 30);
  populateSelect(breakSelect, BREAK_OPTIONS, 1);
  renderTimers();
  updateControls();

  addButton.addEventListener("click", addTimer);
  startButton.addEventListener("click", startSession);
  pauseButton.addEventListener("click", pauseSession);
  stopButton.addEventListener("click", stopSession);
}

window.addEventListener("DOMContentLoaded", init);
