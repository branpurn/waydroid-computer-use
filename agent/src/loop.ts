import {
  type Action,
  SWIPE_DEFAULT_DURATION_MS,
  isInfraAction,
  isStopAction,
  isWaitAction,
} from "./actions.js";
import type { WaydroidBackend } from "./backend.js";
import type { DecisionEngine } from "./policy.js";

export interface AgentLoopOptions {
  backend: WaydroidBackend;
  policy: DecisionEngine;
  /** Hard cap on decide→execute cycles (default 50). */
  maxSteps?: number;
  /** Optional hook after each executed action (excluding the framing screenshot). */
  onStep?: (info: {
    step: number;
    action: Action;
    frame: Uint8Array;
  }) => void | Promise<void>;
}

export interface AgentLoopResult {
  stopped: boolean;
  reason?: string;
  steps: number;
  history: Action[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Agent loop: screenshot → decide → execute until stop or maxSteps.
 * `wait` is handled locally; Infra ops go through WaydroidBackend.
 * Never talks to a hardcoded tunnel — only the injected backend.
 */
export class AgentLoop {
  private readonly backend: WaydroidBackend;
  private readonly policy: DecisionEngine;
  private readonly maxSteps: number;
  private readonly onStep?: AgentLoopOptions["onStep"];

  constructor(opts: AgentLoopOptions) {
    this.backend = opts.backend;
    this.policy = opts.policy;
    this.maxSteps = opts.maxSteps ?? 50;
    this.onStep = opts.onStep;
  }

  async run(): Promise<AgentLoopResult> {
    const history: Action[] = [];
    let steps = 0;

    while (steps < this.maxSteps) {
      const frame = await this.backend.screenshot();
      const action = await this.policy.decide(frame, history);
      history.push(action);
      steps += 1;

      if (this.onStep) {
        await this.onStep({ step: steps, action, frame });
      }

      if (isStopAction(action)) {
        return {
          stopped: true,
          reason: action.reason,
          steps,
          history,
        };
      }

      if (isWaitAction(action)) {
        await sleep(action.ms);
        continue;
      }

      if (isInfraAction(action)) {
        await this.executeInfra(action);
      }
    }

    return {
      stopped: false,
      reason: "maxSteps reached",
      steps,
      history,
    };
  }

  private async executeInfra(action: Action): Promise<void> {
    switch (action.op) {
      case "screenshot":
        // Frame already captured each cycle; optional explicit re-capture.
        await this.backend.screenshot();
        break;
      case "tap":
        await this.backend.tap(action.x, action.y);
        break;
      case "swipe":
        await this.backend.swipe(
          action.x1,
          action.y1,
          action.x2,
          action.y2,
          action.duration_ms ?? SWIPE_DEFAULT_DURATION_MS,
        );
        break;
      case "type":
        await this.backend.typeText(action.text);
        break;
      case "keyevent":
        await this.backend.keyevent(action.code);
        break;
      default:
        break;
    }
  }
}
