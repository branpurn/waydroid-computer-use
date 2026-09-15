/**
 * Action envelopes mirrored from Infra `control/schema.json` on main
 * (Infra owns the source of truth — do not diverge).
 *
 * Infra primitives:
 *   screenshot | tap | swipe | type | keyevent
 *
 * Loop-local only (NOT in control schema):
 *   wait | stop
 */

/** Infra: { "op": "screenshot" } */
export type ScreenshotAction = { op: "screenshot" };

/** Infra: { "op": "tap", "x", "y" } — integers >= 0 */
export type TapAction = {
  op: "tap";
  x: number; // integer >= 0
  y: number; // integer >= 0
};

/**
 * Infra: { "op": "swipe", "x1", "y1", "x2", "y2", "duration_ms"? }
 * duration_ms: integer >= 0, default 300 when omitted at the backend.
 */
export type SwipeAction = {
  op: "swipe";
  x1: number; // integer >= 0
  y1: number; // integer >= 0
  x2: number; // integer >= 0
  y2: number; // integer >= 0
  duration_ms?: number; // integer >= 0; default 300
};

/** Infra: { "op": "type", "text" } — string minLength 1 */
export type TypeAction = {
  op: "type";
  text: string; // minLength 1
};

/** Infra: { "op": "keyevent", "code" } — integer >= 0 */
export type KeyeventAction = {
  op: "keyevent";
  code: number; // integer >= 0
};

/** Loop-local delay; never forwarded to WaydroidBackend / Infra. */
export type WaitAction = {
  op: "wait";
  ms: number;
};

/** Loop-local terminal signal; not an Infra primitive. */
export type StopAction = {
  op: "stop";
  reason?: string;
};

/** Infra-backed primitives (mirror control/schema.json). */
export type InfraAction =
  | ScreenshotAction
  | TapAction
  | SwipeAction
  | TypeAction
  | KeyeventAction;

export type LoopLocalAction = WaitAction | StopAction;

export type Action = InfraAction | LoopLocalAction;

export const SWIPE_DEFAULT_DURATION_MS = 300;

export function isWaitAction(a: Action): a is WaitAction {
  return a.op === "wait";
}

export function isStopAction(a: Action): a is StopAction {
  return a.op === "stop";
}

export function isInfraAction(a: Action): a is InfraAction {
  return (
    a.op === "screenshot" ||
    a.op === "tap" ||
    a.op === "swipe" ||
    a.op === "type" ||
    a.op === "keyevent"
  );
}
