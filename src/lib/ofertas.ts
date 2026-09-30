// ==========================================
// OFERTAS, EVENTOS Y PRODUCTOS NUEVOS (puro)
// Precio vigente = el menor entre el de lista, la oferta vigente y el de un evento activo.
// Es la misma regla de la base (precio_vigente), para que la tienda, el POS y los pedidos cobren igual.
// ==========================================
import type { CatalogProduct, EventoPromocion } from '../domain/types';

const r2 = (n: number) => Math.round(n * 100) / 100;
export const DIAS_NUEVO = 30;

export const eventoActivo = (e: EventoPromocion, hoy: string) => e.visible && e.desde <= hoy && hoy <= e.hasta;
export const eventosActivos = (eventos: EventoPromocion[], hoy: string) => eventos.filter(e => eventoActivo(e, hoy));

/** El evento incluye al producto (por SKU o categoría; sin ninguno elegido, todo el catálogo). */
export const eventoIncluye = (e: EventoPromocion, p: { sku: string; category: string }) =>
  e.skus.includes(p.sku) || e.categorias.includes(p.category) || (!e.skus.length && !e.categorias.length);

export function precioVigente(p: Pick<CatalogProduct, 'sku' | 'category' | 'price' | 'precioOferta' | 'ofertaHasta'>, eventos: EventoPromocion[], hoy: string) {
  const candidatos = [p.price];
  if (p.precioOferta && p.precioOferta > 0 && (!p.ofertaHasta || p.ofertaHasta >= hoy)) candidatos.push(p.precioOferta);
  const activos = eventosActivos(eventos, hoy).filter(e => eventoIncluye(e, p));
  for (const e of activos) if (e.descuentoPct > 0) candidatos.push(r2(p.price * (1 - e.descuentoPct / 100)));
  const precio = Math.min(...candidatos);
  return { precio, regular: p.price, enOferta: precio < p.price, eventos: activos.map(e => e.id) };
}

export const esNuevo = (creadoAt: string | undefined, hoy: string) =>
  !!creadoAt && (Date.parse(hoy) - Date.parse(creadoAt.slice(0, 10))) / 86_400_000 <= DIAS_NUEVO;

/** Productos con el precio que se cobra hoy (para el carrito, cotizaciones y pedidos del panel). */
export function conPreciosVigentes<T extends CatalogProduct>(productos: T[], eventos: EventoPromocion[], hoy: string): T[] {
  if (!eventos.length && !productos.some(p => p.precioOferta)) return productos;
  return productos.map(p => ({ ...p, price: precioVigente(p, eventos, hoy).precio }));
}

/** % de descuento para la etiqueta de la tienda. */
export const pctDescuento = (precio: number, regular?: number) => (regular && regular > precio ? Math.round((1 - precio / regular) * 100) : 0);
