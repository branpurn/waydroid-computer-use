import { useEffect, useState } from 'react';

interface Props {
  baseUrl: string;
  envDefault: string;
  onSave: (url: string) => void;
  onReset: () => void;
  mockForced: boolean;
  onToggleMock: (forced: boolean) => void;
}

export function SettingsPanel({
  baseUrl,
  envDefault,
  onSave,
  onReset,
  mockForced,
  onToggleMock,
}: Props) {
  const [draft, setDraft] = useState(baseUrl);

  useEffect(() => {
    setDraft(baseUrl);
  }, [baseUrl]);

  return (
    <section className="settings-panel" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Connection</h2>
      <label className="field" htmlFor="api-base">
        <span>API base URL</span>
        <input
          id="api-base"
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() && draft.trim() !== baseUrl) onSave(draft);
          }}
          placeholder={envDefault}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSave(draft)}
        >
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset to env
        </button>
      </div>
      <p className="muted hint">
        Env default (<code>VITE_API_BASE</code>): <code>{envDefault}</code> ·
        persisted in localStorage
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={mockForced}
          onChange={(e) => onToggleMock(e.target.checked)}
        />
        <span>Force mock / demo mode</span>
      </label>
    </section>
  );
}
