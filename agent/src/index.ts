/**
 * @waydroid-computer-use/agent
 *
 * Pluggable agent loop for Waydroid computer-use.
 * Primary integration: HttpControlBackend → Infra control HTTP API.
 */

export type {
  Action,
  InfraAction,
  LoopLocalAction,
  ScreenshotAction,
  TapAction,
  SwipeAction,
  TypeAction,
  KeyeventAction,
  WaitAction,
  StopAction,
} from "./actions.js";
export {
  SWIPE_DEFAULT_DURATION_MS,
  isWaitAction,
  isStopAction,
  isInfraAction,
} from "./actions.js";

export type { WaydroidBackend } from "./backend.js";

export type { DecisionEngine } from "./policy.js";
export { StubPolicy } from "./policy.js";

export type { AgentLoopOptions, AgentLoopResult } from "./loop.js";
export { AgentLoop } from "./loop.js";

export type { HttpControlBackendOptions } from "./backends/http_control.js";
export { HttpControlBackend } from "./backends/http_control.js";

export type { StubCall } from "./backends/stub.js";
export { StubBackend } from "./backends/stub.js";

/** Optional/dev fallback only — prefer HttpControlBackend. */
export type { AdbCliBackendOptions } from "./backends/adb_cli.js";
export { AdbCliBackend } from "./backends/adb_cli.js";

/** PoC: Play Store → tic-tac-toe → win */
export type {
  Board,
  Cell,
  CellMark,
  PocPhase,
  Scene,
  SceneKind,
  ScreenLayout,
  TapPoint,
  Perception,
  HeuristicPerceptionOptions,
  TicTacToePocPolicyOptions,
} from "./poc/index.js";
export {
  DEFAULT_SEARCH_QUERY,
  KEYCODE_APP_SWITCH,
  KEYCODE_BACK,
  KEYCODE_HOME,
  WIN_REASON,
  cloneBoard,
  emptyBoard,
  HeuristicPerception,
  CENTER,
  CORNERS,
  SIDES,
  WIN_LINES,
  boardToString,
  chooseMove,
  chooseWeakMove,
  emptyCells,
  opponent,
  parseBoard,
  place,
  winnerOf,
  TicTacToePocPolicy,
} from "./poc/index.js";
