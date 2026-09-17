# Ops runbook — Waydroid control HTTP

Operational notes for running `control/http_server.py` against a Waydroid (Fedora) host. Keep this document **host-agnostic**: no lab IPs, hostnames, or LAN topology.

## Incident post-mortem (loss of control / visibility)

Two failure modes repeatedly made computer-use consumers lose the stack:

### A) Connection refused on `:8765`

**Symptom:** `curl` to control HTTP fails with connection refused. Reverse SSH / host ping may still look fine.

**Root cause:** Control was started as an ad-hoc `nohup`/manual process. After a Waydroid session restart, reboot, or crash, nothing brought it back. ADB often also had no attached device until an explicit `adb connect`.

**Fix:** Run control under a **user systemd unit** with `Restart=always`, using the launcher that rediscovers the guest IP and reconnects ADB before `exec`ing the server. See `deploy/systemd/` and the enablement section below. Add the **healthcheck timer** so a wedged or silently dead listener is restarted when local `/health` is not `ok:true`.

### B) `/health` green but `/frame` / `/action` hang

**Symptom:** `/health` returns `ok:true` / `adb: device`, but `/frame` and `/action` hang with no body.

**Root cause:** Waydroid’s default `suspend_action = freeze` freezes the LXC payload on idle/screen-off. ADB TCP can still report `device`, so a shallow `get-state` looks healthy while `screencap`/`input` block forever.

**Fix (code):** Deep `/health` probe (`adb shell echo ok` with timeout) plus timeouts on all ADB ops (`504` `adb_timeout` instead of hanging).

**Fix (host):** Stay-on settings, and the **keep-unfrozen** timer that clears `cgroup.freeze` when set.

### C) Session needs a compositor

`waydroid session start` needs a Wayland display. On headless hosts, start a compositor (e.g. Weston headless) before the session. Control cannot recover a missing Android session by itself; it only reconnects ADB and serves HTTP once the guest is up.

## Deploy hardened control (recommended)

Templates live under `deploy/systemd/`:

| File | Role |
|------|------|
| `waydroid-control-start.sh` | Discover guest IP, `adb connect`, export env, exec server |
| `waydroid-control.service` | `Restart=always` user service for control HTTP |
| `waydroid-control-healthcheck.sh` | Curl local `/health`; restart control service if not ok |
| `waydroid-control-healthcheck.{service,timer}` | Run healthcheck about every minute |
| `waydroid-keep-unfrozen.sh` | Clear LXC `cgroup.freeze` when frozen |
| `waydroid-keep-unfrozen.{service,timer}` | Run unfreeze check about every minute |

Install for the user that owns the Waydroid session (`loginctl enable-linger` for that user is recommended so user units survive logout):

```bash
mkdir -p "$HOME/bin" "$HOME/.config/systemd/user"

install -m 0755 deploy/systemd/waydroid-control-start.sh "$HOME/bin/"
install -m 0755 deploy/systemd/waydroid-control-healthcheck.sh "$HOME/bin/"
install -m 0755 deploy/systemd/waydroid-keep-unfrozen.sh "$HOME/bin/"

install -m 0644 deploy/systemd/waydroid-control.service "$HOME/.config/systemd/user/"
install -m 0644 deploy/systemd/waydroid-control-healthcheck.service "$HOME/.config/systemd/user/"
install -m 0644 deploy/systemd/waydroid-control-healthcheck.timer "$HOME/.config/systemd/user/"
install -m 0644 deploy/systemd/waydroid-keep-unfrozen.service "$HOME/.config/systemd/user/"
install -m 0644 deploy/systemd/waydroid-keep-unfrozen.timer "$HOME/.config/systemd/user/"

systemctl --user daemon-reload
systemctl --user enable --now waydroid-control.service
systemctl --user enable --now waydroid-control-healthcheck.timer
systemctl --user enable --now waydroid-keep-unfrozen.timer

systemctl --user status waydroid-control.service \
  waydroid-control-healthcheck.timer \
  waydroid-keep-unfrozen.timer
```

The control launcher assumes the repo at `$HOME/waydroid-computer-use`. Override with a drop-in when needed:

```ini
[Service]
Environment=CONTROL_SCRIPT=/absolute/path/to/control/http_server.py
```

Optional env: `CONTROL_HOST`, `CONTROL_PORT`, `ADB_SERIAL`, `WAYDROID_IP_TIMEOUT`, `ADB_CONNECT_TIMEOUT`, `ADB_TIMEOUT`, `ADB_HEALTH_TIMEOUT`, `ADB_FRAME_TIMEOUT`, `WAYDROID_STATUS_CMD`, `WAYDROID_CGROUP_FREEZE`.

## Manual recovery

**Unfreeze LXC payload:**

```bash
sudo lxc-unfreeze -P /var/lib/waydroid/lxc -n waydroid
# or:
echo 0 | sudo tee /sys/fs/cgroup/lxc.payload.waydroid/cgroup.freeze
```

**Restart control only:**

```bash
systemctl --user restart waydroid-control.service
```

**Headless session pattern:**

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
weston --backend=headless-backend.so --width=1280 --height=800 --socket=wayland-1 &
export WAYLAND_DISPLAY=wayland-1
waydroid session start
```

**Always-on Android tips:** `stay_on_while_plugged_in`, long `screen_off_timeout`, and/or `svc power stayon true` via `adb shell`. Prefer these plus the unfreeze timer over relying on `suspend_action` alone (`freeze` vs `stop`).

## Quick verification

```bash
curl -sS "$CONTROL_BASE/health"   # expect ok:true (deep probe)
curl -sS -o /tmp/frame.png -w '%{http_code} %{size_download}\n' "$CONTROL_BASE/frame"
curl -sS -X POST "$CONTROL_BASE/action" -H 'Content-Type: application/json' \
  -d '{"op":"keyevent","code":3}'
```

Frozen container → `/health` should fail fast (`adb_ops_hung` / `container_frozen`); `/frame` should **504** rather than hang.

## ADB unauthorized

If `adb devices` shows `unauthorized`, inject the host `~/.android/adbkey.pub` into the guest `adb_keys` (via `waydroid shell`), restart `adbd`, reconnect. Keep keys off git.
