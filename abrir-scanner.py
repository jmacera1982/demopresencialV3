#!/usr/bin/env python3
"""
Numia Repo Scanner — Launcher + Proxy
Doble click para abrir el escaner en el browser.
"""

import http.server
import threading
import webbrowser
import os
import sys
import time
import socket
import json
import urllib.request
import urllib.error

PORT = 7432
HTML_FILE = "numia-repo-scanner.html"

# ─── API key solo por variable de entorno (nunca en el repo) ───
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()

def find_free_port():
    for port in range(7432, 7500):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("localhost", port))
                return port
            except OSError:
                continue
    return 7432

class Handler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # silenciar logs

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/scan":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                payload = json.loads(body)

                # Forward a Anthropic
                req = urllib.request.Request(
                    "https://api.anthropic.com/v1/messages",
                    data=json.dumps(payload).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": API_KEY,
                        "anthropic-version": "2023-06-01",
                    },
                    method="POST"
                )

                with urllib.request.urlopen(req) as resp:
                    result = resp.read()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(result)

            except urllib.error.HTTPError as e:
                error_body = e.read()
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(error_body)

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, HTML_FILE)

    if not os.path.exists(html_path):
        print(f"Error: No se encontro '{HTML_FILE}' en la misma carpeta.")
        input("\nPresiona Enter para cerrar...")
        sys.exit(1)

    if not API_KEY:
        print("Error: Definí ANTHROPIC_API_KEY en el entorno antes de ejecutar.")
        print('Ejemplo (PowerShell): $env:ANTHROPIC_API_KEY = "tu-clave"')
        input("\nPresiona Enter para cerrar...")
        sys.exit(1)

    port = find_free_port()
    url = f"http://localhost:{port}/{HTML_FILE}"

    os.chdir(script_dir)

    server = http.server.HTTPServer(("localhost", port), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()

    print("=" * 50)
    print("  Numia Repo Scanner")
    print("=" * 50)
    print(f"\n  Corriendo en: {url}")
    print("\n  Cerrá esta ventana para detener.")
    print("=" * 50)

    time.sleep(0.5)
    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.shutdown()

if __name__ == "__main__":
    main()
