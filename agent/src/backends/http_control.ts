import type { InfraAction } from "../actions.js";
import { SWIPE_DEFAULT_DURATION_MS } from "../actions.js";
import type { WaydroidBackend } from "../backend.js";

export interface HttpControlBackendOptions {
  /**
   * Base URL of Infra's control API (e.g. http://127.0.0.1:8080).
   * Caller-configured only — no hosts hardcoded in this package.
   */
  baseUrl: string;
  /** Optional fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Optional request timeout in ms (best-effort via AbortSignal). */
  timeoutMs?: number;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Primary WaydroidBackend: HTTP client against Infra's control API.
 *
 * Surface (Infra-owned):
 *   GET  /health   — liveness
 *   GET  /frame    — current display as PNG bytes (used for agent screenshots)
 *   GET  /actions  — discover/list supported actions
 *   POST /action   — body is one control/schema.json Infra action
 *                    (screenshot | tap | swipe | type | keyevent)
 *
 * Frames for the decision loop come from GET /frame.
 * Input ops go through POST /action only — no second action path.
 */
export class HttpControlBackend implements WaydroidBackend {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs?: number;

  constructor(opts: HttpControlBackendOptions) {
    if (!opts.baseUrl || typeof opts.baseUrl !== "string") {
      throw new Error("HttpControlBackend requires baseUrl");
    }
    this.baseUrl = opts.baseUrl;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs;
  }

  private signal(): AbortSignal | undefined {
    if (this.timeoutMs == null) return undefined;
    return AbortSignal.timeout(this.timeoutMs);
  }

  /** GET /health — Infra control API liveness. */
  async health(): Promise<unknown> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, "/health"), {
      method: "GET",
      signal: this.signal(),
    });
    if (!res.ok) {
      throw new Error(`GET /health failed: ${res.status} ${res.statusText}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  /** GET /actions — discover/list supported actions. */
  async listActions(): Promise<unknown> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, "/actions"), {
      method: "GET",
      signal: this.signal(),
    });
    if (!res.ok) {
      throw new Error(`GET /actions failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Agent-loop screenshot: GET /frame → PNG bytes.
   * Does not use POST /action {op:screenshot} for framing.
   */
  async screenshot(): Promise<Uint8Array> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, "/frame"), {
      method: "GET",
      signal: this.signal(),
    });
    if (!res.ok) {
      throw new Error(`GET /frame failed: ${res.status} ${res.statusText}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf;
  }

  /** POST /action with a single Infra action body. */
  async postAction(action: InfraAction): Promise<void> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, "/action"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action),
      signal: this.signal(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `POST /action failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
      );
    }
  }

  async tap(x: number, y: number): Promise<void> {
    await this.postAction({ op: "tap", x, y });
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs?: number,
  ): Promise<void> {
    await this.postAction({
      op: "swipe",
      x1,
      y1,
      x2,
      y2,
      duration_ms: durationMs ?? SWIPE_DEFAULT_DURATION_MS,
    });
  }

  async typeText(text: string): Promise<void> {
    if (text.length < 1) {
      throw new Error("type text must have minLength 1 (control/schema.json)");
    }
    await this.postAction({ op: "type", text });
  }

  async keyevent(code: number): Promise<void> {
    if (!Number.isInteger(code) || code < 0) {
      throw new Error("keyevent code must be integer >= 0 (control/schema.json)");
    }
    await this.postAction({ op: "keyevent", code });
  }
}
