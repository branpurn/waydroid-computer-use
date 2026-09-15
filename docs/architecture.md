# Architecture

## Goal

Let a Grok Bot **see** and **act** on a Waydroid Android UI: screenshot → decide → tap/swipe/type, with a path to install Play Store apps for a real PoC.

## Layers

1. **Operator / viewer (Frontend)** — human-facing stream of frames + optional manual override.
2. **Agent loop (Backend)** — vision/policy → action schema → calls control plane.
3. **Control plane (Infra)** — reliable primitives on the Waydroid host:
   - `screenshot` → PNG bytes / path
   - `tap(x, y)`
   - `swipe(x1,y1,x2,y2,duration_ms?)`
   - `type(text)` / `keyevent(code)`
4. **Runtime** — Waydroid session on Fedora; ADB into the Android container; optional Fedora-side helpers (display capture, systemd, packaging).

## Access path

Agents Shell on **pop-os**, then SSH to the forwarded port from the Waydroid host’s reverse tunnel (`localhost:2201`). Do not anchor tunnels on macbook (it goes down often). The Waydroid host itself also reboots often; `waydroid-reverse-tunnel.service` uses `Restart=always`.

## Action schema (proposed for Backend)

Keep actions small and absolute-pixel based initially (match screenshot resolution):

```json
{"op":"screenshot"}
{"op":"tap","x":120,"y":480}
{"op":"swipe","x1":100,"y1":800,"x2":100,"y2":200,"duration_ms":300}
{"op":"type","text":"hello"}
{"op":"keyevent","code":3}
```

Backend may wrap these in higher-level skills later; Infra guarantees the primitives.

## Play Store

PoC needs GAPPS / Play Store on the Waydroid image. Infra unblocks install path; app install + match play is the integration test.
