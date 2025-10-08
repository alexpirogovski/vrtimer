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
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    host, port = run_server(port=args.port)
    print(f"Server available at http://{host if host != '0.0.0.0' else 'localhost'}:{port}")


if __name__ == "__main__":
    main()
