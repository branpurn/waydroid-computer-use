# Waydroid viewer UI

Operator / viewer front-end for Waydroid computer-use. Vite + React 18 + TypeScript.

This directory is the app root (`ui/` in the repo). Talks to the **Infra-hosted** HTTP API (see `docs/http-contract.md`).

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

If the API is unreachable, the app enters **mock/demo mode** automatically (synthetic frame + fake actions). You can also force mock via the Connection panel.

```bash
npm run build    # production build → dist/
npm run preview  # serve dist/
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE` | No | Preferred API base URL (no trailing slash). Default: `http://localhost:8787` |
| `VITE_API_BASE_URL` | No | Alias for `VITE_API_BASE` |

Copy `.env.example` to `.env` if desired:

```bash
cp .env.example .env
```

The Connection field in the UI overrides the env default and persists to `localStorage`.

**Do not** hardcode lab hostnames, IPs, tunnels, SSH ports, or machine names.

## Features (PoC)

1. Live/recent Android frame via polling `GET {base}/frame` (PNG)
2. Action overlay (tap markers / swipe lines) on the frame
3. Last actions list (`GET {base}/actions`)
4. Connection/status from `GET {base}/health`
5. Manual tap: click frame → `POST {base}/action` `{"op":"tap","x","y"}` (CSS click mapped to image pixels)
6. Configurable API base (`VITE_API_BASE` + UI + localStorage)
7. Mock/demo mode when API unreachable
8. Dark operator aesthetic, lean deps (React only)

## HTTP contract (summary)

Infra hosts:

- `GET /health` → `{ok, adb?, frame_age_ms?, runtime?}`
- `GET /frame` → `image/png` only
- `GET /actions?limit=` → `{actions:[…]}`
- `POST /action` → sync apply, then `{ok, id?, ts?}` — ops: `screenshot` \| `tap` \| `swipe` \| `type` \| `keyevent`

Coords: absolute pixels, top-left origin, match last screenshot.

Full details: [`docs/http-contract.md`](docs/http-contract.md).

## Stack

- Vite 5
- React 18
- TypeScript 5
- No Next.js; no UI framework beyond plain CSS
