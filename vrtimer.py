"""Entry point for the VR timer web application."""

from __future__ import annotations

import argparse

from core import run_server


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the VR timer web server")
    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port to bind the server to (default: 5000)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run timers in accelerated test mode (6x speed)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    multiplier = 6.0 if args.test else 1.0
    host, port = run_server(port=args.port, timer_speed_multiplier=multiplier)
    print(f"Server available at http://{host if host != '0.0.0.0' else 'localhost'}:{port}")


if __name__ == "__main__":
    main()
