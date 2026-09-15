/**
 * Pluggable Waydroid backend. The agent loop never hardcodes tunnels or hosts;
 * callers configure ADB reachability (serial, adb path, etc.) when constructing
 * a concrete backend (e.g. AdbCliBackend).
 *
 * Runtime assumption: Waydroid on Fedora with ADB available to the caller.
 * Connection/target is always configurable via backend options.
 */

export interface WaydroidBackend {
  /** Capture the current display as PNG bytes. */
  screenshot(): Promise<Uint8Array>;

  /** Tap at display coordinates (integers >= 0). */
  tap(x: number, y: number): Promise<void>;

  /**
   * Swipe from (x1,y1) to (x2,y2).
   * durationMs: integer >= 0; backends should default to 300 when omitted
   * (matches Infra control/schema.json).
   */
  swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    durationMs?: number,
  ): Promise<void>;

  /** Type text into the focused input (minLength 1). */
  typeText(text: string): Promise<void>;

  /** Send an Android keyevent (integer code >= 0). */
  keyevent(code: number): Promise<void>;
}
