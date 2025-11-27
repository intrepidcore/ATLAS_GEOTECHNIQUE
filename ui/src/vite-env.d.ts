/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_GEO: string
  readonly VITE_API_INFER: string
  readonly VITE_API_OPTI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
