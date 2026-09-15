import type { Action } from '../api/types';

interface Props {
  actions: Action[];
}

function formatAction(a: Action): string {
  switch (a.op) {
    case 'tap': {
      const t = a as { x?: number; y?: number };
      return `tap (${t.x}, ${t.y})`;
    }
    case 'swipe': {
      const s = a as {
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
        duration_ms?: number;
      };
      return `swipe (${s.x1},${s.y1})→(${s.x2},${s.y2})${
        s.duration_ms != null ? ` ${s.duration_ms}ms` : ''
      }`;
    }
    case 'type': {
      const t = a as { text?: string };
      return `type "${t.text ?? ''}"`;
    }
    case 'keyevent': {
      const k = a as { code?: number };
      return `keyevent ${k.code ?? '?'}`;
    }
    case 'screenshot':
      return 'screenshot';
    default: {
      const fallback = a as { op: string };
      return fallback.op;
    }
  }
}

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 1000) return 'just now';
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export function ActionsList({ actions }: Props) {
  return (
    <section className="actions-panel" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Last actions</h2>
      {actions.length === 0 ? (
        <p className="muted empty-hint">No actions yet</p>
      ) : (
        <ul className="actions-list">
          {actions.map((a) => (
            <li key={a.id} className="action-row">
              <span className={`op-pill op-${a.op}`}>{a.op}</span>
              <span className="action-detail">{formatAction(a)}</span>
              <span className="action-meta">
                {a.source ? `${a.source} · ` : ''}
                {relativeTime(a.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
