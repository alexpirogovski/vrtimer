"""HTTP server for the VR timer application."""

from __future__ import annotations

import contextlib
import http.server
import os
import socket
import socketserver
from pathlib import Path
from typing import Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PROJECT_ROOT / "web"


class VRTimerRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Request handler that serves files from the web directory."""

    def __init__(self, *args, **kwargs) -> None:
        directory = kwargs.pop("directory", str(WEB_ROOT))
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003 - match base class signature
        """Reduce default logging noise while keeping useful information."""
        client_ip, _ = self.client_address
        message = f"{self.log_date_time_string()} - {client_ip} - {format % args}"
        print(message)

    def do_GET(self) -> None:  # noqa: N802 - required by base class
        if self.path in {"", "/", "/index", "/index.html"}:
            self.path = "index.html"
        super().do_GET()


def _get_free_port(port: int) -> Tuple[str, int]:
    host = os.environ.get("VR_TIMER_HOST", "0.0.0.0")
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        try:
            sock.bind((host, port))
        except OSError:
            port = 0
            sock.bind((host, port))
        host, port = sock.getsockname()
    return host, port


def run_server(port: int = 5000) -> Tuple[str, int]:
    """Start the HTTP server and keep it running until interrupted."""

    host, resolved_port = _get_free_port(port)
    handler_factory = lambda *args, **kwargs: VRTimerRequestHandler(*args, directory=str(WEB_ROOT), **kwargs)

    class ThreadingTCPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    with ThreadingTCPServer((host, resolved_port), handler_factory) as httpd:
        scheme_host = "localhost" if host == "0.0.0.0" else host
        print(f"Serving VR timer on http://{scheme_host}:{resolved_port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

    return host, resolved_port


__all__ = ["run_server"]
