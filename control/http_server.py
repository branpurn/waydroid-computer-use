#!/usr/bin/env python3
"""Minimal Waydroid computer-use control HTTP API (ADB-backed).

Env:
  CONTROL_HOST        bind address (default 0.0.0.0)
  CONTROL_PORT        port (default 8765)
  ADB                 adb binary (default adb)
  ADB_SERIAL          optional serial for `adb -s`
  CONTROL_CORS        origin for CORS (default *)
  ADB_TIMEOUT         default ADB subprocess timeout seconds (default 15)
  ADB_HEALTH_TIMEOUT  timed probe for /health (default 5)
  ADB_FRAME_TIMEOUT   screencap timeout (default 20)
  WAYDROID_STATUS_CMD optional shell command whose stdout is parsed for
                      Session:/Container: lines (e.g. `waydroid status`).
                      Empty = skip (keeps control host-agnostic).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.environ.get("CONTROL_HOST", "0.0.0.0")
PORT = int(os.environ.get("CONTROL_PORT", "8765"))
ADB = os.environ.get("ADB", "adb")
SERIAL = os.environ.get("ADB_SERIAL", "").strip()
CORS = os.environ.get("CONTROL_CORS", "*")
ADB_TIMEOUT = float(os.environ.get("ADB_TIMEOUT", "15"))
ADB_HEALTH_TIMEOUT = float(os.environ.get("ADB_HEALTH_TIMEOUT", "5"))
ADB_FRAME_TIMEOUT = float(os.environ.get("ADB_FRAME_TIMEOUT", "20"))
WAYDROID_STATUS_CMD = os.environ.get("WAYDROID_STATUS_CMD", "").strip()

RECENT: deque = deque(maxlen=50)

ACTIONS = [
    {"op": "screenshot"},
    {"op": "tap", "x": 0, "y": 0},
    {"op": "swipe", "x1": 0, "y1": 0, "x2": 0, "y2": 0, "duration_ms": 300},
    {"op": "type", "text": ""},
    {"op": "keyevent", "code": 0},
]


class AdbTimeout(Exception):
    """ADB subprocess exceeded timeout."""


def adb_cmd(*args: str) -> list[str]:
    cmd = [ADB]
    if SERIAL:
        cmd.extend(["-s", SERIAL])
    cmd.extend(args)
    return cmd


def run(
    cmd: list[str],
    *,
    input_bytes: bytes | None = None,
    check: bool = True,
    timeout: float | None = None,
) -> subprocess.CompletedProcess:
    to = ADB_TIMEOUT if timeout is None else timeout
    try:
        return subprocess.run(
            cmd,
            input=input_bytes,
            capture_output=True,
            check=check,
            timeout=to,
        )
    except subprocess.TimeoutExpired as e:
        raise AdbTimeout(f"timeout after {to}s: {' '.join(cmd)}") from e


def waydroid_session_hints() -> dict:
    """Optional Session/Container lines from WAYDROID_STATUS_CMD (if set)."""
    if not WAYDROID_STATUS_CMD:
        return {}
    try:
        p = subprocess.run(
            WAYDROID_STATUS_CMD,
            shell=True,
            capture_output=True,
            timeout=3,
            check=False,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return {}
    text = (p.stdout or b"").decode(errors="replace")
    out: dict = {}
    for key, pat in (
        ("session", r"(?i)^Session:\s*(\S+)"),
        ("container", r"(?i)^Container:\s*(\S+)"),
    ):
        m = re.search(pat, text, re.M)
        if m:
            out[key] = m.group(1)
    return out


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
            hints = waydroid_session_hints()
            try:
                p = run(adb_cmd("get-state"), check=False, timeout=ADB_HEALTH_TIMEOUT)
                state = (p.stdout or b"").decode().strip() or (p.stderr or b"").decode().strip()
                if p.returncode != 0 or state != "device":
                    body = {"ok": False, "adb": state, "serial": SERIAL or None, **hints}
                    self._json(503, body)
                    return
                # Deep probe: get-state can be true while LXC is frozen and ops hang.
                try:
                    probe = run(
                        adb_cmd("shell", "echo", "ok"),
                        check=False,
                        timeout=ADB_HEALTH_TIMEOUT,
                    )
                except AdbTimeout:
                    reason = "container_frozen" if hints.get("container", "").upper() == "FROZEN" else "adb_ops_hung"
                    self._json(
                        503,
                        {
                            "ok": False,
                            "adb": state,
                            "serial": SERIAL or None,
                            "reason": reason,
                            "error": reason,
                            **hints,
                        },
                    )
                    return
                probe_out = (probe.stdout or b"").decode().strip()
                if probe.returncode != 0 or probe_out != "ok":
                    detail = (probe.stderr or b"").decode()[:200] or probe_out
                    self._json(
                        503,
                        {
                            "ok": False,
                            "adb": state,
                            "serial": SERIAL or None,
                            "reason": "adb_probe_failed",
                            "error": "adb_probe_failed",
                            "detail": detail,
                            **hints,
                        },
                    )
                    return
                if hints.get("container", "").upper() == "FROZEN":
                    # Status says frozen even if probe raced; prefer honest fail.
                    self._json(
                        503,
                        {
                            "ok": False,
                            "adb": state,
                            "serial": SERIAL or None,
                            "reason": "container_frozen",
                            "error": "container_frozen",
                            **hints,
                        },
                    )
                    return
                self._json(200, {"ok": True, "adb": state, "serial": SERIAL or None, **hints})
            except AdbTimeout:
                reason = "container_frozen" if hints.get("container", "").upper() == "FROZEN" else "adb_ops_hung"
                self._json(
                    503,
                    {
                        "ok": False,
                        "adb": "timeout",
                        "serial": SERIAL or None,
                        "reason": reason,
                        "error": reason,
                        **hints,
                    },
                )
            except FileNotFoundError:
                self._json(503, {"ok": False, "error": "adb_not_found"})
            return
        if path == "/actions":
            limit = 20
            q = urlparse(self.path).query
            for part in q.split("&"):
                if part.startswith("limit="):
                    try:
                        limit = max(1, min(50, int(part.split("=", 1)[1])))
                    except ValueError:
                        pass
            recent = list(RECENT)[-limit:]
            recent.reverse()
            self._json(200, {"actions": ACTIONS, "recent": recent})
            return
        if path == "/frame":
            try:
                p = run(adb_cmd("exec-out", "screencap", "-p"), check=False, timeout=ADB_FRAME_TIMEOUT)
                if p.returncode != 0 or not p.stdout.startswith(b"\x89PNG"):
                    err = (p.stderr or b"").decode()[:500]
                    self._json(502, {"ok": False, "error": "screencap_failed", "detail": err})
                    return
                self._bytes(200, p.stdout, "image/png")
            except AdbTimeout:
                self._json(504, {"ok": False, "error": "adb_timeout", "op": "frame"})
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
                p = run(adb_cmd("exec-out", "screencap", "-p"), check=False, timeout=ADB_FRAME_TIMEOUT)
                ok = p.returncode == 0 and p.stdout.startswith(b"\x89PNG")
                self._json(200 if ok else 502, {"ok": ok, "bytes": len(p.stdout) if ok else 0})
                return
            if op == "tap":
                x, y = int(body["x"]), int(body["y"])
                run(adb_cmd("shell", "input", "tap", str(x), str(y)))
                evt = {"op": "tap", "x": x, "y": y}
                RECENT.append(evt)
                self._json(200, {"ok": True, **evt})
                return
            if op == "swipe":
                x1, y1, x2, y2 = int(body["x1"]), int(body["y1"]), int(body["x2"]), int(body["y2"])
                dur = int(body.get("duration_ms", 300))
                run(adb_cmd("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(dur)))
                evt = {"op": "swipe", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "duration_ms": dur}
                RECENT.append(evt)
                self._json(200, {"ok": True, **evt})
                return
            if op == "type":
                text = str(body["text"]).replace(" ", "%s")
                run(adb_cmd("shell", "input", "text", text))
                evt = {"op": "type", "text": body.get("text", "")}
                RECENT.append(evt)
                self._json(200, {"ok": True, "op": "type"})
                return
            if op == "keyevent":
                code = int(body["code"])
                run(adb_cmd("shell", "input", "keyevent", str(code)))
                evt = {"op": "keyevent", "code": code}
                RECENT.append(evt)
                self._json(200, {"ok": True, **evt})
                return
            self._json(400, {"ok": False, "error": "unknown_op", "op": op})
        except KeyError as e:
            self._json(400, {"ok": False, "error": "missing_field", "field": str(e)})
        except AdbTimeout:
            self._json(504, {"ok": False, "error": "adb_timeout", "op": op})
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
