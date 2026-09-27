// ==========================================
// DATOS DE LA TIENDA PÚBLICA
// Sólo información de vitrina. Nube: función catalogo_publico() y tablas públicas (RLS para anon).
// Demo: el mismo estado del navegador que usa el panel. Nunca se cargan costos, clientes ni ventas.
// ==========================================
import { agregarSolicitudDemo, cargarEstadoDemo } from '../../data/estadoDemo';
import {
  CATEGORIAS_PLANTAS,
  disponibilidadDe,
  type Category,
  type ConfigTienda,
  type ProductoPublico,
  type ServicioPublico,
  type SolicitudTienda
} from '../../domain/types';
import { configTiendaDesdeFila, servicioPublicoDesdeFila } from '../../lib/repo';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface DatosTienda {
  productos: ProductoPublico[];
  servicios: ServicioPublico[];
  config: ConfigTienda;
}

export const esPlanta = (p: { categoria: Category }) => CATEGORIAS_PLANTAS.includes(p.categoria);

export async function cargarDatosTienda(): Promise<DatosTienda> {
  if (!isSupabaseConfigured) {
    const s = cargarEstadoDemo();
    return {
      productos: s.products
        .filter(p => p.visibleTienda !== false)
        .map(p => ({
          sku: p.sku,
          nombre: p.name,
          nombreCientifico: p.scientificName,
          categoria: p.category,
          categoriaNombre: p.categoryName,
          familia: p.botanicalFamily || undefined,
          descripcion: p.description || undefined,
          imagen: p.fullImage || undefined,
          precio: p.price,
          disponibilidad: disponibilidadDe(p.stock, p.minStock),
          luz: p.careLight,
          riego: p.careWater,
          esPlantaViva: p.isLivePlant,
          destacado: !!p.destacado
        })),
      servicios: s.serviciosPublicos.filter(x => x.visible).sort((a, b) => a.orden - b.orden),
      config: s.tiendaConfig
    };
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const [catalogo, servicios, config] = await Promise.all([
    sb.rpc('catalogo_publico'),
    sb.from('servicios_publicos').select('slug, nombre, resumen, descripcion, imagen_url, orden, visible').eq('visible', true).order('orden'),
    sb.from('tienda_config').select('whatsapp, email, direccion, horario, mensaje_portada').eq('id', 1).maybeSingle()
  ]);
  const error = catalogo.error ?? servicios.error ?? config.error;
  if (error) throw new Error(error.message);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    productos: (catalogo.data as any[]).map(r => ({
      sku: r.sku,
      nombre: r.nombre,
      nombreCientifico: r.nombre_cientifico ?? undefined,
      categoria: r.categoria,
      categoriaNombre: r.categoria_nombre ?? r.categoria,
      familia: r.familia_botanica ?? undefined,
      descripcion: r.descripcion ?? undefined,
      imagen: r.imagen_url ?? undefined,
      precio: Number(r.precio),
      disponibilidad: r.disponibilidad,
      luz: r.cuidado_luz ?? undefined,
      riego: r.cuidado_riego ?? undefined,
      esPlantaViva: !!r.es_planta_viva,
      destacado: !!r.destacado
    })),
    servicios: (servicios.data ?? []).map(servicioPublicoDesdeFila),
    config: configTiendaDesdeFila(config.data)
  };
}

export interface NuevaSolicitud {
  tipo: SolicitudTienda['tipo'];
  nombre: string;
  telefono: string;
  email?: string;
  distrito?: string;
  mensaje?: string;
  servicio?: string;
  items?: { sku: string; cantidad: number }[];
}

/** Envía la solicitud. En la nube el servidor valida todo y toma los precios de la base. */
export async function enviarSolicitud(s: NuevaSolicitud, catalogo: ProductoPublico[]): Promise<string> {
  const nombre = s.nombre.trim();
  const telefono = s.telefono.replace(/[^0-9+]/g, '');
  if (nombre.length < 2) throw new Error('Indica tu nombre.');
  if (!/^\+?[0-9]{7,15}$/.test(telefono)) throw new Error('Indica un teléfono o WhatsApp válido.');
  if ((s.mensaje ?? '').length > 1000) throw new Error('El mensaje es demasiado largo.');
  if (s.tipo === 'PEDIDO' && !s.items?.length) throw new Error('Tu pedido no tiene productos.');

  if (!isSupabaseConfigured) {
    const items = (s.items ?? []).map(it => {
      const p = catalogo.find(x => x.sku === it.sku);
      if (!p) throw new Error('Producto no disponible.');
      return { sku: p.sku, nombre: p.nombre, cantidad: it.cantidad, precio: p.precio };
    });
    const id = `WEB-${Date.now().toString(36).toUpperCase()}`;
    agregarSolicitudDemo({
      id, tipo: s.tipo, nombre, telefono, email: s.email || undefined, distrito: s.distrito || undefined, mensaje: s.mensaje || undefined,
      servicioSlug: s.servicio, items, totalReferencial: items.reduce((a, it) => a + it.cantidad * it.precio, 0), estado: 'NUEVA', createdAt: new Date().toISOString()
    });
    return id;
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const { data, error } = await sb.rpc('crear_solicitud', {
    p: { tipo: s.tipo, nombre, telefono, email: s.email, distrito: s.distrito, mensaje: s.mensaje, servicio: s.servicio, items: s.items ?? [] }
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Enlace de WhatsApp sólo si el dueño configuró un número real; si no, null (nunca un enlace falso). */
export function enlaceWhatsapp(config: ConfigTienda, texto: string): string | null {
  const numero = config.whatsapp?.replace(/[^0-9]/g, '');
  if (!numero || numero.length < 8) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
