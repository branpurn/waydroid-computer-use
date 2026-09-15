# `@waydroid-computer-use/agent`

TypeScript agent loop for Waydroid computer-use.

**Ownership:** Agent/policy/loop lives here. Infra owns `control/schema.json` and the control HTTP API. This package mirrors Infra action shapes and talks only through a pluggable `WaydroidBackend`.

**Runtime assumption:** Waydroid on Fedora. Connection/target is always caller-configured (`baseUrl` for HTTP). No lab hosts, tunnels, or machine IDs in this package.

## PoC goal

Drive a Waydroid session through a high-level path: **Play Store → install/open tic-tac-toe → win a game**. Concrete UI coordinates and policy quality are out of scope for this draft; the loop + backend contract is the deliverable.

## Primary contract: HTTP control API

Default backend: **`HttpControlBackend`** with `{ baseUrl: string }`.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Liveness |
| `GET` | `/frame` | PNG screenshot for the decision loop |
| `GET` | `/actions` | Discover/list supported actions |
| `POST` | `/action` | One Infra action body (`tap` / `swipe` / `type` / `keyevent` / optional `screenshot`) |

- Loop frames: **`GET /frame`** via `backend.screenshot()`.
- Inputs: **`POST /action`** only — no second action channel.
- Action JSON mirrors Infra `control/schema.json` on main (source of truth).

Loop-local only (never POSTed): `{ "op": "wait", "ms" }`, `{ "op": "stop", "reason?" }`.

## Quick start

```bash
cd agent
npm install
npm test
npm run build
```

```ts
import { AgentLoop, HttpControlBackend, StubPolicy } from "@waydroid-computer-use/agent";

const backend = new HttpControlBackend({ baseUrl: process.env.CONTROL_BASE_URL! });
// Replace StubPolicy with a real DecisionEngine for the PoC.
const loop = new AgentLoop({ backend, policy: new StubPolicy(), maxSteps: 100 });
const result = await loop.run();
```

## Backends

| Backend | Role |
|---------|------|
| `HttpControlBackend` | **Primary** — Infra control HTTP API |
| `StubBackend` | Unit tests |
| `AdbCliBackend` | **Optional/dev fallback only** — not the integration contract |

## Infra action shapes (mirrored)

- `screenshot`: `{ op }`
- `tap`: `{ op, x, y }` integers ≥ 0
- `swipe`: `{ op, x1, y1, x2, y2, duration_ms? }` integers ≥ 0; `duration_ms` default **300**
- `type`: `{ op, text }` string minLength 1
- `keyevent`: `{ op, code }` integer ≥ 0

Do not fork a local `control/schema.json`; copy types from main.

## PoC policy: `TicTacToePocPolicy`

Phased DecisionEngine for the done flag: **Play Store → search/install/open a tic-tac-toe app → play → win**.

```ts
import {
  AgentLoop,
  HttpControlBackend,
  TicTacToePocPolicy,
  type ScreenLayout,
} from "@waydroid-computer-use/agent";

const layout: ScreenLayout = {
  playStoreTap: { x: /* … */, y: /* … */ },
  searchFieldTap: { x: /* … */, y: /* … */ },
  firstResultTap: { x: /* … */, y: /* … */ },
  installTap: { x: /* … */, y: /* … */ },
  openTap: { x: /* … */, y: /* … */ },
  boardCells: [/* 9 {x,y} row-major */],
};

const policy = new TicTacToePocPolicy({
  layout,
  searchQuery: "tic tac toe", // optional
  ourMark: "X",               // optional; "O" to play second
  // perception: new VlmPerception(…), // optional; default HeuristicPerception
});

const loop = new AgentLoop({
  backend: new HttpControlBackend({ baseUrl: process.env.CONTROL_BASE_URL! }),
  policy,
  maxSteps: 200,
});
const result = await loop.run();
// done: result.reason === "poc: tic-tac-toe win"
```

- Actions stay on the existing union: `screenshot|tap|swipe|type|keyevent` + loop-local `wait|stop`. No `open_app`.
- Default `HeuristicPerception` is **history-driven** (does not read PNG bytes). Swap a real VLM/OCR perception without rewriting the phase machine.
- See `docs/poc-tic-tac-toe.md` for phases and config knobs.
