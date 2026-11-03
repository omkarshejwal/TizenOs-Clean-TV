#!/usr/bin/env python3
"""Start a local HTTP server for CleanHome preview at http://localhost:8080."""

import http.server
import socketserver
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PORT = 8080


class CleanHomeHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler with custom MIME types and directory routing."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_ROOT, **kwargs)

    def end_headers(self):
        # Enable CORS and disable caching during preview
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".svg"):
            return "image/svg+xml"
        if path.endswith(".ttf"):
            return "font/ttf"
        if path.endswith(".json"):
            return "application/json"
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Keep server log clean unless error
        if len(args) > 1 and str(args[1]).startswith("4"):
            super().log_message(format, *args)


def main():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CleanHomeHandler) as httpd:
            print(f"CleanHome preview server running on port {PORT}")
            print(f"Serving from: {PROJECT_ROOT}")
            print(f"Open URL: http://localhost:{PORT}/index.html")
            sys.stdout.flush()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nPreview server stopped.")


if __name__ == "__main__":
    main()

