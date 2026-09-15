# PoC: Tic-tac-toe DecisionEngine

## Done flag

Stop with reason **`poc: tic-tac-toe win`** after: Play Store → find/install a tic-tac-toe game → open → play → **win** a match.

Failure stops: `poc: tic-tac-toe draw`, `poc: tic-tac-toe loss`, `poc: max play moves exceeded`.

## Phases

| Phase | Behavior |
|-------|----------|
| `ensure_home` | `keyevent` HOME (3) + `wait` |
| `open_play_store` | optional `swipe` (`layout.findPlayStoreSwipe`) then tap `playStoreTap` |
| `search` | tap `searchFieldTap`, `type` query, `wait` |
| `open_result` | tap `firstResultTap` |
| `install_or_open` | tap Install if perception says so, else Open |
| `await_game` | `wait` until perception `in_game` / `kind === "in_game"` |
| `play` | perfect play taps on `boardCells[i]`; opponent turns = `wait` |
| `done` | `stop` with win/fail reason |

No `open_app` action — navigation uses `keyevent` + `tap` + `type` only.

## Perception

`Perception.perceive(frame, history) → Scene` is pluggable.

- **`HeuristicPerception`** (default): advances from action history; `setScene()` for tests. **Does not interpret PNG bytes.** Suitable for offline unit tests only.
- Real device PoC: inject a VLM/OCR implementation that fills `Scene.board`, `hasInstallButton`, `inGame`, `turn`, `winner`.

## Config knobs (`TicTacToePocPolicy` options)

| Knob | Default | Meaning |
|------|---------|---------|
| `layout` | required | All tap targets + `boardCells[9]` |
| `layout.findPlayStoreSwipe` | unset | Optional swipe before Play Store tap |
| `searchQuery` | `"tic tac toe"` | Play Store search text |
| `ourMark` | `"X"` | `"O"` to play second |
| `perception` | `HeuristicPerception` | Swap for real vision later |
| `maxPlayMoves` | `9` | Cap on our board taps |
| `settleMs` | `200` | Duration for navigation `wait`s |

Layout coordinates are **caller-configured** — no lab hosts, IPs, or device-specific hardcodes in the package.

## How to run (unit / offline)

```bash
cd agent
npm install
npm test
npm run build
```

Win path is covered by `src/poc/tic_tac_toe_poc_policy.test.ts` using `StubBackend` + `HeuristicPerception` (weak opponent).

## How to run (live control API)

Provide a measured `ScreenLayout` for the target resolution, use `HttpControlBackend({ baseUrl })`, and preferably a real `Perception`. Keep `maxSteps` generous (e.g. 200) to cover install latency.

## Android keycodes used

- HOME = 3
- BACK = 4 (exported constant; not required by the happy path)
- APP_SWITCH = 187 (exported constant)
