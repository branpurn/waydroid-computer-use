#!/usr/bin/env bash
# SSH to the configured Waydroid-on-Fedora host. No lab defaults baked in.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${WAYDROID_SSH_HOST:?Set WAYDROID_SSH_HOST (see .env.example)}"
: "${WAYDROID_SSH_USER:?Set WAYDROID_SSH_USER (see .env.example)}"
PORT="${WAYDROID_SSH_PORT:-22}"

opts=(-p "$PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "${WAYDROID_SSH_IDENTITY:-}" ]]; then
  opts+=(-i "$WAYDROID_SSH_IDENTITY")
fi

exec ssh "${opts[@]}" "${WAYDROID_SSH_USER}@${WAYDROID_SSH_HOST}" "$@"
