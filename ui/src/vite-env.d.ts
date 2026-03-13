/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_GEO: string
  readonly VITE_API_INFER: string
  readonly VITE_API_OPTI: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_AZURE_MAPS_KEY?: string
  readonly VITE_PS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
