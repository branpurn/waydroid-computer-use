/**
 * Pluggable perception for TicTacToePocPolicy.
 *
 * HeuristicPerception does NOT interpret PNG bytes. It advances scenes from
 * action history (and optional setScene overrides) so unit tests run offline.
 * Swap in a VlmPerception / OcrPerception later without rewriting the phase machine.
 */

import type { Action } from "../actions.js";
import {
  type Board,
  type CellMark,
  type Scene,
  type ScreenLayout,
  cloneBoard,
  emptyBoard,
} from "./types.js";
import {
  chooseWeakMove,
  opponent,
  place,
  winnerOf,
} from "./tictactoe.js";

export interface Perception {
  perceive(frame: Uint8Array, history: Action[]): Promise<Scene>;
}

export interface HeuristicPerceptionOptions {
  /** Needed to map board taps → cell indices during simulated play. */
  layout: ScreenLayout;
  ourMark?: CellMark;
  /** Search query the policy will type (used to detect search completion). */
  searchQuery?: string;
}

function tapsEqual(
  a: { x: number; y: number },
  x: number,
  y: number,
): boolean {
  return a.x === x && a.y === y;
}

function cellIndexAt(
  layout: ScreenLayout,
  x: number,
  y: number,
): number | null {
  for (let i = 0; i < 9; i++) {
    const c = layout.boardCells[i]!;
    if (tapsEqual(c, x, y)) return i;
  }
  return null;
}

/**
 * History-driven stub perception. Deterministic for tests.
 * Call setScene() to force a scene (overrides auto inference until cleared).
 */
export class HeuristicPerception implements Perception {
  private readonly layout: ScreenLayout;
  private readonly ourMark: CellMark;
  private readonly searchQuery: string;
  private forced: Scene | null = null;

  constructor(opts: HeuristicPerceptionOptions) {
    this.layout = opts.layout;
    this.ourMark = opts.ourMark ?? "X";
    this.searchQuery = opts.searchQuery ?? "tic tac toe";
  }

  /** Force the next perceive() results until clearScene(). */
  setScene(scene: Scene): void {
    this.forced = {
      ...scene,
      board: scene.board ? cloneBoard(scene.board) : scene.board,
    };
  }

  clearScene(): void {
    this.forced = null;
  }

  /** Current forced scene if any (tests). */
  getForcedScene(): Scene | null {
    return this.forced;
  }

  async perceive(
    _frame: Uint8Array,
    history: Action[],
  ): Promise<Scene> {
    if (this.forced) {
      return {
        ...this.forced,
        board: this.forced.board
          ? cloneBoard(this.forced.board)
          : this.forced.board,
      };
    }
    return this.inferFromHistory(history);
  }

  private inferFromHistory(history: Action[]): Scene {
    const L = this.layout;
    let sawHome = false;
    let sawPlayStore = false;
    let sawSearchField = false;
    let sawTypeQuery = false;
    let sawResult = false;
    let sawInstall = false;
    let sawOpen = false;

    for (const a of history) {
      if (a.op === "keyevent" && a.code === 3) sawHome = true;
      if (a.op === "tap" && tapsEqual(L.playStoreTap, a.x, a.y)) {
        sawPlayStore = true;
      }
      if (a.op === "tap" && tapsEqual(L.searchFieldTap, a.x, a.y)) {
        sawSearchField = true;
      }
      if (a.op === "type" && a.text === this.searchQuery) {
        sawTypeQuery = true;
      }
      if (a.op === "tap" && tapsEqual(L.firstResultTap, a.x, a.y)) {
        sawResult = true;
      }
      if (a.op === "tap" && tapsEqual(L.installTap, a.x, a.y)) {
        sawInstall = true;
      }
      if (a.op === "tap" && tapsEqual(L.openTap, a.x, a.y)) {
        sawOpen = true;
      }
    }

    if (!sawHome && history.length === 0) {
      return { kind: "home" };
    }
    if (!sawPlayStore) {
      return { kind: "home" };
    }
    if (!sawSearchField || !sawTypeQuery) {
      return { kind: "play_store" };
    }
    if (!sawResult) {
      return { kind: "search_results" };
    }
    if (!sawOpen) {
      // After result: show Install unless already "installed" via install tap.
      if (sawInstall) {
        return {
          kind: "app_detail",
          hasInstallButton: false,
          hasOpenButton: true,
        };
      }
      return {
        kind: "app_detail",
        hasInstallButton: true,
        hasOpenButton: false,
      };
    }

    // In game: reconstruct board from cell taps after open.
    return this.simulateGame(history);
  }

  private simulateGame(history: Action[]): Scene {
    const L = this.layout;
    let openIdx = -1;
    for (let i = 0; i < history.length; i++) {
      const a = history[i]!;
      if (a.op === "tap" && tapsEqual(L.openTap, a.x, a.y)) openIdx = i;
    }

    let board: Board = emptyBoard();
    const our = this.ourMark;
    const opp = opponent(our);
    // X always moves first on an empty board.
    let turn: CellMark = "X";

    const afterOpen = history.slice(openIdx + 1);
    for (const a of afterOpen) {
      if (a.op !== "tap") continue;
      const idx = cellIndexAt(L, a.x, a.y);
      if (idx === null || board[idx] !== null) continue;

      // Policy only taps on our turn; treat cell taps as `our` moves.
      // (If ourMark is O, we wait for a weak X opener first — see below.)
      if (turn !== our) {
        // Unexpected: ignore until turn matches (waits handle this).
        continue;
      }
      board = place(board, idx, our);
      let w = winnerOf(board);
      if (w !== null) {
        return {
          kind: "in_game",
          inGame: true,
          board,
          turn: our,
          winner: w,
        };
      }
      turn = opp;

      // Weak opponent reply immediately so the next perceive is our turn again.
      const weak = chooseWeakMove(board);
      if (weak !== null) {
        board = place(board, weak, opp);
        w = winnerOf(board);
        if (w !== null) {
          return {
            kind: "in_game",
            inGame: true,
            board,
            turn: our,
            winner: w,
          };
        }
        turn = our;
      }
    }

    // If we are O, inject a weak X opening move before our first turn.
    if (our === "O" && board.every((c) => c === null)) {
      const weak = chooseWeakMove(board);
      if (weak !== null) {
        board = place(board, weak, "X");
        turn = "O";
      }
    }

    return {
      kind: "in_game",
      inGame: true,
      board,
      turn,
      winner: winnerOf(board),
    };
  }
}
