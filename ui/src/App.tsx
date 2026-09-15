import { useCallback, useState } from 'react';
import { ActionsList } from './components/ActionsList';
import { FrameViewer } from './components/FrameViewer';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { useApiBase } from './hooks/useApiBase';
import { useViewerData } from './hooks/useViewerData';

export default function App() {
  const { baseUrl, setBaseUrl, resetToEnv, envDefault } = useApiBase();
  const [mockForced, setMockForced] = useState(false);
  const [tapBusy, setTapBusy] = useState(false);
  const [tapMsg, setTapMsg] = useState<string | null>(null);

  const {
    mode,
    health,
    frameUrl,
    frameWidth,
    frameHeight,
    actions,
    error,
    sendAction,
    enableMock,
  } = useViewerData(baseUrl, mockForced);

  const handleTap = useCallback(
    async (x: number, y: number) => {
      if (tapBusy) return;
      setTapBusy(true);
      setTapMsg(null);
      const res = await sendAction({ op: 'tap', x, y });
      setTapBusy(false);
      if (!res.ok) {
        setTapMsg(res.error ?? 'tap failed');
      } else {
        setTapMsg(`tap (${x}, ${y})`);
        window.setTimeout(() => setTapMsg(null), 2000);
      }
    },
    [tapBusy, sendAction],
  );

  const modeLabel =
    mode === 'live' ? 'LIVE' : mode === 'mock' ? 'MOCK' : 'OFFLINE';

  return (
    <div className="app">
      <StatusBar
        mode={mode}
        health={health}
        baseUrl={baseUrl}
        error={error}
        onEnableMock={() => {
          setMockForced(true);
          enableMock();
        }}
      />

      <main className="layout">
        <FrameViewer
          frameUrl={frameUrl}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          actions={actions}
          tapEnabled={!tapBusy && (mode === 'live' || mode === 'mock')}
          onTap={(x, y) => void handleTap(x, y)}
          modeLabel={modeLabel}
        />

        <aside className="sidebar">
          <SettingsPanel
            baseUrl={baseUrl}
            envDefault={envDefault}
            onSave={setBaseUrl}
            onReset={resetToEnv}
            mockForced={mockForced}
            onToggleMock={setMockForced}
          />
          <ActionsList actions={actions} />
          {tapMsg && (
            <p className="tap-feedback" role="status">
              {tapMsg}
            </p>
          )}
        </aside>
      </main>

      <footer className="app-footer">
        <span>Waydroid computer-use viewer</span>
        <span className="muted">
          Polls Infra API · PNG frames · sync POST /action
        </span>
      </footer>
    </div>
  );
}
