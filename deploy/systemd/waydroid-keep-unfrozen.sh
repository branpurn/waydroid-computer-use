#!/usr/bin/env bash
# If Waydroid froze the LXC payload, clear cgroup.freeze so ADB ops can proceed.
set -euo pipefail
FREEZE_FILE="${WAYDROID_CGROUP_FREEZE:-/sys/fs/cgroup/lxc.payload.waydroid/cgroup.freeze}"
[[ -f "$FREEZE_FILE" ]] || exit 0
if [[ "$(cat "$FREEZE_FILE" 2>/dev/null || true)" == "1" ]]; then
  if command -v sudo >/dev/null 2>&1; then
    echo 0 | sudo -n tee "$FREEZE_FILE" >/dev/null || true
  else
    echo 0 >"$FREEZE_FILE" 2>/dev/null || true
  fi
  logger -t waydroid-keep-unfrozen "cleared cgroup.freeze on $FREEZE_FILE" || true
fi
