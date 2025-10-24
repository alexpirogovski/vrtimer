const prepSelect = document.getElementById("prep-select");
const workoutSelect = document.getElementById("workout-select");
const breakSelect = document.getElementById("break-select");
const addButton = document.getElementById("add-button");
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");
const timersList = document.getElementById("timers");
const limitMessage = document.getElementById("limit-message");
const statusMessage = document.getElementById("status-message");
const countdownDisplay = document.getElementById("countdown");

const MAX_TIMERS = 10;
const PREP_OPTIONS = [1, 2, 3, 4, 5];
const WORKOUT_OPTIONS = [1, 5, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const BREAK_OPTIONS = [1, 2, 3, 4, 5];

let timers = [];
let isRunning = false;
let activeIndex = 0;
let currentPhase = "idle"; // idle | prep | workout | break
let countdownInterval = null;
let countdownEnd = 0;
let timerSpeedMultiplier = 1;

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
  addButton.disabled = isRunning || timers.length >= MAX_TIMERS;

  const selectsDisabled = isRunning;
  prepSelect.disabled = selectsDisabled;
  workoutSelect.disabled = selectsDisabled;
  breakSelect.disabled = selectsDisabled;
}

function resetState({ preserveStatusMessage = false, cancelSpeech = true } = {}) {
  isRunning = false;
  activeIndex = 0;
  currentPhase = "idle";
  clearInterval(countdownInterval);
  countdownInterval = null;
  countdownEnd = 0;
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

function startCountdown(durationSeconds, onComplete) {
  const speed = timerSpeedMultiplier > 0 ? timerSpeedMultiplier : 1;
  const start = Date.now();
  const totalDurationMs = durationSeconds * 1000;
  const runtimeMs = totalDurationMs / speed;
  countdownEnd = start + runtimeMs;
  countdownDisplay.textContent = formatTime(durationSeconds);

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const now = Date.now();
    const elapsedRealMs = now - start;
    const elapsedTimerMs = elapsedRealMs * speed;
    const remainingTimerMs = Math.max(0, totalDurationMs - elapsedTimerMs);
    const remainingSeconds = Math.max(0, Math.round(remainingTimerMs / 1000));
    countdownDisplay.textContent = formatTime(remainingSeconds);
    if (elapsedTimerMs >= totalDurationMs) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      onComplete();
    }
  }, Math.max(50, 200 / speed));
}

function completeWorkout() {
  speak("Workout done. Good job!");
  statusMessage.textContent = "Workout complete. Great job!";
  resetState({ preserveStatusMessage: true, cancelSpeech: false });
}

function completeWorkout() {
  speak("Workout done. Good job!");
  statusMessage.textContent = "Workout complete. Great job!";
  resetState({ preserveStatusMessage: true, cancelSpeech: false });
}

function handlePhaseCompletion() {
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
    startCountdown(currentTimer.break * 60, handlePhaseCompletion);
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
  startCountdown(currentTimer.workout * 60, handlePhaseCompletion);
}

function startSession() {
  if (isRunning || timers.length === 0) {
    return;
  }
  isRunning = true;
  activeIndex = 0;
  currentPhase = "idle";
  updateControls();
  const prepMinutes = Number(prepSelect.value);
  if (prepMinutes > 0) {
    currentPhase = "prep";
    const prepText = `${prepMinutes} minute${prepMinutes === 1 ? "" : "s"}`;
    statusMessage.textContent = `Prep for ${prepText}.`;
    speak(`Get ready. Workout starts in ${prepText}.`);
    startCountdown(prepMinutes * 60, handlePhaseCompletion);
  } else {
    beginTimer();
  }
}

function stopSession() {
  if (!isRunning) {
    return;
  }
  resetState();
  statusMessage.textContent = "Session stopped.";
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
  stopButton.addEventListener("click", stopSession);
}

window.addEventListener("DOMContentLoaded", init);
