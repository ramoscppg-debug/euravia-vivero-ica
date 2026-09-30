// ==========================================
// DATOS DE LA TIENDA PÚBLICA
// Sólo información de vitrina. Nube: función catalogo_publico() y tablas públicas (RLS para anon).
// Demo: el mismo estado del navegador que usa el panel. Nunca se cargan costos, clientes ni ventas.
// ==========================================
import { agregarResenaDemo, agregarSolicitudDemo, cargarEstadoDemo } from '../../data/estadoDemo';
import {
  CATEGORIAS_PLANTAS,
  disponibilidadDe,
  type Category,
  type Combo,
  type ConfigTienda,
  type EventoPromocion,
  type ProductoPublico,
  type ServicioPublico,
  type SolicitudTienda,
  type TarifaDelivery
} from '../../domain/types';
import { soles } from '../../lib/formato';
import { configTiendaDesdeFila, eventoDesdeFila, servicioPublicoDesdeFila, tarifaDesdeFila } from '../../lib/repo';
import { esNuevo, precioVigente } from '../../lib/ofertas';
import { hoyLocal } from '../../lib/fechas';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface ResenaPublica {
  id: string;
  nombre: string;
  estrellas: number;
  texto: string;
  sku?: string;
  foto?: string;
  fecha: string;
}

export interface DatosTienda {
  productos: ProductoPublico[]; // incluye los combos (con su contenido)
  servicios: ServicioPublico[];
  config: ConfigTienda;
  tarifas: TarifaDelivery[];
  resenas: ResenaPublica[];
  eventos: EventoPromocion[]; // activos y próximos (visibles)
}

/** Orden de vitrina: ofertas primero, luego lo nuevo, luego lo destacado. */
export const ordenVitrina = (a: ProductoPublico, b: ProductoPublico) => {
  const oferta = (p: ProductoPublico) => ((p.precioRegular ?? 0) > p.precio ? 1 : 0);
  return oferta(b) - oferta(a) || Number(!!b.esNuevo) - Number(!!a.esNuevo) || Number(b.destacado) - Number(a.destacado);
};

/** Un combo en la vitrina: se agrega como un producto más; alcanza para lo que permita su producto más escaso. */
export function comboPublico(c: Combo, productos: { sku: string; nombre: string; stock: number }[]): ProductoPublico | null {
  const partes = c.items.map(i => ({ ...i, p: productos.find(p => p.sku === i.sku) }));
  if (partes.some(x => !x.p)) return null;
  const stock = Math.min(...partes.map(x => Math.floor(Math.max(0, x.p!.stock) / x.cantidad)));
  return {
    sku: c.codigo, nombre: c.nombre, categoria: 'accesorios', categoriaNombre: 'Combo', descripcion: c.descripcion, imagen: c.imagen, precio: c.precio,
    disponibilidad: stock <= 0 ? 'AGOTADO' : stock <= 2 ? 'POCAS' : 'DISPONIBLE', stock, esPlantaViva: false, destacado: false,
    combo: partes.map(x => ({ sku: x.sku, nombre: x.p!.nombre, cantidad: x.cantidad }))
  };
}

/** Separa un combo en sus productos con el precio del combo repartido según el precio de lista (igual que el servidor). */
export function expandirCombo(combo: ProductoPublico, catalogo: ProductoPublico[], cantidad: number) {
  const partes = (combo.combo ?? []).map(i => ({ ...i, p: catalogo.find(x => x.sku === i.sku)! }));
  const peso = partes.reduce((a, x) => a + x.cantidad * x.p.precio, 0);
  let acumulado = 0;
  return partes.map((x, i) => {
    const linea = i === partes.length - 1 ? Math.round((combo.precio - acumulado) * 100) / 100 : Math.round(combo.precio * x.cantidad * x.p.precio / peso * 100) / 100;
    acumulado += linea;
    return { sku: x.sku, nombre: x.p.nombre, cantidad: cantidad * x.cantidad, precio: Math.round(linea / x.cantidad * 10000) / 10000, stock: x.p.stock, combo: combo.nombre };
  });
}

