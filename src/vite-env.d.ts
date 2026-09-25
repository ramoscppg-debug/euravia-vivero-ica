/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  // SUNAT / Facturación Electrónica
  readonly VITE_SUNAT_MODO: 'BETA' | 'PRODUCCION'
  readonly VITE_SUNAT_RUC: string
  readonly VITE_SUNAT_RAZON_SOCIAL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
