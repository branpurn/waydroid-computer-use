# Viewer HTTP contract

**Status:** locked for PoC (Infra + Frontend aligned)  
**Location in repo:** `ui/docs/http-contract.md`  
**Constraints:** configurable API base URL only; no lab hostnames/IPs/tunnels/SSH ports; Waydroid-on-Fedora is the only runtime assumption.

## Hosting

**Infra hosts** the HTTP surface (thin HTTP over `control/` primitives). The viewer talks **directly** to that API base URL — including manual taps (`POST /action`). Manual actions do not require going through Backend for the PoC.

## Base URL

All paths are relative to a single configurable **API base URL**.

| Source | Notes |
|--------|--------|
| `VITE_API_BASE` | Preferred env var at build time |
| `VITE_API_BASE_URL` | Accepted alias |
| UI Connection field | Editable; persisted to `localStorage` |

Example shape (not a real host): `http://localhost:8787`

## Coordinate space

- **Absolute pixels** in the latest screenshot’s resolution/orientation.
- Origin: top-left `(0,0)`.
- Manual taps from the viewer map CSS click position → image pixel coords (account for CSS scaling / `object-fit: contain`).

## Endpoints

### `GET /health`

Liveness of the Infra-hosted frame/action server.

**200**
```json
{
  "ok": true,
  "runtime": "waydroid",
  "adb": "device",
  "frame_age_ms": 120
}
```

- `adb`: `"device"` | `"offline"` | `"none"` | `"unknown"`
- Extra fields optional; viewer treats `ok: true` as connected.

**503** when not ready:
```json
{ "ok": false, "error": "no_adb_device" }
```

### `GET /frame`

Latest screenshot as **PNG only** (PoC).

| Header / query | Meaning |
|----------------|---------|
| `Content-Type: image/png` | Required |
| `X-Frame-Width`, `X-Frame-Height` | Optional; pixel size |
| `X-Frame-Ts` | Optional; Unix ms when captured |
| `?since=<unix_ms>` | Optional; `304` if no newer frame |

**200** — raw PNG bytes  
**204 / 404** — no frame yet  
**503** — capture unavailable  

PoC polling: viewer polls every ~500–1000ms. MJPEG/`multipart` or WebSocket can come later; not required for PoC.

### `GET /actions?limit=50`

Recent actions for the “last actions” list + overlay.

**200**
```json
{
  "actions": [
    {
      "id": "a1",
      "ts": 1726400000123,
      "op": "tap",
      "x": 120,
      "y": 480,
      "source": "agent"
    },
    {
      "id": "a2",
      "ts": 1726400000450,
      "op": "swipe",
      "x1": 100,
      "y1": 800,
      "x2": 100,
      "y2": 200,
      "duration_ms": 300,
      "source": "viewer"
    }
  ]
}
```

`op` values: `screenshot` | `tap` | `swipe` | `type` | `keyevent`  
`source`: `agent` | `viewer` | `system` (optional)

### `POST /action`

Manual override / debug from the viewer. **Synchronous:** Infra waits until the op is applied (ADB), then returns `{ok,...}`.

**Request body**
```json
{"op":"tap","x":120,"y":480}
```
```json
{"op":"swipe","x1":100,"y1":800,"x2":100,"y2":200,"duration_ms":300}
```
```json
{"op":"type","text":"hello"}
```
```json
{"op":"keyevent","code":3}
```
```json
{"op":"screenshot"}
```

**200** (after apply)
```json
{ "ok": true, "id": "a3", "ts": 1726400000999 }
```

**501** if a given `op` is not wired yet  
**503** if control plane down  

Viewer PoC: click-on-frame → `POST /action` with `op:"tap"` (coords in screenshot pixel space). Other ops can be UI buttons later.

## Viewer behavior (PoC)

| UI piece | Data source |
|----------|-------------|
| Live screen | `GET /frame` (poll, PNG) |
| Status | `GET /health` |
| Overlay markers | recent `tap`/`swipe` from `GET /actions` |
| Last actions | `GET /actions` |
| Manual tap | `POST /action` `{op:tap,x,y}` → Infra API base directly |

When base URL unreachable: disconnected state + **mock/demo mode** (synthetic frame + fake actions) so the UI runs offline.

## Non-goals (PoC)

- Hardcoding SSH/ADB rendezvous details in the UI
- Embedding Infra shell scripts in the browser
- WebRTC / low-latency stream (poll is enough)
- Auth (add later if the endpoint is exposed beyond localhost)
- JPEG or other non-PNG frame formats

## Locked decisions (summary)

1. Env: prefer `VITE_API_BASE`; accept `VITE_API_BASE_URL` as alias.
2. `GET /frame` is PNG-only for PoC.
3. `POST /action` is synchronous (wait for apply, then `{ok,...}`).
4. Infra hosts the HTTP surface; viewer talks to that API base directly.
