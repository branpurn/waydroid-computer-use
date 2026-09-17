# Ops runbook — Waydroid control HTTP

Operational notes for running `control/http_server.py` against a Waydroid (Fedora) host. Keep this document **host-agnostic**: no lab IPs, hostnames, or LAN topology.

## Symptoms: `/health` green but `/frame` / `/action` hang

**Root cause:** Waydroid’s default `suspend_action = freeze` (in `waydroid.cfg`) freezes the LXC payload when the session goes idle / screen-off. ADB’s TCP channel can still report `device`, so a shallow `adb get-state` looks healthy while `screencap` and `input` block forever.

**Detect:**

- `waydroid status` shows `Container: FROZEN` (session may still say RUNNING).
- Host cgroup: `lxc.payload.waydroid` `cgroup.freeze` is `1`.
- Control `/health` (with deep probe) returns `ok: false` and `reason` of `adb_ops_hung` or `container_frozen`.
- `/frame` or `/action` returns **504** `{"error":"adb_timeout"}` instead of hanging (after this fix).

**Recover — unfreeze:**

```bash
# Preferred when LXC tools know the Waydroid path:
sudo lxc-unfreeze -P /var/lib/waydroid/lxc -n waydroid

# Or write the cgroup freeze knob directly:
echo 0 | sudo tee /sys/fs/cgroup/lxc.payload.waydroid/cgroup.freeze
```

Then re-check `waydroid status` and `GET /health`.

## Always-on computer-use hosts (recommended)

To reduce freeze loops:

1. **Keep Android awake** while the control plane is in use, e.g. `stay_on_while_plugged_in` and a long `screen_off_timeout` via `adb shell settings …`, and/or `svc power stayon true`.
2. **Unfreeze watchdog** — a small timer (e.g. every 60s) that writes `0` to the payload `cgroup.freeze` if it is `1`. Useful when headless compositors still trip idle freeze.
3. Understand **`suspend_action`**: `freeze` (default) vs `stop`. Neither is ideal for always-on agents; prefer stay-on + watchdog over leaving freeze enabled with no mitigation.

## Session needs a Wayland compositor

`waydroid session start` requires a Wayland display. On a headless host, run a compositor first (e.g. Weston headless), then start the session with matching `XDG_RUNTIME_DIR` / `WAYLAND_DISPLAY`.

Example pattern (adjust socket name to match your compositor):

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
weston --backend=headless-backend.so --width=1280 --height=800 --socket=wayland-1 &
export WAYLAND_DISPLAY=wayland-1
waydroid session start
waydroid adb connect   # or adb connect <guest-ip>:5555
```

## Restart control HTTP

Bind reachable from consumers; pin the device serial:

```bash
export CONTROL_HOST=0.0.0.0
export CONTROL_PORT=8765
export ADB_SERIAL=<serial-from-adb-devices>   # e.g. <ip>:5555
# Optional: surface Session/Container in /health
export WAYDROID_STATUS_CMD='waydroid status'
# Optional timeouts (seconds)
export ADB_TIMEOUT=15
export ADB_HEALTH_TIMEOUT=5
export ADB_FRAME_TIMEOUT=20

python3 control/http_server.py
```

## Quick verification

```bash
curl -sS "$CONTROL_BASE/health"          # expect ok:true and adb device
curl -sS -o /tmp/frame.png -w '%{http_code} %{size_download}\n' "$CONTROL_BASE/frame"
curl -sS -X POST "$CONTROL_BASE/action" -H 'Content-Type: application/json' \
  -d '{"op":"keyevent","code":3}'
```

If the container is frozen, `/health` should fail fast with `adb_ops_hung` / `container_frozen`, and `/frame` should 504 rather than hang.

## Related ADB auth note

If `adb devices` shows `unauthorized`, inject the host `~/.android/adbkey.pub` into the guest `adb_keys` (via `waydroid shell`) and restart `adbd`, then reconnect. Details vary by image; keep keys off git.

## Keep control HTTP alive with systemd

The repository includes a generalized user-service template and launcher under `deploy/systemd/`. The launcher discovers the current Waydroid guest IP, reconnects ADB, exports `ADB_SERIAL`, and starts the control server. The service uses `Restart=always`, so a failed launcher or control process is retried.

Install it for the user that owns the Waydroid session:

```bash
mkdir -p "$HOME/bin" "$HOME/.config/systemd/user"
install -m 0755 deploy/systemd/waydroid-control-start.sh "$HOME/bin/waydroid-control-start.sh"
install -m 0644 deploy/systemd/waydroid-control.service \
  "$HOME/.config/systemd/user/waydroid-control.service"

systemctl --user daemon-reload
systemctl --user enable --now waydroid-control.service
systemctl --user status waydroid-control.service
```

The launcher assumes the repository lives at `$HOME/waydroid-computer-use`. Override `CONTROL_SCRIPT` in a systemd drop-in when installed elsewhere:

```ini
[Service]
Environment=CONTROL_SCRIPT=/absolute/path/to/control/http_server.py
```

Useful optional environment overrides are `CONTROL_HOST`, `CONTROL_PORT`, `ADB_SERIAL`, `WAYDROID_IP_TIMEOUT`, `ADB_CONNECT_TIMEOUT`, and the ADB operation timeout variables described above. When `ADB_SERIAL` is unset, the launcher re-discovers the guest address on every service start.

This service complements the stay-on and unfreeze watchdog recommendations above: the control service restarts the HTTP/ADB path, while the watchdog handles an LXC payload that Waydroid has frozen.
