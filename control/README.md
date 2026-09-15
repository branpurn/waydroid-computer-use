# Control primitives

Reliable, scriptable actions against the Waydroid Android UI.

## HTTP API (preferred)

Run on the Fedora/Waydroid host (or any host with `adb` to the device):

```bash
export CONTROL_HOST=0.0.0.0
export CONTROL_PORT=8765
# optional: ADB_SERIAL=192.0.2.10:5555
python3 control/http_server.py
```

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | `{ok, adb}` |
| GET | `/frame` | `image/png` |
| GET | `/actions` | schema examples |
| POST | `/action` | body = `schema.json` envelope; sync |

CORS default `*`; override with `CONTROL_CORS`.

## CLI

- `adb_primitives.sh` — thin wrappers; expects `adb` with a device online.

Canonical action JSON Schema: [`schema.json`](./schema.json).
