// ==========================================
// CÁLCULOS DEL PUNTO DE VENTA (puros)
// Carrito con descuento por línea y global (prorrateado en los ítems), pago mixto y vuelto.
// Todos los precios incluyen IGV.
// ==========================================
import type { CatalogProduct, DescuentoGlobal, LineaCarrito, Pago } from '../domain/types';
import { round2 } from './peru';

export interface LineaCalculada {
  sku: string;
  name: string;
  qty: number;
  precioLista: number;
  descuentoPct: number;
  bruto: number; // qty × precio de lista
  neto: number; // después de todos los descuentos
  precioUnitNeto: number; // neto / qty, lo que va al comprobante
}

export interface CarritoCalculado {
  lineas: LineaCalculada[];
  subtotal: number; // a precio de lista
  descuentoLineas: number;
  descuentoGlobal: number;
  descuentoTotal: number;
  total: number;
}

export function calcularCarrito(lineas: LineaCarrito[], productos: CatalogProduct[], global: DescuentoGlobal): CarritoCalculado {
  const base = lineas
    .map(l => {
      const p = productos.find(x => x.sku === l.sku);
      if (!p || l.qty <= 0) return null;
      const pct = Math.min(100, Math.max(0, l.descuentoPct || 0));
      const bruto = round2(p.price * l.qty);
      return { sku: p.sku, name: p.name, qty: l.qty, precioLista: p.price, descuentoPct: pct, bruto, trasLinea: round2(bruto * (1 - pct / 100)) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const subtotal = round2(base.reduce((a, l) => a + l.bruto, 0));
  const trasLineas = round2(base.reduce((a, l) => a + l.trasLinea, 0));
  const descuentoLineas = round2(subtotal - trasLineas);

  const valor = Math.max(0, global.valor || 0);
  const descuentoGlobal = round2(Math.min(trasLineas, global.tipo === 'PCT' ? trasLineas * Math.min(100, valor) / 100 : valor));
  const total = round2(trasLineas - descuentoGlobal);

  // Prorrateo del descuento global; la última línea absorbe el redondeo para cuadrar al céntimo
  let acumulado = 0;
  const calculadas = base.map((l, i) => {
    const neto = i === base.length - 1
      ? round2(total - acumulado)
      : round2(trasLineas > 0 ? l.trasLinea * (total / trasLineas) : 0);
    acumulado = round2(acumulado + neto);
    return { sku: l.sku, name: l.name, qty: l.qty, precioLista: l.precioLista, descuentoPct: l.descuentoPct, bruto: l.bruto, neto, precioUnitNeto: neto / l.qty };
  });

  return { lineas: calculadas, subtotal, descuentoLineas, descuentoGlobal, descuentoTotal: round2(descuentoLineas + descuentoGlobal), total };
}

export interface ResumenPagos {
  pagado: number;
  efectivo: number;
  noEfectivo: number;
  vuelto: number;
  falta: number;
  error: string | null;
  /** Lo que realmente entra a caja por medio (el efectivo descuenta el vuelto). */
  ingresos: Pago[];
}

export function resumirPagos(total: number, pagos: Pago[]): ResumenPagos {
  const validos = pagos.filter(p => p.monto > 0);
  const efectivo = round2(validos.filter(p => p.medio === 'Efectivo').reduce((a, p) => a + p.monto, 0));
  const noEfectivo = round2(validos.filter(p => p.medio !== 'Efectivo').reduce((a, p) => a + p.monto, 0));
  const pagado = round2(efectivo + noEfectivo);
  const falta = round2(Math.max(0, total - pagado));
  const vuelto = round2(Math.max(0, pagado - total));

  let error: string | null = null;
  if (total <= 0) error = 'El carrito está vacío.';
  else if (noEfectivo > total) error = 'Los pagos con Yape, Plin, tarjeta o transferencia no pueden superar el total (el vuelto sólo se da en efectivo).';
  else if (falta > 0) error = `Falta cobrar S/ ${falta.toFixed(2)}.`;

  // Agrupa por medio; el vuelto sale del efectivo
  const porMedio = new Map<Pago['medio'], number>();
  validos.forEach(p => porMedio.set(p.medio, round2((porMedio.get(p.medio) ?? 0) + p.monto)));
  if (porMedio.has('Efectivo')) porMedio.set('Efectivo', round2(porMedio.get('Efectivo')! - vuelto));
  const ingresos = [...porMedio].filter(([, m]) => m > 0).map(([medio, monto]) => ({ medio, monto }));

  return { pagado, efectivo, noEfectivo, vuelto, falta, error, ingresos };
}
