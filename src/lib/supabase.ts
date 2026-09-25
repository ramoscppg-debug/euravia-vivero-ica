import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * `true` sólo cuando hay credenciales reales configuradas en el `.env`.
 * Cuando es `false`, la app funciona 100% en memoria (modo demo / offline):
 * el SDK de Supabase ni siquiera se descarga y las funciones de sincronización
 * se convierten en no-ops silenciosos.
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
async function getClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey)
    );
  }
  return clientPromise;
}

type SyncResult = { data: unknown; error: unknown; skipped?: boolean };
const skipped: SyncResult = { data: null, error: null, skipped: true };

/**
 * Servicios de sincronización con Supabase para VIVERO 360°.
 * Todas las operaciones toleran la ausencia de backend: si Supabase no está
 * configurado devuelven `{ skipped: true }` sin lanzar ni ensuciar la consola.
 */
export const ViveroApi = {
  get isOnline() {
    return isSupabaseConfigured;
  },

  // Obtener todos los productos y stock
  async getProducts() {
    const supabase = await getClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) console.warn('[Supabase] getProducts:', error.message);
    return data || [];
  },

  // Registrar un movimiento en el Kardex
  async addKardexMovement(movement: {
    producto_sku: string;
    tipo_movimiento: string;
    cantidad_entrada: number;
    cantidad_salida: number;
    saldo_resultante: number;
    costo_unitario: number;
    documento_referencia?: string;
    usuario_responsable: string;
  }): Promise<SyncResult> {
    const supabase = await getClient();
    if (!supabase) return skipped;
    const { data, error } = await supabase
      .from('kardex_movimientos')
      .insert([movement])
      .select();
    if (error) console.warn('[Supabase] addKardexMovement:', error.message);
    return { data, error };
  },

  // Crear un nuevo pedido
  async createOrder(order: Record<string, unknown>): Promise<SyncResult> {
    const supabase = await getClient();
    if (!supabase) return skipped;
    const { data, error } = await supabase.from('pedidos').insert([order]).select();
    if (error) console.warn('[Supabase] createOrder:', error.message);
    return { data, error };
  },

  // Obtener pedidos en tiempo real
  async getOrders() {
    const supabase = await getClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedidos_detalle(*)')
      .order('created_at', { ascending: false });
    if (error) console.warn('[Supabase] getOrders:', error.message);
    return data || [];
  },

  // Persistir / actualizar un comprobante electrónico emitido
  async upsertComprobante(comprobante: Record<string, unknown>): Promise<SyncResult> {
    const supabase = await getClient();
    if (!supabase) return skipped;
    const { data, error } = await supabase
      .from('comprobantes')
      .upsert(comprobante, { onConflict: 'id' })
      .select();
    if (error) console.warn('[Supabase] upsertComprobante:', error.message);
    return { data, error };
  },

  // Guardar la configuración fiscal de la empresa
  async saveCompanyConfig(config: Record<string, unknown>): Promise<SyncResult> {
    const supabase = await getClient();
    if (!supabase) return skipped;
    const { data, error } = await supabase
      .from('empresa_config')
      .upsert({ ...config, id: config.ruc }, { onConflict: 'id' })
      .select();
    if (error) console.warn('[Supabase] saveCompanyConfig:', error.message);
    return { data, error };
  },
};
