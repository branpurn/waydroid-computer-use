import { spawn } from "node:child_process";
import { SWIPE_DEFAULT_DURATION_MS } from "../actions.js";
import type { WaydroidBackend } from "../backend.js";

/**
 * OPTIONAL / DEV FALLBACK only — not the primary contract.
 *
 * Production and Infra integration use HttpControlBackend against the
 * control HTTP API (GET /frame, POST /action). Prefer that.
 *
 * This backend invokes a local primitives script for offline/dev debugging
 * when the HTTP control API is unavailable. ADB reachability is entirely
 * caller-configured; nothing here opens tunnels or hardcodes hosts.
 */
export interface AdbCliBackendOptions {
  /** Path to a local primitives wrapper script (dev only). */
  primitivesScript: string;
  adbBin?: string;
  deviceSerial?: string;
  env?: NodeJS.ProcessEnv;
}

function run(
  script: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(script, args, {
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => stdout.push(c));
    child.stderr.on("data", (c: Buffer) => stderr.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${script} ${args.join(" ")} exited ${code}: ${Buffer.concat(stderr).toString("utf8")}`,
          ),
        );
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

/** @deprecated Prefer HttpControlBackend — this is a dev fallback only. */
export class AdbCliBackend implements WaydroidBackend {
  private readonly primitivesScript: string;
  private readonly baseEnv: NodeJS.ProcessEnv;

  constructor(opts: AdbCliBackendOptions) {
    if (!opts.primitivesScript) {
      throw new Error("AdbCliBackend requires primitivesScript");
    }
    this.primitivesScript = opts.primitivesScript;
    this.baseEnv = { ...opts.env };
    if (opts.adbBin) {
      this.baseEnv.ADB_BIN = opts.adbBin;
    }
    if (opts.deviceSerial) {
      this.baseEnv.ANDROID_SERIAL = opts.deviceSerial;
      this.baseEnv.ADB_SERIAL = opts.deviceSerial;
    }
  }

  async screenshot(): Promise<Uint8Array> {
    const buf = await run(this.primitivesScript, ["screenshot"], {
      env: this.baseEnv,
    });
    return new Uint8Array(buf);
  }

  async tap(x: number, y: number): Promise<void> {
    await run(this.primitivesScript, ["tap", String(x), String(y)], {
      env: this.baseEnv,
    });
  }

  async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs?: number,
  ): Promise<void> {
    const ms = durationMs ?? SWIPE_DEFAULT_DURATION_MS;
    await run(
      this.primitivesScript,
      ["swipe", String(x1), String(y1), String(x2), String(y2), String(ms)],
      { env: this.baseEnv },
    );
  }

  async typeText(text: string): Promise<void> {
    if (text.length < 1) {
      throw new Error("type text must have minLength 1 (control/schema.json)");
    }
    await run(this.primitivesScript, ["type", text], { env: this.baseEnv });
  }

  async keyevent(code: number): Promise<void> {
    if (!Number.isInteger(code) || code < 0) {
      throw new Error("keyevent code must be integer >= 0 (control/schema.json)");
    }
    await run(this.primitivesScript, ["keyevent", String(code)], {
      env: this.baseEnv,
    });
  }
}
