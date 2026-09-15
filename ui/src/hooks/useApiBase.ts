import { useCallback, useState } from 'react';

const STORAGE_KEY = 'waydroid-viewer-api-base';

/** Prefer VITE_API_BASE; accept VITE_API_BASE_URL as alias. */
function defaultBase(): string {
  const preferred = import.meta.env.VITE_API_BASE;
  const alias = import.meta.env.VITE_API_BASE_URL;
  const raw =
    typeof preferred === 'string' && preferred.trim()
      ? preferred
      : typeof alias === 'string' && alias.trim()
        ? alias
        : 'http://localhost:8787';
  return raw.trim().replace(/\/+$/, '');
}

function readStored(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export function useApiBase() {
  const [baseUrl, setBaseUrlState] = useState(() => readStored() ?? defaultBase());

  const setBaseUrl = useCallback((next: string) => {
    const cleaned = next.trim().replace(/\/+$/, '');
    setBaseUrlState(cleaned);
    try {
      localStorage.setItem(STORAGE_KEY, cleaned);
    } catch {
      /* private mode etc. */
    }
  }, []);

  const resetToEnv = useCallback(() => {
    setBaseUrl(defaultBase());
  }, [setBaseUrl]);

  return { baseUrl, setBaseUrl, resetToEnv, envDefault: defaultBase() };
}