/** Delivery gratis desde el monto que fija el dueño (el servidor aplica la misma regla). */
export const deliveryConPromo = (costo: number | undefined, total: number, gratisDesde?: number) =>
  costo !== undefined && gratisDesde !== undefined && total >= gratisDesde ? 0 : costo;

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
    const productos: ProductoPublico[] = s.products
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
          ...(() => {
            const v = precioVigente(p, s.eventos ?? [], hoyLocal());
            return { precio: v.precio, precioRegular: v.enOferta ? v.regular : undefined, eventos: v.eventos };
          })(),
          esNuevo: esNuevo(p.creadoAt, hoyLocal()),
          disponibilidad: disponibilidadDe(p.stock, p.minStock),
          stock: Math.max(0, p.stock),
          luz: p.careLight,
          riego: p.careWater,
          esPlantaViva: p.isLivePlant,
          destacado: !!p.destacado
        }))
        .sort((a, b) => ordenVitrina(a, b) || a.nombre.localeCompare(b.nombre));
    const todos = s.products.map(p => ({ sku: p.sku, nombre: p.name, stock: p.stock }));
    const combos = (s.combos ?? []).filter(c => c.visible).map(c => comboPublico(c, todos)).filter((c): c is ProductoPublico => !!c);
    return {
      productos: [...productos, ...combos],
      servicios: s.serviciosPublicos.filter(x => x.visible).sort((a, b) => a.orden - b.orden),
      config: s.tiendaConfig,
      tarifas: (s.tarifasDelivery ?? []).filter(t => t.activo),
      eventos: (s.eventos ?? []).filter(e => e.visible && e.hasta >= hoyLocal()),
      resenas: (s.resenas ?? []).filter(r => r.aprobada).map(r => ({ id: r.id, nombre: r.nombre, estrellas: r.estrellas, texto: r.texto, sku: r.productoSku, foto: r.foto, fecha: r.fecha }))
    };
  }

  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const [catalogo, servicios, config, tarifas, combos, resenas, eventos] = await Promise.all([
    sb.rpc('catalogo_publico'),
    sb.from('servicios_publicos').select('slug, nombre, resumen, descripcion, imagen_url, orden, visible, precio_desde').eq('visible', true).order('orden'),
    sb.from('tienda_config').select('whatsapp, email, direccion, horario, mensaje_portada, delivery_gratis_desde').eq('id', 1).maybeSingle(),
    sb.from('tarifas_delivery').select('distrito, costo, activo').eq('activo', true).order('distrito'),
    sb.rpc('combos_publicos'),
    sb.rpc('resenas_publicas'),
    sb.from('eventos_promocion').select('*').eq('visible', true).gte('hasta', hoyLocal()).order('desde')
  ]);
  const error = catalogo.error ?? servicios.error ?? config.error ?? tarifas.error ?? combos.error ?? resenas.error ?? eventos.error;
  if (error) throw new Error(error.message);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    productos: [...(catalogo.data as any[]).map((r): ProductoPublico => ({
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
      destacado: !!r.destacado,
      precioRegular: Number(r.precio_regular) > Number(r.precio) ? Number(r.precio_regular) : undefined,
      esNuevo: !!r.es_nuevo,
      eventos: r.eventos ?? []
    })).sort((a, b) => ordenVitrina(a, b) || a.nombre.localeCompare(b.nombre)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(combos.data as any[] ?? []).map((r): ProductoPublico => ({
      sku: r.codigo, nombre: r.nombre, categoria: 'accesorios', categoriaNombre: 'Combo', descripcion: r.descripcion ?? undefined, imagen: r.imagen_url ?? undefined,
      precio: Number(r.precio), stock: Math.max(0, Number(r.stock ?? 0)), disponibilidad: Number(r.stock) <= 0 ? 'AGOTADO' : Number(r.stock) <= 2 ? 'POCAS' : 'DISPONIBLE',
      esPlantaViva: false, destacado: false, combo: r.contenido ?? []
    }))],
    servicios: (servicios.data ?? []).map(servicioPublicoDesdeFila),
    config: configTiendaDesdeFila(config.data),
    tarifas: (tarifas.data ?? []).map(tarifaDesdeFila),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventos: (eventos.data ?? []).map(eventoDesdeFila),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resenas: (resenas.data as any[] ?? []).map(r => ({ id: String(r.id), nombre: r.nombre, estrellas: r.estrellas, texto: r.texto, sku: r.producto_sku ?? undefined, foto: r.foto_url ?? undefined, fecha: r.fecha }))
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

/** Los precios de plantas e insumos ya incluyen IGV. */
export const AVISO_IGV = 'Todos nuestros precios incluyen IGV.';
/** IGV contenido en un precio que ya lo incluye. */
export const igvIncluido = (total: number) => Math.round((total - total / 1.18) * 100) / 100;

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
  } else if (doc && !/^[0-9]{8}$/.test(doc) && !RUC_VALIDO.test(doc)) {
    return doc.length > 8 ? 'El RUC debe tener 11 dígitos.' : 'El DNI debe tener 8 dígitos.';
  }
  if (s.entrega === 'DELIVERY' && (s.direccion ?? '').trim().length < 5) return 'Indica la dirección de entrega.';
  if (s.tipo === 'PEDIDO' && !s.items?.length) return 'Tu pedido no tiene productos.';
  return null;
}

