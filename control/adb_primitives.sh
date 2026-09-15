#!/usr/bin/env bash
# Thin ADB wrappers for Waydroid computer-use.
# Expects: adb device online (e.g. after adb connect / waydroid session).
set -euo pipefail

ADB="${ADB:-adb}"

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command> [args]
  screenshot [out.png]   Write PNG (default: screenshot.png)
  tap <x> <y>
  swipe <x1> <y1> <x2> <y2> [duration_ms]
  type <text>            ADB input text (escape spaces as %s)
  keyevent <code>        e.g. 3=HOME 4=BACK
  devices                adb devices -l
USAGE
}

need_device() {
  if ! "$ADB" devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
    echo "error: no adb device in 'device' state" >&2
    "$ADB" devices -l >&2 || true
    exit 1
  fi
}

cmd="${1:-}"
shift || true

case "$cmd" in
  screenshot)
    need_device
    out="${1:-screenshot.png}"
    "$ADB" exec-out screencap -p > "$out"
    echo "$out"
    ;;
  tap)
    need_device
    "$ADB" shell input tap "$1" "$2"
    ;;
  swipe)
    need_device
    dur="${5:-300}"
    "$ADB" shell input swipe "$1" "$2" "$3" "$4" "$dur"
    ;;
  type)
    need_device
    # ADB input text: spaces as %s
    text="${*// /%s}"
    "$ADB" shell input text "$text"
    ;;
  keyevent)
    need_device
    "$ADB" shell input keyevent "$1"
    ;;
  devices)
    "$ADB" devices -l
    ;;
  *)
    usage
    exit 1
    ;;
esac
