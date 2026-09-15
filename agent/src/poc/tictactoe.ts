/**
 * Perfect-play tic-tac-toe engine and board helpers.
 * Rule order: win > block > center > corner > side (minimax-equivalent for 3x3).
 */

import type { Board, Cell, CellMark } from "./types.js";
import { cloneBoard, emptyBoard } from "./types.js";

export const WIN_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const CENTER = 4;
export const CORNERS = [0, 2, 6, 8] as const;
export const SIDES = [1, 3, 5, 7] as const;

export function opponent(mark: CellMark): CellMark {
  return mark === "X" ? "O" : "X";
}

export function winnerOf(board: Board): CellMark | "draw" | null {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return v;
  }
  if (board.every((c) => c !== null)) return "draw";
  return null;
}

export function emptyCells(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) out.push(i);
  }
  return out;
}

/** Place mark at index; returns a new board (does not mutate). */
export function place(board: Board, index: number, mark: CellMark): Board {
  if (index < 0 || index > 8) {
    throw new RangeError(`cell index out of range: ${index}`);
  }
  if (board[index] !== null) {
    throw new Error(`cell ${index} already occupied`);
  }
  const next = cloneBoard(board);
  next[index] = mark;
  return next;
}

function findWinningMove(board: Board, mark: CellMark): number | null {
  for (const i of emptyCells(board)) {
    const trial = place(board, i, mark);
    if (winnerOf(trial) === mark) return i;
  }
  return null;
}

/**
 * Choose the best move for `mark` on `board`.
 * Perfect play via ordered heuristics (sufficient for 3x3).
 */
export function chooseMove(board: Board, mark: CellMark): number {
  const result = winnerOf(board);
  if (result !== null) {
    throw new Error(`game already over: ${result}`);
  }
  const empties = emptyCells(board);
  if (empties.length === 0) {
    throw new Error("no empty cells");
  }

  const win = findWinningMove(board, mark);
  if (win !== null) return win;

  const block = findWinningMove(board, opponent(mark));
  if (block !== null) return block;

  if (board[CENTER] === null) return CENTER;

  for (const i of CORNERS) {
    if (board[i] === null) return i;
  }

  for (const i of SIDES) {
    if (board[i] === null) return i;
  }

  return empties[0]!;
}

/**
 * Weak opponent for HeuristicPerception simulations: first empty in
 * side → corner → center order (easy to beat with perfect play).
 */
export function chooseWeakMove(board: Board): number | null {
  if (winnerOf(board) !== null) return null;
  for (const i of [...SIDES, ...CORNERS, CENTER]) {
    if (board[i] === null) return i;
  }
  return null;
}

/** Parse a flat 9-char string like "XOX OX  O" (spaces/underscores/dots = empty). */
export function parseBoard(s: string): Board {
  const cleaned = s.replace(/[\s_|-]/g, "");
  if (cleaned.length !== 9) {
    throw new Error(`expected 9 cells, got ${cleaned.length}`);
  }
  const board = emptyBoard();
  for (let i = 0; i < 9; i++) {
    const ch = cleaned[i]!.toUpperCase();
    if (ch === "X" || ch === "O") board[i] = ch;
    else if (ch === "." || ch === "*") board[i] = null;
    else throw new Error(`invalid cell char: ${ch}`);
  }
  return board;
}

export function boardToString(board: Board): string {
  const cell = (c: Cell) => c ?? ".";
  return (
    `${cell(board[0])}${cell(board[1])}${cell(board[2])}/` +
    `${cell(board[3])}${cell(board[4])}${cell(board[5])}/` +
    `${cell(board[6])}${cell(board[7])}${cell(board[8])}`
  );
}
