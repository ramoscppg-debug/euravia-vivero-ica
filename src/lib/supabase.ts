import type { SupabaseClient } from '@supabase/supabase-js';

// Proyecto de producción. La llave "anon" es pública por diseño (va dentro de la página de todos modos);
// lo que protege los datos es RLS en la base. Si se rota la llave en Supabase, actualizarla aquí.
const PROYECTO_URL = 'https://raykielxrilylzcrwnhf.supabase.co';
const PROYECTO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheWtpZWx4cmlseWx6Y3J3bmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyODEyNjMsImV4cCI6MjEwNTg1NzI2M30.Vu0YdBt-VFfzS9gCwXPZW2R7dnIv0Ex_z-Af9eeOOnI';

// Una variable definida (aunque sea vacía) manda: las pruebas E2E la ponen en '' para forzar el modo demo.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? PROYECTO_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? PROYECTO_ANON_KEY;

/**
 * `true` sólo cuando hay credenciales reales configuradas en el `.env`.
 * Cuando es `false`, la app funciona en modo demo (datos en el navegador, sin login):
 * el SDK de Supabase ni siquiera se descarga.
 */
export const isSupabaseConfigured =
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('tu-proyecto') &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes('placeholder') &&
  !supabaseAnonKey.includes('anon-key-publica');

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Carga perezosa del cliente: el SDK `@supabase/supabase-js` se importa vía
 * `import()` sólo la primera vez que se necesita y sólo si hay credenciales,
 * manteniendo el bundle principal ligero.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey)
    );
  }
  return clientPromise;
}
