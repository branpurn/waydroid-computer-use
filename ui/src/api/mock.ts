import type { Action, HealthResponse } from './types';

const FRAME_W = 720;
const FRAME_H = 1280;

/** Generate a synthetic PNG data-URL (phone-shaped gradient + status chrome). */
export function createMockFrameDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, FRAME_H);
  grad.addColorStop(0, '#1a2332');
  grad.addColorStop(0.5, '#243044');
  grad.addColorStop(1, '#16202e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FRAME_W, FRAME_H);

  // Status bar
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, FRAME_W, 48);
  ctx.fillStyle = '#e8eef7';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('12:00', 24, 32);
  ctx.fillText('Mock · DEMO', FRAME_W - 140, 32);

  // App header
  ctx.fillStyle = '#3d7eff';
  ctx.fillRect(0, 48, FRAME_W, 72);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('Waydroid Demo', 32, 96);

  // Card tiles
  const cards = [
    { x: 40, y: 180, label: 'Settings' },
    { x: 380, y: 180, label: 'Apps' },
    { x: 40, y: 420, label: 'Files' },
    { x: 380, y: 420, label: 'Camera' },
  ];
  for (const c of cards) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, c.x, c.y, 300, 200, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    roundRect(ctx, c.x, c.y, 300, 200, 16);
    ctx.stroke();
    ctx.fillStyle = '#c8d4e8';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(c.label, c.x + 24, c.y + 48);
  }

  // Nav bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, FRAME_H - 80, FRAME_W, 80);
  ctx.fillStyle = '#9ab0cc';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('◁  ○  □', FRAME_W / 2 - 40, FRAME_H - 36);

  // Watermark
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('MOCK MODE', 160, FRAME_H / 2 + 200);

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createMockHealth(): HealthResponse {
  return {
    ok: true,
    runtime: 'mock',
    adb: 'device',
    frame_age_ms: 50,
  };
}

let mockActionSeq = 0;

export function createMockActions(): Action[] {
  const now = Date.now();
  return [
    {
      id: 'mock-1',
      ts: now - 8000,
      op: 'tap',
      x: 190,
      y: 280,
      source: 'agent',
    },
    {
      id: 'mock-2',
      ts: now - 5000,
      op: 'swipe',
      x1: 360,
      y1: 1000,
      x2: 360,
      y2: 400,
      duration_ms: 350,
      source: 'agent',
    },
    {
      id: 'mock-3',
      ts: now - 2500,
      op: 'tap',
      x: 530,
      y: 520,
      source: 'viewer',
    },
    {
      id: 'mock-4',
      ts: now - 1200,
      op: 'type',
      text: 'hello',
      source: 'agent',
    },
    {
      id: 'mock-5',
      ts: now - 400,
      op: 'keyevent',
      code: 3,
      source: 'system',
    },
  ];
}

export function appendMockTap(actions: Action[], x: number, y: number): Action[] {
  mockActionSeq += 1;
  const next: Action = {
    id: `mock-tap-${mockActionSeq}`,
    ts: Date.now(),
    op: 'tap',
    x,
    y,
    source: 'viewer',
  };
  return [next, ...actions].slice(0, 50);
}

export const MOCK_FRAME_SIZE = { width: FRAME_W, height: FRAME_H };
