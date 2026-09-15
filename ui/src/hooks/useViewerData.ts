import { useCallback, useEffect, useRef, useState } from 'react';
import { getActions, getFrame, getHealth, postAction } from '../api/client';
import {
  appendMockTap,
  createMockActions,
  createMockFrameDataUrl,
  createMockHealth,
  MOCK_FRAME_SIZE,
} from '../api/mock';
import type {
  Action,
  ActionRequest,
  ConnectionMode,
  HealthResponse,
} from '../api/types';

const HEALTH_MS = 2000;
const FRAME_MS = 750;
const ACTIONS_MS = 1500;

interface ViewerState {
  mode: ConnectionMode;
  health: HealthResponse | null;
  frameUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  frameTs?: number;
  actions: Action[];
  error: string | null;
  mockForced: boolean;
}

export function useViewerData(baseUrl: string, mockForced: boolean) {
  const [state, setState] = useState<ViewerState>({
    mode: mockForced ? 'mock' : 'disconnected',
    health: null,
    frameUrl: null,
    frameWidth: MOCK_FRAME_SIZE.width,
    frameHeight: MOCK_FRAME_SIZE.height,
    actions: [],
    error: null,
    mockForced,
  });

  const blobUrlRef = useRef<string | null>(null);
  const frameTsRef = useRef<number | undefined>(undefined);
  const mockActionsRef = useRef<Action[]>(createMockActions());
  const aliveRef = useRef(true);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const enterMock = useCallback(
    (reason?: string) => {
      revokeBlob();
      const dataUrl = createMockFrameDataUrl();
      mockActionsRef.current = createMockActions();
      setState((s) => ({
        ...s,
        mode: 'mock',
        health: createMockHealth(),
        frameUrl: dataUrl,
        frameWidth: MOCK_FRAME_SIZE.width,
        frameHeight: MOCK_FRAME_SIZE.height,
        frameTs: Date.now(),
        actions: mockActionsRef.current,
        error: reason ?? null,
        mockForced,
      }));
    },
    [mockForced, revokeBlob],
  );

  // Health poll
  useEffect(() => {
    aliveRef.current = true;

    if (mockForced) {
      enterMock();
      return () => {
        aliveRef.current = false;
      };
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const health = await getHealth(baseUrl);
        if (cancelled || !aliveRef.current) return;
        setState((s) => ({
          ...s,
          mode: health.ok ? 'live' : 'disconnected',
          health,
          error: health.ok ? null : (health.error ?? 'not ready'),
          mockForced: false,
        }));
      } catch (e) {
        if (cancelled || !aliveRef.current) return;
        setState((s) => {
          // Auto-fallback to mock if we have no live frame yet
          if (s.mode === 'live' && s.frameUrl && !s.frameUrl.startsWith('data:')) {
            return {
              ...s,
              mode: 'disconnected',
              health: { ok: false },
              error: e instanceof Error ? e.message : 'unreachable',
            };
          }
          return s;
        });
        // If never connected, drop into mock for offline UX
        setState((s) => {
          if (s.mode === 'mock') return s;
          if (s.mode === 'live') {
            return {
              ...s,
              mode: 'disconnected',
              health: { ok: false },
              error: e instanceof Error ? e.message : 'unreachable',
            };
          }
          // disconnected / initial → mock
          revokeBlob();
          const dataUrl = createMockFrameDataUrl();
          mockActionsRef.current = createMockActions();
          return {
            ...s,
            mode: 'mock',
            health: createMockHealth(),
            frameUrl: dataUrl,
            frameWidth: MOCK_FRAME_SIZE.width,
            frameHeight: MOCK_FRAME_SIZE.height,
            frameTs: Date.now(),
            actions: mockActionsRef.current,
            error: e instanceof Error ? e.message : 'API unreachable — mock mode',
            mockForced: false,
          };
        });
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), HEALTH_MS);
    return () => {
      cancelled = true;
      aliveRef.current = false;
      window.clearInterval(id);
    };
  }, [baseUrl, mockForced, enterMock, revokeBlob]);

  // Frame poll (live only)
  useEffect(() => {
    if (mockForced || state.mode === 'mock') return;
    if (state.mode !== 'live') return;

    let cancelled = false;

    const tick = async () => {
      try {
        const result = await getFrame(baseUrl, frameTsRef.current);
        if (cancelled || !aliveRef.current) {
          if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl);
          return;
        }
        if (!result) return;

        revokeBlob();
        blobUrlRef.current = result.blobUrl;
        if (result.ts != null) frameTsRef.current = result.ts;

        // Probe natural size if headers missing
        let w = result.width;
        let h = result.height;
        if (w == null || h == null) {
          const dims = await loadImageDims(result.blobUrl);
          w = dims.width;
          h = dims.height;
        }

        setState((s) => ({
          ...s,
          frameUrl: result.blobUrl,
          frameWidth: w ?? s.frameWidth,
          frameHeight: h ?? s.frameHeight,
          frameTs: result.ts ?? Date.now(),
          error: null,
        }));
      } catch {
        /* health loop handles disconnect */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), FRAME_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [baseUrl, mockForced, state.mode, revokeBlob]);

  // Actions poll (live only)
  useEffect(() => {
    if (mockForced || state.mode !== 'live') return;

    let cancelled = false;

    const tick = async () => {
      try {
        const { actions } = await getActions(baseUrl, 50);
        if (cancelled || !aliveRef.current) return;
        setState((s) => ({ ...s, actions }));
      } catch {
        /* ignore transient */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), ACTIONS_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [baseUrl, mockForced, state.mode]);

  // Cleanup blob on unmount / base change
  useEffect(() => {
    return () => {
      revokeBlob();
    };
  }, [baseUrl, revokeBlob]);

  const sendAction = useCallback(
    async (body: ActionRequest) => {
      if (state.mode === 'mock' || mockForced) {
        if (body.op === 'tap') {
          mockActionsRef.current = appendMockTap(
            mockActionsRef.current,
            body.x,
            body.y,
          );
          setState((s) => ({ ...s, actions: mockActionsRef.current }));
        }
        return { ok: true as const };
      }
      try {
        const res = await postAction(baseUrl, body);
        // Optimistic local marker for tap
        if (body.op === 'tap' && res.ok) {
          const optimistic: Action = {
            id: res.id ?? `local-${Date.now()}`,
            ts: res.ts ?? Date.now(),
            op: 'tap',
            x: body.x,
            y: body.y,
            source: 'viewer',
          };
          setState((s) => ({
            ...s,
            actions: [optimistic, ...s.actions].slice(0, 50),
          }));
        }
        return res;
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : 'failed',
        };
      }
    },
    [baseUrl, mockForced, state.mode],
  );

  const enableMock = useCallback(() => {
    enterMock('Mock mode enabled manually');
  }, [enterMock]);

  return {
    ...state,
    sendAction,
    enableMock,
  };
}

function loadImageDims(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth || 720, height: img.naturalHeight || 1280 });
    img.onerror = () => resolve({ width: 720, height: 1280 });
    img.src = url;
  });
}
