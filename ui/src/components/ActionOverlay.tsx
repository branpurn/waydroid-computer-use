import type { Action } from '../api/types';

interface Props {
  actions: Action[];
  width: number;
  height: number;
  maxAgeMs?: number;
}

function isTap(
  a: Action,
): a is Action & { op: 'tap'; x: number; y: number } {
  return a.op === 'tap' && typeof (a as { x?: unknown }).x === 'number';
}

function isSwipe(
  a: Action,
): a is Action & {
  op: 'swipe';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const s = a as { x1?: unknown; y1?: unknown; x2?: unknown; y2?: unknown };
  return (
    a.op === 'swipe' &&
    typeof s.x1 === 'number' &&
    typeof s.y1 === 'number' &&
    typeof s.x2 === 'number' &&
    typeof s.y2 === 'number'
  );
}

export function ActionOverlay({
  actions,
  width,
  height,
  maxAgeMs = 15_000,
}: Props) {
  const now = Date.now();
  const recent = actions.filter((a) => now - a.ts <= maxAgeMs).slice(0, 20);

  return (
    <svg
      className="action-overlay"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {recent.map((a) => {
        if (isTap(a)) {
          const age = Math.min(1, (now - a.ts) / maxAgeMs);
          const opacity = 1 - age * 0.7;
          return (
            <g key={a.id} opacity={opacity}>
              <circle
                cx={a.x}
                cy={a.y}
                r={28}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={4}
              />
              <circle cx={a.x} cy={a.y} r={8} fill="var(--accent)" />
              <text
                x={a.x + 36}
                y={a.y + 6}
                fill="var(--accent-soft)"
                fontSize={22}
                fontFamily="ui-monospace, monospace"
              >
                tap
              </text>
            </g>
          );
        }
        if (isSwipe(a)) {
          const age = Math.min(1, (now - a.ts) / maxAgeMs);
          const opacity = 1 - age * 0.7;
          return (
            <g key={a.id} opacity={opacity}>
              <defs>
                <marker
                  id={`arrow-${a.id}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" fill="var(--swipe)" />
                </marker>
              </defs>
              <line
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                stroke="var(--swipe)"
                strokeWidth={5}
                markerEnd={`url(#arrow-${a.id})`}
              />
              <circle cx={a.x1} cy={a.y1} r={6} fill="var(--swipe)" />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
