import type { ConnectionMode, HealthResponse } from '../api/types';

interface Props {
  mode: ConnectionMode;
  health: HealthResponse | null;
  baseUrl: string;
  error: string | null;
  onEnableMock: () => void;
}

export function StatusBar({
  mode,
  health,
  baseUrl,
  error,
  onEnableMock,
}: Props) {
  const label =
    mode === 'live'
      ? 'Connected'
      : mode === 'mock'
        ? 'Mock / demo'
        : 'Disconnected';

  return (
    <header className="status-bar" role="status" aria-live="polite">
      <div className="status-left">
        <span className={`status-dot status-${mode}`} aria-hidden="true" />
        <strong>{label}</strong>
        {health?.runtime && (
          <span className="muted">runtime: {health.runtime}</span>
        )}
        {health?.adb && <span className="muted">adb: {health.adb}</span>}
        {health?.frame_age_ms != null && mode === 'live' && (
          <span className="muted">frame age: {health.frame_age_ms}ms</span>
        )}
      </div>
      <div className="status-right">
        <code className="base-url" title="API base URL">
          {baseUrl}
        </code>
        {error && mode !== 'live' && (
          <span className="error-chip" title={error}>
            {error}
          </span>
        )}
        {mode !== 'mock' && (
          <button type="button" className="btn btn-ghost" onClick={onEnableMock}>
            Use mock
          </button>
        )}
      </div>
    </header>
  );
}
