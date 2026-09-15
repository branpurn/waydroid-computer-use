import type { Action } from "./actions.js";

/**
 * DecisionEngine chooses the next action given a screenshot frame and history.
 * Implementations may be rule-based stubs, VLM-backed policies, etc.
 */
export interface DecisionEngine {
  decide(frame: Uint8Array, history: Action[]): Promise<Action>;
}

/**
 * StubPolicy: deterministic PoC path for tests —
 * wait → tap → wait → stop (simulates "open app → interact → done").
 * Not a real Play Store / tic-tac-toe policy; only for offline loop tests.
 */
export class StubPolicy implements DecisionEngine {
  private step = 0;

  async decide(_frame: Uint8Array, _history: Action[]): Promise<Action> {
    const seq: Action[] = [
      { op: "wait", ms: 10 },
      { op: "tap", x: 100, y: 200 },
      { op: "wait", ms: 10 },
      { op: "stop", reason: "stub complete" },
    ];
    const action = seq[Math.min(this.step, seq.length - 1)]!;
    this.step += 1;
    return action;
  }

  reset(): void {
    this.step = 0;
  }
}
