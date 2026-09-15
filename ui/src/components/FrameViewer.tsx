import { useCallback, useRef } from 'react';
import type { Action } from '../api/types';
import { ActionOverlay } from './ActionOverlay';

interface Props {
  frameUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  actions: Action[];
  tapEnabled: boolean;
  onTap: (x: number, y: number) => void;
  modeLabel: string;
}

/**
 * Map a CSS click on the displayed <img> to natural image pixel coords.
 * Accounts for object-fit: contain letterboxing within the img element box.
 */
export function mapClickToImagePixels(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number } | null {
  const rect = img.getBoundingClientRect();
  const elemW = rect.width;
  const elemH = rect.height;
  if (elemW <= 0 || elemH <= 0 || naturalW <= 0 || naturalH <= 0) return null;

  const scale = Math.min(elemW / naturalW, elemH / naturalH);
  const drawnW = naturalW * scale;
  const drawnH = naturalH * scale;
  const offsetX = (elemW - drawnW) / 2;
  const offsetY = (elemH - drawnH) / 2;

  const localX = clientX - rect.left - offsetX;
  const localY = clientY - rect.top - offsetY;

  if (localX < 0 || localY < 0 || localX > drawnW || localY > drawnH) {
    return null;
  }

  const x = Math.round(localX / scale);
  const y = Math.round(localY / scale);
  return {
    x: Math.max(0, Math.min(naturalW - 1, x)),
    y: Math.max(0, Math.min(naturalH - 1, y)),
  };
}

export function FrameViewer({
  frameUrl,
  frameWidth,
  frameHeight,
  actions,
  tapEnabled,
  onTap,
  modeLabel,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!tapEnabled || !imgRef.current) return;
      const coords = mapClickToImagePixels(
        imgRef.current,
        e.clientX,
        e.clientY,
        frameWidth,
        frameHeight,
      );
      if (coords) onTap(coords.x, coords.y);
    },
    [tapEnabled, onTap, frameWidth, frameHeight],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!tapEnabled) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onTap(Math.floor(frameWidth / 2), Math.floor(frameHeight / 2));
    },
    [tapEnabled, onTap, frameWidth, frameHeight],
  );

  return (
    <div className="frame-panel">
      <div className="frame-toolbar">
        <span className="frame-title">Screen</span>
        <span className="badge" data-mode={modeLabel}>
          {modeLabel}
        </span>
        <span className="muted">
          {frameWidth}×{frameHeight}
          {tapEnabled ? ' · click to tap' : ''}
        </span>
      </div>
      <div
        className={`frame-stage${tapEnabled ? ' tap-enabled' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={tapEnabled ? 'button' : 'img'}
        tabIndex={tapEnabled ? 0 : undefined}
        aria-label={
          tapEnabled
            ? 'Android frame — click to send tap at that pixel'
            : 'Android frame display'
        }
      >
        {frameUrl ? (
          <div className="frame-fit">
            <img
              ref={imgRef}
              src={frameUrl}
              alt="Android screenshot"
              className="frame-img"
              draggable={false}
            />
            <ActionOverlay
              actions={actions}
              width={frameWidth}
              height={frameHeight}
            />
          </div>
        ) : (
          <div className="frame-empty">
            <p>No frame yet</p>
            <p className="muted">Waiting for GET /frame…</p>
          </div>
        )}
      </div>
    </div>
  );
}
