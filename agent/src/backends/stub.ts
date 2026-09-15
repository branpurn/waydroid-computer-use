import type { WaydroidBackend } from "../backend.js";

/** Minimal 1x1 PNG (valid file header) for stub screenshots. */
const TINY_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02,
  0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

export type StubCall =
  | { method: "screenshot" }
  | { method: "tap"; x: number; y: number }
  | {
      method: "swipe";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs?: number;
    }
  | { method: "typeText"; text: string }
  | { method: "keyevent"; code: number };

/**
 * In-memory backend for unit tests. Records calls; returns a tiny PNG.
 */
export class StubBackend implements WaydroidBackend {
  readonly calls: StubCall[] = [];
  frame: Uint8Array = TINY_PNG.slice();

  async screenshot(): Promise<Uint8Array> {
    this.calls.push({ method: "screenshot" });
    return this.frame.slice();
  }

  async tap(x: number, y: number): Promise<void> {
    this.calls.push({ method: "tap", x, y });
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs?: number,
  ): Promise<void> {
    this.calls.push({ method: "swipe", x1, y1, x2, y2, durationMs });
  }

  async typeText(text: string): Promise<void> {
    this.calls.push({ method: "typeText", text });
  }

  async keyevent(code: number): Promise<void> {
    this.calls.push({ method: "keyevent", code });
  }

  reset(): void {
    this.calls.length = 0;
  }
}
