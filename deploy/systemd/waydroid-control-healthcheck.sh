#!/usr/bin/env bash
# Restart the control user service when local /health is unreachable or not ok.
set -euo pipefail
PORT="${CONTROL_PORT:-8765}"
URL="http://127.0.0.1:${PORT}/health"
BODY="$(curl -fsS --max-time 8 "$URL" 2>/dev/null || true)"
if [[ -z "$BODY" ]] || ! printf '%s' "$BODY" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  logger -t waydroid-control-healthcheck "health failed; restarting waydroid-control.service body=${BODY:-<empty>}" || true
  systemctl --user restart waydroid-control.service || true
fi
