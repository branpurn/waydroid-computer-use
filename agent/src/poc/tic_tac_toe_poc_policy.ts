/**
 * TicTacToePocPolicy — DecisionEngine for the PoC done flag:
 * Play Store → find/install tic-tac-toe → open → play → win.
 *
 * Uses pluggable Perception; default HeuristicPerception is history-driven
 * and offline-testable. Real runs should inject a VLM/OCR perception later.
 */

import type { Action } from "../actions.js";
import type { DecisionEngine } from "../policy.js";
import { HeuristicPerception, type Perception } from "./perception.js";
import { chooseMove, opponent, winnerOf } from "./tictactoe.js";
import {
  DEFAULT_SEARCH_QUERY,
  KEYCODE_HOME,
  WIN_REASON,
  type Board,
  type CellMark,
  type PocPhase,
  type Scene,
  type ScreenLayout,
  emptyBoard,
} from "./types.js";

export interface TicTacToePocPolicyOptions {
  layout: ScreenLayout;
  searchQuery?: string;
  /** Default X (first player). Set O to play second. */
  ourMark?: CellMark;
  perception?: Perception;
  /** Cap on our board moves during play (default 9). */
  maxPlayMoves?: number;
  /** Default wait after navigation actions (ms). */
  settleMs?: number;
}

const DEFAULT_SETTLE_MS = 200;

export class TicTacToePocPolicy implements DecisionEngine {
  private readonly layout: ScreenLayout;
  private readonly searchQuery: string;
  private readonly ourMark: CellMark;
  private readonly perception: Perception;
  private readonly maxPlayMoves: number;
  private readonly settleMs: number;

  private phase: PocPhase = "ensure_home";
  private substep = 0;
  private playMoves = 0;
  private swipedForStore = false;

  constructor(opts: TicTacToePocPolicyOptions) {
    this.layout = opts.layout;
    this.searchQuery = opts.searchQuery ?? DEFAULT_SEARCH_QUERY;
    this.ourMark = opts.ourMark ?? "X";
    this.maxPlayMoves = opts.maxPlayMoves ?? 9;
    this.settleMs = opts.settleMs ?? DEFAULT_SETTLE_MS;
    this.perception =
      opts.perception ??
      new HeuristicPerception({
        layout: this.layout,
        ourMark: this.ourMark,
        searchQuery: this.searchQuery,
      });
  }

  getPhase(): PocPhase {
    return this.phase;
  }

  getPerception(): Perception {
    return this.perception;
  }

  reset(): void {
    this.phase = "ensure_home";
    this.substep = 0;
    this.playMoves = 0;
    this.swipedForStore = false;
  }

  async decide(frame: Uint8Array, history: Action[]): Promise<Action> {
    const scene = await this.perception.perceive(frame, history);

    switch (this.phase) {
      case "ensure_home":
        return this.ensureHome();
      case "open_play_store":
        return this.openPlayStore();
      case "search":
        return this.search();
      case "open_result":
        return this.openResult();
      case "install_or_open":
        return this.installOrOpen(scene);
      case "await_game":
        return this.awaitGame(scene);
      case "play":
        return this.play(scene);
      case "done":
        return { op: "stop", reason: WIN_REASON };
      default: {
        const _exhaustive: never = this.phase;
        return {
          op: "stop",
          reason: `poc: unknown phase ${String(_exhaustive)}`,
        };
      }
    }
  }

  private ensureHome(): Action {
    if (this.substep === 0) {
      this.substep = 1;
      return { op: "keyevent", code: KEYCODE_HOME };
    }
    this.substep = 0;
    this.phase = "open_play_store";
    return { op: "wait", ms: this.settleMs };
  }

  private openPlayStore(): Action {
    const swipe = this.layout.findPlayStoreSwipe;

    // Optional: swipe to reveal Play Store, then settle.
    if (swipe && !this.swipedForStore) {
      this.swipedForStore = true;
      return {
        op: "swipe",
        x1: swipe.x1,
        y1: swipe.y1,
        x2: swipe.x2,
        y2: swipe.y2,
        duration_ms: swipe.duration_ms,
      };
    }
    if (swipe && this.swipedForStore && this.substep === 0) {
      this.substep = 1;
      return { op: "wait", ms: this.settleMs };
    }

    if (this.substep <= 1) {
      this.substep = 2;
      const t = this.layout.playStoreTap;
      return { op: "tap", x: t.x, y: t.y };
    }

    this.substep = 0;
    this.phase = "search";
    return { op: "wait", ms: this.settleMs };
  }

  private search(): Action {
    if (this.substep === 0) {
      this.substep = 1;
      const t = this.layout.searchFieldTap;
      return { op: "tap", x: t.x, y: t.y };
    }
    if (this.substep === 1) {
      this.substep = 2;
      return { op: "type", text: this.searchQuery };
    }
    this.substep = 0;
    this.phase = "open_result";
    return { op: "wait", ms: this.settleMs };
  }

  private openResult(): Action {
    if (this.substep === 0) {
      this.substep = 1;
      const t = this.layout.firstResultTap;
      return { op: "tap", x: t.x, y: t.y };
    }
    this.substep = 0;
    this.phase = "install_or_open";
    return { op: "wait", ms: this.settleMs };
  }

  private installOrOpen(scene: Scene): Action {
    // 0: Install if present, else Open
    // 1: wait after Install
    // 2: Open after Install
    // 3: wait → await_game
    if (this.substep === 0) {
      if (scene.hasInstallButton) {
        this.substep = 1;
        const t = this.layout.installTap;
        return { op: "tap", x: t.x, y: t.y };
      }
      this.substep = 3;
      const t = this.layout.openTap;
      return { op: "tap", x: t.x, y: t.y };
    }
    if (this.substep === 1) {
      this.substep = 2;
      return { op: "wait", ms: this.settleMs };
    }
    if (this.substep === 2) {
      this.substep = 3;
      const t = this.layout.openTap;
      return { op: "tap", x: t.x, y: t.y };
    }
    this.substep = 0;
    this.phase = "await_game";
    return { op: "wait", ms: this.settleMs };
  }

  private awaitGame(scene: Scene): Action {
    if (scene.inGame || scene.kind === "in_game") {
      this.phase = "play";
      this.substep = 0;
      return { op: "wait", ms: this.settleMs };
    }
    return { op: "wait", ms: this.settleMs };
  }

  private play(scene: Scene): Action {
    const board: Board = scene.board ?? emptyBoard();
    const terminal = scene.winner ?? winnerOf(board);

    if (terminal === this.ourMark) {
      this.phase = "done";
      return { op: "stop", reason: WIN_REASON };
    }
    if (terminal === "draw") {
      this.phase = "done";
      return { op: "stop", reason: "poc: tic-tac-toe draw" };
    }
    if (terminal === opponent(this.ourMark)) {
      this.phase = "done";
      return { op: "stop", reason: "poc: tic-tac-toe loss" };
    }

    if (this.playMoves >= this.maxPlayMoves) {
      this.phase = "done";
      return { op: "stop", reason: "poc: max play moves exceeded" };
    }

    const turn = scene.turn ?? "X";
    if (turn !== this.ourMark) {
      return { op: "wait", ms: this.settleMs };
    }

    const move = chooseMove(board, this.ourMark);
    const cell = this.layout.boardCells[move]!;
    this.playMoves += 1;
    return { op: "tap", x: cell.x, y: cell.y };
  }
}
