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
import { soles } from '../../lib/formato';
import { configTiendaDesdeFila, servicioPublicoDesdeFila } from '../../lib/repo';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface DatosTienda {
  productos: ProductoPublico[];
  servicios: ServicioPublico[];
  config: ConfigTienda;
}

/** Todas las rutas públicas cuelgan de /tienda (el enlace principal es del equipo). */
export const BASE = '/tienda';
export const url = (ruta = '') => `${BASE}${ruta}`;

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
          stock: Math.max(0, p.stock),
          luz: p.careLight,
          riego: p.careWater,
          esPlantaViva: p.isLivePlant,
          destacado: !!p.destacado
        }))
        .sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.nombre.localeCompare(b.nombre)),
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
      stock: Math.max(0, Number(r.stock ?? 0)),
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
  comprobante?: SolicitudTienda['comprobante'];
  doc?: string;
  razonSocial?: string;
  entrega?: SolicitudTienda['entrega'];
  direccion?: string;
}

export const RUC_VALIDO = /^(10|15|17|20)[0-9]{9}$/;

/** Las mismas reglas que aplica el servidor (crear_solicitud), para avisar antes de enviar. */
export function validarSolicitud(s: NuevaSolicitud): string | null {
  const telefono = s.telefono.replace(/[^0-9+]/g, '');
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '');
  if (s.nombre.trim().length < 2) return 'Indica tu nombre.';
  if (!/^\+?[0-9]{7,15}$/.test(telefono)) return 'Indica un teléfono o WhatsApp válido.';
  if ((s.mensaje ?? '').length > 1000) return 'El mensaje es demasiado largo.';
  if (s.comprobante === 'FACTURA') {
    if (!RUC_VALIDO.test(doc)) return 'Para factura indica un RUC válido de 11 dígitos.';
    if ((s.razonSocial ?? '').trim().length < 3) return 'Para factura indica la razón social.';
  } else if (doc && !/^[0-9]{8}$/.test(doc)) {
    return 'El DNI debe tener 8 dígitos.';
  }
  if (s.entrega === 'DELIVERY' && (s.direccion ?? '').trim().length < 5) return 'Indica la dirección de entrega.';
  if (s.tipo === 'PEDIDO' && !s.items?.length) return 'Tu pedido no tiene productos.';
  return null;
}

/** Envía la solicitud. En la nube el servidor valida todo y toma los precios de la base. */
export async function enviarSolicitud(s: NuevaSolicitud, catalogo: ProductoPublico[]): Promise<string> {
  const error = validarSolicitud(s);
  if (error) throw new Error(error);
  const nombre = s.nombre.trim();
  const telefono = s.telefono.replace(/[^0-9+]/g, '');
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '') || undefined;
  const comprobante = s.comprobante ?? 'BOLETA';
  const entrega = s.entrega ?? 'RECOJO';

  if (!isSupabaseConfigured) {
    const items = (s.items ?? []).map(it => {
      const p = catalogo.find(x => x.sku === it.sku);
      if (!p) throw new Error('Producto no disponible.');
      return { sku: p.sku, nombre: p.nombre, cantidad: it.cantidad, precio: p.precio, stock: p.stock };
    });
    const id = `WEB-${Date.now().toString(36).toUpperCase()}`;
    agregarSolicitudDemo({
      id, tipo: s.tipo, nombre, telefono, email: s.email || undefined, distrito: s.distrito || undefined, mensaje: s.mensaje || undefined,
      servicioSlug: s.servicio, items, totalReferencial: items.reduce((a, it) => a + it.cantidad * it.precio, 0), estado: 'NUEVA', createdAt: new Date().toISOString(),
      comprobante, docCliente: doc, razonSocial: s.razonSocial?.trim() || undefined, entrega, direccion: s.direccion?.trim() || undefined,
      requiereAsesor: items.some(it => it.cantidad > it.stock)
    });
    return id;
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const { data, error: errorRpc } = await sb.rpc('crear_solicitud', {
    p: {
      tipo: s.tipo, nombre, telefono, email: s.email, distrito: s.distrito, mensaje: s.mensaje, servicio: s.servicio, items: s.items ?? [],
      comprobante, doc, razon_social: s.razonSocial, entrega, direccion: s.direccion
    }
  });
  if (errorRpc) throw new Error(errorRpc.message);
  return String(data);
}

/** Enlace de WhatsApp sólo si el dueño configuró un número real; si no, null (nunca un enlace falso). */
export function enlaceWhatsapp(config: ConfigTienda, texto: string): string | null {
  const numero = config.whatsapp?.replace(/[^0-9]/g, '');
  if (!numero || numero.length < 8) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Mensaje que el cliente envía por WhatsApp con su pedido ya registrado. */
export function mensajePedido(numero: string, s: NuevaSolicitud, lineas: { nombre: string; cantidad: number; precio: number; stock: number }[], servicio?: string): string {
  const total = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0);
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '');
  const partes = [
    `*${s.tipo === 'SERVICIO' ? 'Cotización de servicio' : 'Pedido'} AUREVIA N° ${numero}*`,
    `Cliente: ${s.nombre.trim()} · ${s.telefono.trim()}`,
    s.comprobante === 'FACTURA'
      ? `Comprobante: Factura · RUC ${doc} · ${s.razonSocial?.trim()}`
      : `Comprobante: Boleta${doc ? ` · DNI ${doc}` : ''}`,
    servicio ? `Servicio: ${servicio}` : '',
    s.entrega === 'DELIVERY' ? `Entrega: delivery a ${[s.direccion, s.distrito].filter(Boolean).join(', ')}` : s.tipo === 'PEDIDO' ? 'Entrega: recojo en el vivero' : '',
    ...(lineas.length ? ['', ...lineas.map(l => `• ${l.cantidad} × ${l.nombre} (${soles(l.precio)})${l.cantidad > l.stock ? ` — hay ${l.stock}, el resto lo coordina un asesor` : ''}`), `Total referencial: ${soles(total)}`] : []),
    s.mensaje?.trim() ? `\nNota: ${s.mensaje.trim()}` : '',
    '',
    'Quedo atento(a) para coordinar el pago y la entrega.'
  ];
  return partes.filter((p, i, arr) => p !== '' || arr[i - 1] !== '').join('\n');
}
