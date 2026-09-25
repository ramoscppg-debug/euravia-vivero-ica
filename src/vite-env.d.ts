/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  // SUNAT / Facturación Electrónica
  readonly VITE_SUNAT_MODO: 'BETA' | 'PRODUCCION'
  readonly VITE_SUNAT_RUC: string
  readonly VITE_SUNAT_RAZON_SOCIAL: string
  readonly VITE_SUNAT_USUARIO_SOL: string
  readonly VITE_SUNAT_CLAVE_SOL: string
  readonly VITE_SUNAT_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
