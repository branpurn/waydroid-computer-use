# Control primitives

Reliable, scriptable actions against the Waydroid Android UI.

## Interface

| Primitive | Intent |
|-----------|--------|
| `screenshot` | Capture current frame (PNG) |
| `tap x y` | Single tap at pixel coords |
| `swipe x1 y1 x2 y2 [ms]` | Swipe gesture |
| `type text` | Type a string (ADB `input text` limitations apply) |
| `keyevent code` | Android keycode (HOME=3, BACK=4, …) |

Primary implementation: **ADB**. Secondary: Fedora/Waydroid host tools when ADB is insufficient.

Configure `ADB` / `ADB_SERIAL` via environment (see `.env.example`).

Canonical action JSON Schema: [`schema.json`](./schema.json).

## Scripts

- `adb_primitives.sh` — thin wrappers; expects `adb` with a device online.

## Coordinate space

Coordinates are in the screenshot’s pixel space. Callers must use the same orientation/resolution as the last capture.
