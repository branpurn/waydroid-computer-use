# Agent loop design

## Cycle

```
while steps < maxSteps:
  frame = backend.screenshot()          # HttpControlBackend → GET /frame (PNG)
  action = policy.decide(frame, history)
  history.append(action)
  if action.op == stop:  return
  if action.op == wait:  sleep(ms); continue   # loop-local
  execute via backend                      # tap/swipe/type/keyevent → POST /action
```

## Pluggable backend

`AgentLoop` depends only on `WaydroidBackend`. It never hardcodes tunnels, ADB serials, or hosts.

**Primary:** `HttpControlBackend({ baseUrl })` against Infra’s control API:

- `GET /health`
- `GET /frame` → framing PNG
- `GET /actions`
- `POST /action` → one `control/schema.json` Infra action

**Tests:** `StubBackend` + `StubPolicy`.

**Dev only:** `AdbCliBackend` (optional fallback; not the Infra contract).

## Action ownership

| Op | Owner | Notes |
|----|--------|--------|
| screenshot, tap, swipe, type, keyevent | Infra schema + control API | TS types mirror `control/schema.json` on main |
| wait, stop | Agent loop | Never sent as control API bodies for framing/input path |

Swipe `duration_ms` defaults to 300 when omitted (schema default).

## PoC (product)

Play Store → tic-tac-toe → win. Wiring of Waydroid/ADB/network is Infra’s control service; this package only needs a reachable `baseUrl`.
