// ==========================================
// REPORTES DE VENTAS (puros): por periodo, producto, canal, vendedor, medio de pago y día
// Las notas de crédito restan; los montos incluyen IGV salvo el margen (base sin IGV − costo).
// ==========================================
import type { CatalogProduct, ComprobanteSunat } from '../domain/types';
import { round2 } from './peru';
import { hoyLocal, sumarDias } from './fechas';

export type Periodo = 'mes' | 'mesAnterior' | '30d' | '90d' | 'anio';

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'mes', label: 'Este mes' },
  { id: 'mesAnterior', label: 'Mes anterior' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'anio', label: 'Este año' }
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangoDe(p: Periodo, ahora = new Date()): { desde: string; hasta: string } {
  const hoy = hoyLocal(ahora);
  const [y, m] = hoy.split('-').map(Number); // m: 1-12
  switch (p) {
    case 'mes': return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case 'mesAnterior': return { desde: iso(new Date(Date.UTC(y, m - 2, 1))), hasta: iso(new Date(Date.UTC(y, m - 1, 0))) };
    case '30d': return { desde: sumarDias(hoy, -29), hasta: hoy };
    case '90d': return { desde: sumarDias(hoy, -89), hasta: hoy };
    case 'anio': return { desde: `${y}-01-01`, hasta: hoy };
  }
}

export interface Fila {
  clave: string;
  monto: number;
  cantidad: number;
  margen?: number;
}

export interface Reporte {
  desde: string;
  hasta: string;
  ventasNetas: number;
  tickets: number;
  ticketPromedio: number;
  descuentos: number;
  devoluciones: number;
  margenBruto: number;
  margenPct: number;
  porProducto: Fila[];
  porCanal: Fila[];
  porVendedor: Fila[];
  porMedio: Fila[];
  porDia: { fecha: string; monto: number }[];
}

function acumular(mapa: Map<string, Fila>, clave: string, monto: number, cantidad: number, margen?: number) {
  const f = mapa.get(clave) ?? { clave, monto: 0, cantidad: 0, margen: margen === undefined ? undefined : 0 };
  f.monto = round2(f.monto + monto);
  f.cantidad += cantidad;
  if (margen !== undefined) f.margen = round2((f.margen ?? 0) + margen);
  mapa.set(clave, f);
}

const ordenar = (m: Map<string, Fila>) => [...m.values()].sort((a, b) => b.monto - a.monto);

export function generarReporte(invoices: ComprobanteSunat[], products: CatalogProduct[], desde: string, hasta: string): Reporte {
  const docs = invoices.filter(i => ['01', '03', '07'].includes(i.tipoComprobante) && i.fechaEmision >= desde && i.fechaEmision <= hasta);
  const costo = new Map(products.map(p => [p.sku, p.cost]));
  const nombre = new Map(products.map(p => [p.sku, p.name]));

  const porProducto = new Map<string, Fila>();
  const porCanal = new Map<string, Fila>();
  const porVendedor = new Map<string, Fila>();
  const porMedio = new Map<string, Fila>();
  const porDia = new Map<string, number>();
  let ventasNetas = 0;
  let tickets = 0;
  let descuentos = 0;
  let devoluciones = 0;
  let margenBruto = 0;
  let baseNeta = 0;

  for (const inv of docs) {
    const k = inv.tipoComprobante === '07' ? -1 : 1;
    ventasNetas += k * inv.montoTotal;
    baseNeta += k * inv.opGravadas;
    if (k > 0) {
      tickets++;
      descuentos += inv.descuentoTotal ?? 0;
    } else devoluciones += inv.montoTotal;

    let margenDoc = 0;
    for (const it of inv.items) {
      const c = costo.get(it.sku);
      const margenItem = c === undefined ? it.subtotal : it.subtotal - c * it.cantidad; // servicios: sin costo de inventario
      margenDoc += k * margenItem;
      acumular(porProducto, nombre.get(it.sku) ?? it.descripcion, k * it.total, k * it.cantidad, k * margenItem);
    }
    margenBruto += margenDoc;
    acumular(porCanal, inv.canal ?? 'Directo / Vivero', k * inv.montoTotal, k > 0 ? 1 : 0);
    acumular(porVendedor, inv.vendedor ?? 'Sin registrar', k * inv.montoTotal, k > 0 ? 1 : 0);
    (inv.pagos?.length ? inv.pagos : [{ medio: 'Por cobrar', monto: inv.montoTotal }]).forEach(p => acumular(porMedio, p.medio, k * p.monto, k > 0 ? 1 : 0));
    porDia.set(inv.fechaEmision, round2((porDia.get(inv.fechaEmision) ?? 0) + k * inv.montoTotal));
  }

  // Serie diaria completa (los días sin venta en cero) para no mentir con huecos
  const dias: { fecha: string; monto: number }[] = [];
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 86_400_000) {
    const f = new Date(t).toISOString().slice(0, 10);
    dias.push({ fecha: f, monto: porDia.get(f) ?? 0 });
  }

  ventasNetas = round2(ventasNetas);
  return {
    desde,
    hasta,
    ventasNetas,
    tickets,
    ticketPromedio: tickets ? round2(ventasNetas / tickets) : 0,
    descuentos: round2(descuentos),
    devoluciones: round2(devoluciones),
    margenBruto: round2(margenBruto),
    margenPct: baseNeta > 0 ? Math.round((margenBruto / baseNeta) * 100) : 0,
    porProducto: ordenar(porProducto),
    porCanal: ordenar(porCanal),
    porVendedor: ordenar(porVendedor),
    porMedio: ordenar(porMedio),
    porDia: dias
  };
}
