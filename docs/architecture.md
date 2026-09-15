# Architecture

## Goal

Let an agent **see** and **act** on a Waydroid Android UI: screenshot → decide → tap/swipe/type, with a path to install Play Store apps for a real PoC.

## Environment assumption

**Waydroid on Fedora** only. Connectivity to that host is external configuration (SSH/VPN/tunnel/etc.), not part of the core design. See `.env.example`.

## Layers

1. **Operator / viewer** — human-facing stream of frames + optional manual override.
2. **Agent loop** — vision/policy → action schema → calls control plane.
3. **Control plane** — reliable primitives on the Waydroid host:
   - `screenshot` → PNG bytes / path
   - `tap(x, y)`
   - `swipe(x1,y1,x2,y2,duration_ms?)`
   - `type(text)` / `keyevent(code)`
4. **Runtime** — Waydroid session on Fedora; ADB into the Android container; optional Fedora-side helpers (display capture, systemd, packaging).

## Action schema

Canonical JSON Schema: [`control/schema.json`](../control/schema.json).

Example envelope:

```json
{"op":"screenshot"}
{"op":"tap","x":120,"y":480}
{"op":"swipe","x1":100,"y1":800,"x2":100,"y2":200,"duration_ms":300}
{"op":"type","text":"hello"}
{"op":"keyevent","code":3}
```

Higher-level skills can wrap these later; the control plane guarantees the primitives.

## Play Store

PoC needs GAPPS / Play Store on the Waydroid image. Unblock install path on Fedora+Waydroid; app install + match play is the integration test.
