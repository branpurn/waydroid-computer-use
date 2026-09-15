#!/usr/bin/env python3
"""Minimal Waydroid computer-use control HTTP API (ADB-backed).

Env:
  CONTROL_HOST   bind address (default 0.0.0.0)
  CONTROL_PORT   port (default 8765)
  ADB            adb binary (default adb)
  ADB_SERIAL     optional serial for `adb -s`
  CONTROL_CORS   origin for CORS (default *)
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.environ.get("CONTROL_HOST", "0.0.0.0")
PORT = int(os.environ.get("CONTROL_PORT", "8765"))
ADB = os.environ.get("ADB", "adb")
SERIAL = os.environ.get("ADB_SERIAL", "").strip()
CORS = os.environ.get("CONTROL_CORS", "*")

ACTIONS = [
    {"op": "screenshot"},
    {"op": "tap", "x": 0, "y": 0},
    {"op": "swipe", "x1": 0, "y1": 0, "x2": 0, "y2": 0, "duration_ms": 300},
    {"op": "type", "text": ""},
    {"op": "keyevent", "code": 0},
]


def adb_cmd(*args: str) -> list[str]:
    cmd = [ADB]
    if SERIAL:
        cmd.extend(["-s", SERIAL])
    cmd.extend(args)
    return cmd


def run(cmd: list[str], *, input_bytes: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, input=input_bytes, capture_output=True, check=check)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        print(f"[control] {self.address_string()} {fmt % args}", file=sys_stderr)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", CORS)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _bytes(self, code: int, data: bytes, content_type: str) -> None:
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            try:
                p = run(adb_cmd("get-state"), check=False)
                state = (p.stdout or b"").decode().strip() or (p.stderr or b"").decode().strip()
                ok = p.returncode == 0 and state == "device"
                self._json(200 if ok else 503, {"ok": ok, "adb": state, "serial": SERIAL or None})
            except FileNotFoundError:
                self._json(503, {"ok": False, "error": "adb_not_found"})
            return
        if path == "/actions":
            self._json(200, {"actions": ACTIONS})
            return
        if path == "/frame":
            try:
                p = run(adb_cmd("exec-out", "screencap", "-p"), check=False)
                if p.returncode != 0 or not p.stdout.startswith(b"\x89PNG"):
                    err = (p.stderr or b"").decode()[:500]
                    self._json(502, {"ok": False, "error": "screencap_failed", "detail": err})
                    return
                self._bytes(200, p.stdout, "image/png")
            except FileNotFoundError:
                self._json(503, {"ok": False, "error": "adb_not_found"})
            return
        self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/action":
            self._json(404, {"ok": False, "error": "not_found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid_json"})
            return
        op = body.get("op")
        try:
            if op == "screenshot":
                # Convenience: same as GET /frame but JSON ack + optional side effect none
                p = run(adb_cmd("exec-out", "screencap", "-p"), check=False)
                ok = p.returncode == 0 and p.stdout.startswith(b"\x89PNG")
                self._json(200 if ok else 502, {"ok": ok, "bytes": len(p.stdout) if ok else 0})
                return
            if op == "tap":
                x, y = int(body["x"]), int(body["y"])
                run(adb_cmd("shell", "input", "tap", str(x), str(y)))
                self._json(200, {"ok": True, "op": "tap", "x": x, "y": y})
                return
            if op == "swipe":
                x1, y1, x2, y2 = int(body["x1"]), int(body["y1"]), int(body["x2"]), int(body["y2"])
                dur = int(body.get("duration_ms", 300))
                run(adb_cmd("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(dur)))
                self._json(200, {"ok": True, "op": "swipe"})
                return
            if op == "type":
                text = str(body["text"]).replace(" ", "%s")
                run(adb_cmd("shell", "input", "text", text))
                self._json(200, {"ok": True, "op": "type"})
                return
            if op == "keyevent":
                code = int(body["code"])
                run(adb_cmd("shell", "input", "keyevent", str(code)))
                self._json(200, {"ok": True, "op": "keyevent", "code": code})
                return
            self._json(400, {"ok": False, "error": "unknown_op", "op": op})
        except KeyError as e:
            self._json(400, {"ok": False, "error": "missing_field", "field": str(e)})
        except subprocess.CalledProcessError as e:
            self._json(502, {"ok": False, "error": "adb_failed", "detail": (e.stderr or b"").decode()[:500]})
        except FileNotFoundError:
            self._json(503, {"ok": False, "error": "adb_not_found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"control listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
