import { describe, expect, it } from "vitest";
import { AgentLoop } from "./loop.js";
import { StubPolicy } from "./policy.js";
import { StubBackend } from "./backends/stub.js";
import type { Action, InfraAction } from "./actions.js";
import { HttpControlBackend } from "./backends/http_control.js";

describe("AgentLoop + StubBackend + StubPolicy", () => {
  it("runs screenshot → decide → execute until stop; wait is local", async () => {
    const backend = new StubBackend();
    const policy = new StubPolicy();
    const seen: Action[] = [];

    const loop = new AgentLoop({
      backend,
      policy,
      maxSteps: 10,
      onStep: ({ action }) => {
        seen.push(action);
      },
    });

    const result = await loop.run();

    expect(result.stopped).toBe(true);
    expect(result.reason).toBe("stub complete");
    expect(seen.map((a) => a.op)).toEqual(["wait", "tap", "wait", "stop"]);

    // Framing screenshots each step (4) + no explicit screenshot action
    const shots = backend.calls.filter((c) => c.method === "screenshot");
    expect(shots.length).toBe(4);

    const taps = backend.calls.filter((c) => c.method === "tap");
    expect(taps).toEqual([{ method: "tap", x: 100, y: 200 }]);

    // wait must not appear as a backend call
    expect(backend.calls.every((c) => c.method !== "wait" as string)).toBe(true);
  });

  it("stops with maxSteps when policy never stops", async () => {
    const backend = new StubBackend();
    const policy = {
      async decide(): Promise<Action> {
        return { op: "wait", ms: 1 };
      },
    };
    const loop = new AgentLoop({ backend, policy, maxSteps: 3 });
    const result = await loop.run();
    expect(result.stopped).toBe(false);
    expect(result.reason).toBe("maxSteps reached");
    expect(result.steps).toBe(3);
  });
});

describe("HttpControlBackend (mock fetch)", () => {
  it("uses GET /frame for screenshot and POST /action for inputs", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body =
        typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, method, body });

      if (url.endsWith("/frame") && method === "GET") {
        return new Response(png, { status: 200 });
      }
      if (url.endsWith("/action") && method === "POST") {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/health") && method === "GET") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    };

    const backend = new HttpControlBackend({
      baseUrl: "http://control.test",
      fetch: fetchMock,
    });

    await backend.health();
    const frame = await backend.screenshot();
    expect(frame).toEqual(png);

    await backend.tap(10, 20);
    await backend.swipe(0, 0, 50, 50);
    await backend.typeText("hi");
    await backend.keyevent(3);

    expect(calls[0]).toMatchObject({
      url: "http://control.test/health",
      method: "GET",
    });
    expect(calls[1]).toMatchObject({
      url: "http://control.test/frame",
      method: "GET",
    });

    const posted = calls
      .filter((c) => c.method === "POST")
      .map((c) => JSON.parse(c.body!) as InfraAction);
    expect(posted).toEqual([
      { op: "tap", x: 10, y: 20 },
      { op: "swipe", x1: 0, y1: 0, x2: 50, y2: 50, duration_ms: 300 },
      { op: "type", text: "hi" },
      { op: "keyevent", code: 3 },
    ]);
  });

  it("requires baseUrl", () => {
    expect(() => new HttpControlBackend({ baseUrl: "" })).toThrow(/baseUrl/);
  });
});
