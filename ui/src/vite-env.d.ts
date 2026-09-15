/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Preferred env var for API base URL. */
  readonly VITE_API_BASE?: string;
  /** Alias accepted for compatibility. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
