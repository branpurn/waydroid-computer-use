import type {
  ActionRequest,
  ActionPostResult,
  ActionsResponse,
  HealthResponse,
} from './types';

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '');
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(
  base: string,
  path: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const url = `${normalizeBase(base)}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) detail = body.error;
      } catch {
        /* ignore */
      }
      throw new ApiError(detail || `HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth(base: string): Promise<HealthResponse> {
  return fetchJson<HealthResponse>(base, '/health', undefined, 4000);
}

export async function getActions(
  base: string,
  limit = 50,
): Promise<ActionsResponse> {
  return fetchJson<ActionsResponse>(base, `/actions?limit=${limit}`, undefined, 4000);
}

/**
 * POST /action — synchronous: waits for Infra to apply the op, then returns {ok,...}.
 * Viewer talks directly to the Infra-hosted API base (manual taps included).
 */
export async function postAction(
  base: string,
  body: ActionRequest,
): Promise<ActionPostResult> {
  return fetchJson<ActionPostResult>(
    base,
    '/action',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    15_000,
  );
}

export interface FrameResult {
  blobUrl: string;
  width?: number;
  height?: number;
  ts?: number;
}

/** GET /frame — PNG-only for PoC. Caller must revoke previous blob URL. */
export async function getFrame(
  base: string,
  since?: number,
): Promise<FrameResult | null> {
  const qs = since != null ? `?since=${since}` : '';
  const url = `${normalizeBase(base)}/frame${qs}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'image/png' },
    });
    if (res.status === 304 || res.status === 204 || res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new ApiError(res.statusText || `HTTP ${res.status}`, res.status);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const width = parseOptionalInt(res.headers.get('X-Frame-Width'));
    const height = parseOptionalInt(res.headers.get('X-Frame-Height'));
    const ts = parseOptionalInt(res.headers.get('X-Frame-Ts'));
    return { blobUrl, width, height, ts };
  } finally {
    clearTimeout(timer);
  }
}

function parseOptionalInt(v: string | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
