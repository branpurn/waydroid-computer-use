import { describe, expect, it } from "vitest";
import { AgentLoop } from "../loop.js";
import { StubBackend } from "../backends/stub.js";
import type { Action } from "../actions.js";
import { isInfraAction, isStopAction, isWaitAction } from "../actions.js";
import { HeuristicPerception } from "./perception.js";
import {
  chooseMove,
  parseBoard,
  place,
  winnerOf,
  boardToString,
} from "./tictactoe.js";
import { TicTacToePocPolicy } from "./tic_tac_toe_poc_policy.js";
import {
  WIN_REASON,
  type ScreenLayout,
  emptyBoard,
} from "./types.js";

/** Deterministic fixture layout (not tied to any lab device). */
const LAYOUT: ScreenLayout = {
  playStoreTap: { x: 100, y: 200 },
  searchFieldTap: { x: 300, y: 80 },
  firstResultTap: { x: 300, y: 400 },
  installTap: { x: 500, y: 900 },
  openTap: { x: 500, y: 950 },
  boardCells: [
    { x: 100, y: 300 },
    { x: 200, y: 300 },
    { x: 300, y: 300 },
    { x: 100, y: 400 },
    { x: 200, y: 400 },
    { x: 300, y: 400 },
    { x: 100, y: 500 },
    { x: 200, y: 500 },
    { x: 300, y: 500 },
  ],
};

describe("perfect-play engine", () => {
  it("takes an immediate winning move", () => {
    // X X _ / O O _ / _ _ _
    const board = parseBoard("XX.OO....");
    expect(chooseMove(board, "X")).toBe(2);
  });

  it("blocks opponent win", () => {
    // O O _ / X _ _ / X _ _
    const board = parseBoard("OO.X..X..");
    expect(chooseMove(board, "X")).toBe(2);
  });

  it("prefers center on empty board", () => {
    expect(chooseMove(emptyBoard(), "X")).toBe(4);
  });

  it("prefers corner when center taken", () => {
    const board = place(emptyBoard(), 4, "O");
    expect(chooseMove(board, "X")).toBe(0);
  });

  it("winnerOf detects rows and draw", () => {
    expect(winnerOf(parseBoard("XXX......"))).toBe("X");
    expect(winnerOf(parseBoard("XOXOXOOXO"))).toBe("draw");
    expect(winnerOf(emptyBoard())).toBe(null);
  });

  it("boardToString round-trips empties", () => {
    const b = parseBoard("X.O.X.O.X");
    expect(boardToString(b)).toBe("X.O/.X./O.X");
  });
});

describe("TicTacToePocPolicy + HeuristicPerception", () => {
  it("reaches stop with win reason on a winnable simulated game", async () => {
    const perception = new HeuristicPerception({
      layout: LAYOUT,
      ourMark: "X",
      searchQuery: "tic tac toe",
    });
    const policy = new TicTacToePocPolicy({
      layout: LAYOUT,
      ourMark: "X",
      perception,
      settleMs: 1,
      maxPlayMoves: 9,
    });
    const backend = new StubBackend();

    const loop = new AgentLoop({
      backend,
      policy,
      maxSteps: 80,
    });

    const result = await loop.run();

    expect(result.stopped).toBe(true);
    expect(result.reason).toBe(WIN_REASON);
    expect(policy.getPhase()).toBe("done");

    // Setup path used infra ops
    const ops = result.history.map((a) => a.op);
    expect(ops).toContain("keyevent");
    expect(ops).toContain("type");
    expect(ops).toContain("tap");
    expect(ops[ops.length - 1]).toBe("stop");
  });

  it("does not POST wait/stop as infra (loop-local only)", async () => {
    const perception = new HeuristicPerception({
      layout: LAYOUT,
      ourMark: "X",
    });
    const policy = new TicTacToePocPolicy({
      layout: LAYOUT,
      perception,
      settleMs: 1,
    });
    const backend = new StubBackend();
    const loop = new AgentLoop({ backend, policy, maxSteps: 80 });
    const result = await loop.run();

    expect(result.stopped).toBe(true);

    // Backend never sees wait/stop — only screenshot + infra verbs.
    for (const c of backend.calls) {
      expect(c.method).not.toBe("wait");
      expect(c.method).not.toBe("stop");
    }

    // Policy may return wait/stop; classify correctly.
    let sawWait = false;
    let sawStop = false;
    for (const a of result.history) {
      if (isWaitAction(a)) {
        sawWait = true;
        expect(isInfraAction(a)).toBe(false);
      }
      if (isStopAction(a)) {
        sawStop = true;
        expect(isInfraAction(a)).toBe(false);
      }
    }
    expect(sawWait).toBe(true);
    expect(sawStop).toBe(true);
  });

  it("types the configured search query", async () => {
    const query = "tic tac toe free";
    const policy = new TicTacToePocPolicy({
      layout: LAYOUT,
      searchQuery: query,
      settleMs: 1,
      perception: new HeuristicPerception({
        layout: LAYOUT,
        searchQuery: query,
      }),
    });
    const backend = new StubBackend();
    await new AgentLoop({ backend, policy, maxSteps: 80 }).run();

    const typed = backend.calls.filter((c) => c.method === "typeText");
    expect(typed.some((c) => c.method === "typeText" && c.text === query)).toBe(
      true,
    );
  });

  it("can be forced via setScene for install→open path", async () => {
    const perception = new HeuristicPerception({ layout: LAYOUT });
    const policy = new TicTacToePocPolicy({
      layout: LAYOUT,
      perception,
      settleMs: 1,
    });

    const frame = new Uint8Array([0]);
    const history: Action[] = [];

    // Drive manually through early phases until install_or_open
    for (let i = 0; i < 20; i++) {
      const a = await policy.decide(frame, history);
      history.push(a);
      if (policy.getPhase() === "install_or_open") break;
      if (a.op === "stop") break;
    }
    expect(policy.getPhase()).toBe("install_or_open");

    perception.setScene({
      kind: "app_detail",
      hasInstallButton: true,
      hasOpenButton: false,
    });
    const install = await policy.decide(frame, history);
    expect(install).toEqual({
      op: "tap",
      x: LAYOUT.installTap.x,
      y: LAYOUT.installTap.y,
    });
    history.push(install);

    perception.setScene({
      kind: "app_detail",
      hasInstallButton: false,
      hasOpenButton: true,
    });
    // wait after install
    const w = await policy.decide(frame, history);
    expect(w.op).toBe("wait");
    history.push(w);

    const open = await policy.decide(frame, history);
    expect(open).toEqual({
      op: "tap",
      x: LAYOUT.openTap.x,
      y: LAYOUT.openTap.y,
    });
  });

  it("HOME keyevent uses code 3", async () => {
    const policy = new TicTacToePocPolicy({
      layout: LAYOUT,
      settleMs: 1,
      perception: new HeuristicPerception({ layout: LAYOUT }),
    });
    const a = await policy.decide(new Uint8Array(), []);
    expect(a).toEqual({ op: "keyevent", code: 3 });
  });
});
