"""
Jalsetu (WDMS) - Lightweight Server & API Dispatcher
Serves the responsive single-page application and canonical zone data.
Uses standard Python library (no unpinned or external heavy dependencies required).
"""
import http.server
import json
import os
import socketserver
from pathlib import Path

PORT = 8000
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_FILE = BASE_DIR / "data" / "zones_data.json"

class JalsetuHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self):
        # API Endpoint: GET /api/zones
        if self.path == "/api/zones":
            if DATA_FILE.exists():
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            else:
                self.send_error(404, "Data file not found")
            return

        # Fallback root to index.html
        if self.path in ("/", "/index", "/home"):
            self.path = "/index.html"

        return super().do_GET()

def main():
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), JalsetuHandler) as httpd:
        print(f"Jalsetu WDMS Server running at http://localhost:{PORT}")
        print("Press Ctrl+C to terminate.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()
