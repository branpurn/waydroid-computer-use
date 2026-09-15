/** Action ops aligned with architecture schema. */
export type ActionOp = 'screenshot' | 'tap' | 'swipe' | 'type' | 'keyevent';

export type ActionSource = 'agent' | 'viewer' | 'system';

export type AdbStatus = 'device' | 'offline' | 'none' | 'unknown';

export interface HealthResponse {
  ok: boolean;
  runtime?: string;
  adb?: AdbStatus | string;
  frame_age_ms?: number;
  error?: string;
}

/** Recent action record from GET /actions (fields vary by op). */
export interface Action {
  id: string;
  ts: number;
  op: ActionOp | string;
  source?: ActionSource | string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  duration_ms?: number;
  text?: string;
  code?: number;
  [key: string]: unknown;
}

export interface ActionsResponse {
  actions: Action[];
}

export interface ActionPostResult {
  ok: boolean;
  id?: string;
  ts?: number;
  error?: string;
}

/** POST /action request bodies */
export type ActionRequest =
  | { op: 'tap'; x: number; y: number }
  | { op: 'swipe'; x1: number; y1: number; x2: number; y2: number; duration_ms?: number }
  | { op: 'type'; text: string }
  | { op: 'keyevent'; code: number }
  | { op: 'screenshot' };

export type ConnectionMode = 'live' | 'disconnected' | 'mock';