/** Envía la solicitud. En la nube el servidor valida todo y toma los precios de la base. */
export async function enviarSolicitud(s: NuevaSolicitud, catalogo: ProductoPublico[], tarifas: TarifaDelivery[] = [], gratisDesde?: number): Promise<string> {
  const error = validarSolicitud(s);
  if (error) throw new Error(error);
  const nombre = s.nombre.trim();
  const telefono = s.telefono.replace(/[^0-9+]/g, '');
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '') || undefined;
  const comprobante = s.comprobante ?? 'BOLETA';
  const entrega = s.entrega ?? 'RECOJO';

  if (!isSupabaseConfigured) {
    const items = (s.items ?? []).flatMap(it => {
      const p = catalogo.find(x => x.sku === it.sku);
      if (!p) throw new Error('Producto no disponible.');
      if (p.combo) return expandirCombo(p, catalogo, it.cantidad);
      return [{ sku: p.sku, nombre: p.nombre, cantidad: it.cantidad, precio: p.precio, stock: p.stock }];
    });
    const valor = (s.items ?? []).reduce((a, it) => a + it.cantidad * (catalogo.find(x => x.sku === it.sku)?.precio ?? 0), 0);
    const id = `WEB-${Date.now().toString(36).toUpperCase()}`;
    agregarSolicitudDemo({
      id, tipo: s.tipo, nombre, telefono, email: s.email || undefined, distrito: s.distrito || undefined, mensaje: s.mensaje || undefined,
      servicioSlug: s.servicio, items, totalReferencial: Math.round(valor * 100) / 100,
      igvReferencial: igvIncluido(valor), estado: 'NUEVA', createdAt: new Date().toISOString(),
      comprobante, docCliente: doc, razonSocial: s.razonSocial?.trim() || undefined, entrega, direccion: s.direccion?.trim() || undefined,
      requiereAsesor: items.some(it => it.cantidad > it.stock),
      costoDelivery: s.tipo === 'PEDIDO' && entrega === 'DELIVERY' ? deliveryConPromo(tarifaDe(tarifas, s.distrito)?.costo, valor, gratisDesde) : undefined
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

/** El cliente deja su reseña: queda por aprobar (no se publica sola). */
export async function enviarResena(r: { nombre: string; telefono: string; estrellas: number; texto: string; sku?: string }): Promise<void> {
  const nombre = r.nombre.trim();
  const telefono = r.telefono.replace(/[^0-9+]/g, '');
  const texto = r.texto.trim();
  if (nombre.length < 2) throw new Error('Indica tu nombre.');
  if (!/^\+?[0-9]{7,15}$/.test(telefono)) throw new Error('Indica tu teléfono o WhatsApp.');
  if (!(r.estrellas >= 1 && r.estrellas <= 5)) throw new Error('Elige de 1 a 5 estrellas.');
  if (texto.length < 5 || texto.length > 600) throw new Error('Cuéntanos tu experiencia (hasta 600 caracteres).');
  if (!isSupabaseConfigured) {
    agregarResenaDemo({ id: `RES-${Date.now().toString(36).toUpperCase()}`, nombre, telefono, estrellas: r.estrellas, texto, productoSku: r.sku, aprobada: false, fecha: new Date().toISOString().slice(0, 10) });
    return;
  }
  const sb = await getSupabase();
  if (!sb) throw new Error('Sin conexión con la tienda.');
  const { error } = await sb.rpc('crear_resena', { p: { nombre, telefono, estrellas: r.estrellas, texto, sku: r.sku } });
  if (error) throw new Error(error.message);
}

/** Enlace de WhatsApp sólo si el dueño configuró un número real; si no, null (nunca un enlace falso). */
export function enlaceWhatsapp(config: ConfigTienda, texto: string): string | null {
  const numero = config.whatsapp?.replace(/[^0-9]/g, '');
  if (!numero || numero.length < 8) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Mensaje que el cliente envía por WhatsApp con su pedido ya registrado. */
export function mensajePedido(numero: string, s: NuevaSolicitud, lineas: { nombre: string; cantidad: number; precio: number; stock: number }[], servicio?: string, delivery?: number): string {
  const total = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0) + (delivery ?? 0);
  const doc = (s.doc ?? '').replace(/[^0-9]/g, '');
  const partes = [
    `*${s.tipo === 'SERVICIO' ? 'Cotización de servicio' : 'Pedido'} AUREVIA N° ${numero}*`,
    `Cliente: ${s.nombre.trim()} · ${s.telefono.trim()}`,
    s.comprobante === 'FACTURA'
      ? `Comprobante: Factura · RUC ${doc} · ${s.razonSocial?.trim()}${s.tipo === 'SERVICIO' ? ' (se agrega 18% de IGV)' : ''}`
      : s.comprobante === 'RXH'
        ? `Comprobante: Recibo por honorarios${doc ? ` · ${doc.length === 11 ? 'RUC' : 'DNI'} ${doc}${s.razonSocial?.trim() ? ` · ${s.razonSocial.trim()}` : ''}` : ''}`
        : `Comprobante: Boleta${doc ? ` · ${doc.length === 11 ? 'RUC' : 'DNI'} ${doc}${s.razonSocial?.trim() ? ` · ${s.razonSocial.trim()}` : ''}` : ''}${s.tipo === 'SERVICIO' ? ' (se agrega 18% de IGV)' : ''}`,
    servicio ? `Servicio: ${servicio}` : '',
    s.entrega === 'DELIVERY' ? `Entrega: delivery a ${[s.direccion, s.distrito].filter(Boolean).join(', ')} · ${delivery !== undefined ? soles(delivery) : 'costo a coordinar'}` : s.tipo === 'PEDIDO' ? 'Entrega: recojo en el vivero' : '',
    ...(lineas.length ? ['', ...lineas.map(l => `• ${l.cantidad} × ${l.nombre} (${soles(l.precio)})${l.cantidad > l.stock ? ` — hay ${l.stock}, el resto lo coordina un asesor` : ''}`),
      ...(delivery ? [`Delivery: ${soles(delivery)}`] : []), `Total referencial (IGV incluido): ${soles(total)}`] : []),
    s.mensaje?.trim() ? `\nNota: ${s.mensaje.trim()}` : '',
    '',
    'Quedo atento(a) para coordinar el pago y la entrega.'
  ];
  return partes.filter((p, i, arr) => p !== '' || arr[i - 1] !== '').join('\n');
}
