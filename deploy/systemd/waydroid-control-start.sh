#!/usr/bin/env bash
# Discover the current Waydroid guest IP, reconnect ADB, then run control HTTP.
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

CONTROL_SCRIPT="${CONTROL_SCRIPT:-$HOME/waydroid-computer-use/control/http_server.py}"
ADB_CONNECT_TIMEOUT="${ADB_CONNECT_TIMEOUT:-15}"
WAYDROID_IP_TIMEOUT="${WAYDROID_IP_TIMEOUT:-60}"
SERIAL="${ADB_SERIAL:-}"

if [[ -z "$SERIAL" ]]; then
  deadline=$((SECONDS + WAYDROID_IP_TIMEOUT))
  while (( SECONDS < deadline )); do
    guest_ip=$(waydroid status 2>/dev/null | sed -n 's/^IP address:[[:space:]]*//p' | tr -d '[:space:]')
    if [[ -n "$guest_ip" && "$guest_ip" != "UNKNOWN" ]]; then
      SERIAL="$guest_ip:5555"
      break
    fi
    sleep 2
  done
fi

if [[ -z "$SERIAL" ]]; then
  echo "Waydroid guest serial unavailable after ${WAYDROID_IP_TIMEOUT}s" >&2
  exit 1
fi

# ADB may have restarted with the session; reconnect before launching control.
timeout "$ADB_CONNECT_TIMEOUT" adb connect "$SERIAL" >/dev/null
timeout "$ADB_CONNECT_TIMEOUT" adb -s "$SERIAL" wait-for-device

export ADB_SERIAL="$SERIAL"
export CONTROL_HOST="${CONTROL_HOST:-0.0.0.0}"
export CONTROL_PORT="${CONTROL_PORT:-8765}"
export WAYDROID_STATUS_CMD="${WAYDROID_STATUS_CMD:-waydroid status}"
export ADB_HEALTH_TIMEOUT="${ADB_HEALTH_TIMEOUT:-5}"
export ADB_TIMEOUT="${ADB_TIMEOUT:-15}"
export ADB_FRAME_TIMEOUT="${ADB_FRAME_TIMEOUT:-20}"

exec python3 "$CONTROL_SCRIPT"
