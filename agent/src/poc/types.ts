/**
 * PoC types for TicTacToePocPolicy — phases, board, and layout config.
 * Layout coordinates are caller-configured; no lab-specific defaults.
 */

export type CellMark = "X" | "O";
export type Cell = CellMark | null;

/** Row-major 3x3 board: indices 0..8 = TL, TC, TR, ML, MC, MR, BL, BC, BR. */
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

export type PocPhase =
  | "ensure_home"
  | "open_play_store"
  | "search"
  | "open_result"
  | "install_or_open"
  | "await_game"
  | "play"
  | "done";

export interface TapPoint {
  x: number;
  y: number;
}

/**
 * Configurable on-screen targets. Callers must supply coordinates that match
 * the device/emulator resolution and launcher layout under test.
 */
export interface ScreenLayout {
  /** Home-screen Play Store icon (or folder entry). */
  playStoreTap: TapPoint;
  /** Play Store search field. */
  searchFieldTap: TapPoint;
  /** First search result row. */
  firstResultTap: TapPoint;
  /** Install button on the app detail page. */
  installTap: TapPoint;
  /** Open button on the app detail page (post-install or already installed). */
  openTap: TapPoint;
  /**
   * Nine board cell centers, row-major (0=TL … 8=BR).
   * Used by the policy to tap moves; also used by HeuristicPerception to map taps.
   */
  boardCells: [
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
    TapPoint,
  ];
  /**
   * Optional swipe used when Play Store is not on the first home page.
   * If set, open_play_store may swipe before tapping.
   */
  findPlayStoreSwipe?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    duration_ms?: number;
  };
}

/** High-level UI scene returned by Perception (pluggable). */
export type SceneKind =
  | "home"
  | "play_store"
  | "search_results"
  | "app_detail"
  | "in_game"
  | "unknown";

export interface Scene {
  kind: SceneKind;
  /** App detail: Install button visible. */
  hasInstallButton?: boolean;
  /** App detail: Open button visible. */
  hasOpenButton?: boolean;
  /** True when a tic-tac-toe board is visible and interactive. */
  inGame?: boolean;
  /** Current board when in_game / game over. */
  board?: Board;
  /** Whose turn it is when in_game. */
  turn?: CellMark;
  /** Terminal result if the match ended. */
  winner?: CellMark | "draw" | null;
}

export const KEYCODE_HOME = 3;
export const KEYCODE_BACK = 4;
export const KEYCODE_APP_SWITCH = 187;

export const DEFAULT_SEARCH_QUERY = "tic tac toe";

export const WIN_REASON = "poc: tic-tac-toe win";

export function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

export function cloneBoard(board: Board): Board {
  return [...board] as Board;
}
