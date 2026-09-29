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
  type SolicitudTienda,
  type TarifaDelivery
} from '../../domain/types';
import { soles } from '../../lib/formato';
import { configTiendaDesdeFila, servicioPublicoDesdeFila, tarifaDesdeFila } from '../../lib/repo';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface DatosTienda {
  productos: ProductoPublico[];
  servicios: ServicioPublico[];
  config: ConfigTienda;
  tarifas: TarifaDelivery[];
}

/** Costo de delivery del distrito (sin tarifa = a coordinar). El servidor aplica la misma regla. */
export const tarifaDe = (tarifas: TarifaDelivery[], distrito?: string) =>
  distrito ? tarifas.find(t => t.activo && t.distrito.toLowerCase() === distrito.trim().toLowerCase()) : undefined;

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
      config: s.tiendaConfig,
      tarifas: (s.tarifasDelivery ?? []).filter(t => t.activo)
    };
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const [catalogo, servicios, config, tarifas] = await Promise.all([
    sb.rpc('catalogo_publico'),
    sb.from('servicios_publicos').select('slug, nombre, resumen, descripcion, imagen_url, orden, visible, precio_desde').eq('visible', true).order('orden'),
    sb.from('tienda_config').select('whatsapp, email, direccion, horario, mensaje_portada').eq('id', 1).maybeSingle(),
    sb.from('tarifas_delivery').select('distrito, costo, activo').eq('activo', true).order('distrito')
  ]);
  const error = catalogo.error ?? servicios.error ?? config.error ?? tarifas.error;
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
    config: configTiendaDesdeFila(config.data),
    tarifas: (tarifas.data ?? []).map(tarifaDesdeFila)
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

/** Los precios del catálogo son valor de venta: la boleta o factura suma el 18% de IGV. */
export const TASA_IGV = 0.18;
export const AVISO_IGV = 'Los precios de nuestras plantas y productos no incluyen IGV: se suma el 18% en tu boleta o factura.';
export function desgloseIgv(valor: number, delivery = 0) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const igv = r2(valor * TASA_IGV);
  return { valor: r2(valor), igv, delivery, total: r2(valor + igv + delivery) };
}

/** Las mismas reglas que aplica el servidor (crear_solicitud), para avisar antes de enviar. */
export function validarSolicitud(s: NuevaSolicitud): string | null {
  const telefono = s.telefono.replace(/[^0-9+]/g, '');
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '');
  if (s.nombre.trim().length < 2) return 'Indica tu nombre.';
  if (!/^\+?[0-9]{7,15}$/.test(telefono)) return 'Indica un teléfono o WhatsApp válido.';
  if ((s.mensaje ?? '').length > 1000) return 'El mensaje es demasiado largo.';
  if (s.comprobante === 'RXH' && s.tipo !== 'SERVICIO') return 'El recibo por honorarios sólo aplica a servicios.';
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
export async function enviarSolicitud(s: NuevaSolicitud, catalogo: ProductoPublico[], tarifas: TarifaDelivery[] = []): Promise<string> {
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
      servicioSlug: s.servicio, items, totalReferencial: desgloseIgv(items.reduce((a, it) => a + it.cantidad * it.precio, 0)).total,
      igvReferencial: desgloseIgv(items.reduce((a, it) => a + it.cantidad * it.precio, 0)).igv, estado: 'NUEVA', createdAt: new Date().toISOString(),
      comprobante, docCliente: doc, razonSocial: s.razonSocial?.trim() || undefined, entrega, direccion: s.direccion?.trim() || undefined,
      requiereAsesor: items.some(it => it.cantidad > it.stock),
      costoDelivery: s.tipo === 'PEDIDO' && entrega === 'DELIVERY' ? tarifaDe(tarifas, s.distrito)?.costo : undefined
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
export function mensajePedido(numero: string, s: NuevaSolicitud, lineas: { nombre: string; cantidad: number; precio: number; stock: number }[], servicio?: string, delivery?: number): string {
  const d = desgloseIgv(lineas.reduce((a, l) => a + l.cantidad * l.precio, 0), delivery ?? 0);
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '');
  const partes = [
    `*${s.tipo === 'SERVICIO' ? 'Cotización de servicio' : 'Pedido'} AUREVIA N° ${numero}*`,
    `Cliente: ${s.nombre.trim()} · ${s.telefono.trim()}`,
    s.comprobante === 'FACTURA'
      ? `Comprobante: Factura · RUC ${doc} · ${s.razonSocial?.trim()}${s.tipo === 'SERVICIO' ? ' (+ IGV 18%)' : ''}`
      : s.comprobante === 'RXH'
        ? `Comprobante: Recibo por honorarios del jardinero${doc ? ` · DNI ${doc}` : ''}`
        : `Comprobante: Boleta${doc ? ` · DNI ${doc}` : ''}`,
    servicio ? `Servicio: ${servicio}` : '',
    s.entrega === 'DELIVERY' ? `Entrega: delivery a ${[s.direccion, s.distrito].filter(Boolean).join(', ')} · ${delivery !== undefined ? soles(delivery) : 'costo a coordinar'}` : s.tipo === 'PEDIDO' ? 'Entrega: recojo en el vivero' : '',
    ...(lineas.length ? ['', ...lineas.map(l => `• ${l.cantidad} × ${l.nombre} (${soles(l.precio)} + IGV)${l.cantidad > l.stock ? ` — hay ${l.stock}, el resto lo coordina un asesor` : ''}`),
      `Valor de venta: ${soles(d.valor)}`, `IGV (18%): ${soles(d.igv)}`, ...(d.delivery ? [`Delivery: ${soles(d.delivery)}`] : []), `Total referencial: ${soles(d.total)}`] : []),
    s.mensaje?.trim() ? `\nNota: ${s.mensaje.trim()}` : '',
    '',
    'Quedo atento(a) para coordinar el pago y la entrega.'
  ];
  return partes.filter((p, i, arr) => p !== '' || arr[i - 1] !== '').join('\n');
}
