// ==========================================
// ANALÍTICA PARA DECIDIR (funciones puras)
// - Libro de ingresos y egresos por periodo.
// - Productos que más salen y servicios más pedidos.
// - Compras sugeridas según la venta diaria y el stock mínimo.
// - Reportes de almacén: valorización, rotación, movimientos y mermas.
// ==========================================
import type { ErpState } from '../store/ErpStore';
import { nombreCategoria } from './contabilidad';
import { round2 } from './peru';
import { hoyLocal, sumarDias } from './fechas';

const dentro = (f: string, desde: string, hasta: string) => f >= desde && f <= hasta;

// ---------------- Ingresos y egresos ----------------
export interface Movimiento {
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO';
  categoria: string;
  documento: string;
  detalle: string;
  monto: number; // siempre positivo; el tipo dice si suma o resta
}

export function libroFinanzas(s: ErpState, desde: string, hasta: string) {
  const movs: Movimiento[] = [];
  for (const inv of s.invoices) {
    if (!dentro(inv.fechaEmision, desde, hasta)) continue;
    const nc = inv.tipoComprobante === '07';
    const esServicio = inv.items.length > 0 && inv.items.every(it => !s.products.some(p => p.sku === it.sku));
    movs.push({
      fecha: inv.fechaEmision,
      tipo: nc ? 'EGRESO' : 'INGRESO',
      categoria: nc ? 'Devolución a cliente' : esServicio ? 'Venta de servicios' : 'Venta de bienes',
      documento: inv.id,
      detalle: inv.cliente.nombreRazonSocial,
      monto: inv.montoTotal
    });
  }
  for (const c of s.purchases) {
    if (!dentro(c.fecha, desde, hasta)) continue;
    movs.push({ fecha: c.fecha, tipo: 'EGRESO', categoria: 'Compra a proveedor', documento: c.id, detalle: `${c.proveedor} · ${c.items}`, monto: c.total });
  }
  for (const g of s.gastosCaja) {
    if (dentro(g.fecha, desde, hasta)) movs.push({ fecha: g.fecha, tipo: 'EGRESO', categoria: g.cuenta ? `Gasto: ${nombreCategoria(g.cuenta)}` : 'Gasto de caja chica', documento: g.id, detalle: g.motivo, monto: g.monto });
  }
  for (const g of s.gastos ?? []) {
    if (dentro(g.fecha, desde, hasta)) movs.push({ fecha: g.fecha, tipo: 'EGRESO', categoria: `Gasto: ${nombreCategoria(g.cuenta)}`, documento: [g.serie, g.numero].filter(Boolean).join('-') || `GASTO-${g.id}`, detalle: [g.descripcion, g.proveedor].filter(Boolean).join(' · '), monto: g.total });
  }
  movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ingresos = round2(movs.filter(m => m.tipo === 'INGRESO').reduce((a, m) => a + m.monto, 0));
  const egresos = round2(movs.filter(m => m.tipo === 'EGRESO').reduce((a, m) => a + m.monto, 0));
  const porCategoria = new Map<string, { tipo: Movimiento['tipo']; monto: number }>();
  movs.forEach(m => porCategoria.set(m.categoria, { tipo: m.tipo, monto: round2((porCategoria.get(m.categoria)?.monto ?? 0) + m.monto) }));
  return { movs, ingresos, egresos, resultado: round2(ingresos - egresos), porCategoria: [...porCategoria].map(([categoria, v]) => ({ categoria, ...v })).sort((a, b) => b.monto - a.monto) };
}

// ---------------- Productos y servicios ----------------
export interface VentaProducto {
  sku: string;
  nombre: string;
  unidades: number;
  monto: number;
  stock: number;
  minimo: number;
  costo: number;
}

/** Unidades vendidas por producto en el periodo (las devoluciones restan). */
export function ventasPorProducto(s: ErpState, desde: string, hasta: string): VentaProducto[] {
  const mapa = new Map<string, VentaProducto>();
  for (const p of s.products) mapa.set(p.sku, { sku: p.sku, nombre: p.name, unidades: 0, monto: 0, stock: p.stock, minimo: p.minStock, costo: p.cost });
  for (const inv of s.invoices) {
    if (!dentro(inv.fechaEmision, desde, hasta)) continue;
    const k = inv.tipoComprobante === '07' ? -1 : 1;
    for (const it of inv.items) {
      const f = mapa.get(it.sku);
      if (!f) continue; // servicios y delivery no son productos
      f.unidades += k * it.cantidad;
      f.monto = round2(f.monto + k * it.total);
    }
  }
  return [...mapa.values()].sort((a, b) => b.unidades - a.unidades || b.monto - a.monto);
}

/** Servicios más pedidos: solicitudes de la tienda, proyectos y contratos del periodo. */
export function serviciosMasPedidos(s: ErpState, desde: string, hasta: string) {
  const mapa = new Map<string, { servicio: string; solicitudes: number; proyectos: number; contratos: number; monto: number }>();
  const fila = (servicio: string) => mapa.get(servicio) ?? (mapa.set(servicio, { servicio, solicitudes: 0, proyectos: 0, contratos: 0, monto: 0 }), mapa.get(servicio)!);
  const nombreServicio = new Map(s.serviciosPublicos.map(x => [x.slug, x.nombre]));
  s.solicitudes.filter(x => x.tipo === 'SERVICIO' && dentro(x.createdAt.slice(0, 10), desde, hasta))
    .forEach(x => fila(nombreServicio.get(x.servicioSlug ?? '') ?? x.servicioSlug ?? 'Servicio').solicitudes++);
  s.projects.filter(p => dentro(p.date, desde, hasta)).forEach(p => { const f = fila(p.type); f.proyectos++; f.monto = round2(f.monto + p.total); });
  s.contratos.filter(c => c.activo).forEach(c => { const f = fila(c.servicio); f.contratos++; f.monto = round2(f.monto + c.montoMensual); });
  return [...mapa.values()].map(v => ({ ...v, total: v.solicitudes + v.proyectos + v.contratos })).sort((a, b) => b.total - a.total || b.monto - a.monto);
}

// ---------------- Compras sugeridas ----------------
export interface SugerenciaCompra {
  sku: string;
  nombre: string;
  stock: number;
  minimo: number;
  ventaDiaria: number;
  diasCobertura: number | null; // null: no se vendió en el periodo
  sugerido: number;
  costoEstimado: number;
  motivo: string;
}

/**
 * Cuánto comprar para cubrir `diasObjetivo` días de venta sin bajar del mínimo.
 * Venta diaria = unidades vendidas en los últimos `diasHistoria` días / días.
 */
export function comprasSugeridas(s: ErpState, diasObjetivo = 30, diasHistoria = 30): SugerenciaCompra[] {
  const hasta = hoyLocal();
  const desde = sumarDias(hasta, -(diasHistoria - 1));
  return ventasPorProducto(s, desde, hasta)
    .map(v => {
      const ventaDiaria = Math.max(0, v.unidades) / diasHistoria;
      const necesario = Math.ceil(ventaDiaria * diasObjetivo + v.minimo);
      const sugerido = Math.max(0, necesario - Math.max(0, v.stock));
      const diasCobertura = ventaDiaria > 0 ? Math.floor(Math.max(0, v.stock) / ventaDiaria) : null;
      const motivo = v.stock <= 0 ? 'Agotado' : v.stock <= v.minimo ? 'Bajo el mínimo' : diasCobertura !== null && diasCobertura < diasObjetivo ? `Alcanza ${diasCobertura} día(s)` : 'Stock suficiente';
      return { sku: v.sku, nombre: v.nombre, stock: v.stock, minimo: v.minimo, ventaDiaria: round2(ventaDiaria), diasCobertura, sugerido, costoEstimado: round2(sugerido * v.costo), motivo };
    })
    .sort((a, b) => b.sugerido - a.sugerido || (a.diasCobertura ?? 1e9) - (b.diasCobertura ?? 1e9));
}

// ---------------- Almacén ----------------
export function reporteAlmacen(s: ErpState, desde: string, hasta: string) {
  const valorizacion = s.products.map(p => ({ sku: p.sku, nombre: p.name, ubicacion: p.location, stock: p.stock, costo: p.cost, valor: round2(Math.max(0, p.stock) * p.cost), valorVenta: round2(Math.max(0, p.stock) * p.price) }))
    .sort((a, b) => b.valor - a.valor);
  const movs = s.kardex.filter(k => dentro(k.date.slice(0, 10), desde, hasta));
  const porTipo = new Map<string, { entradas: number; salidas: number; movimientos: number }>();
  movs.forEach(k => {
    const f = porTipo.get(k.movementType) ?? { entradas: 0, salidas: 0, movimientos: 0 };
    f.entradas += k.quantityIn;
    f.salidas += k.quantityOut;
    f.movimientos++;
    porTipo.set(k.movementType, f);
  });
  // Rotación = unidades que salieron / stock actual (cuántas veces "giró" el inventario en el periodo)
  const salidas = new Map<string, number>();
  movs.forEach(k => salidas.set(k.productSku, (salidas.get(k.productSku) ?? 0) + k.quantityOut));
  const rotacion = s.products.map(p => {
    const sal = salidas.get(p.sku) ?? 0;
    return { sku: p.sku, nombre: p.name, salidas: sal, stock: p.stock, rotacion: p.stock > 0 ? round2(sal / p.stock) : sal > 0 ? null : 0 };
  }).sort((a, b) => b.salidas - a.salidas);
  const sinMovimiento = rotacion.filter(r => r.salidas === 0 && r.stock > 0);
  const mermas = s.losses.filter(l => dentro(l.date.slice(0, 10), desde, hasta));
  return {
    valorTotal: round2(valorizacion.reduce((a, v) => a + v.valor, 0)),
    valorVentaTotal: round2(valorizacion.reduce((a, v) => a + v.valorVenta, 0)),
    unidades: s.products.reduce((a, p) => a + Math.max(0, p.stock), 0),
    stockBajo: s.products.filter(p => p.stock <= p.minStock),
    valorizacion,
    porTipo: [...porTipo].map(([tipo, v]) => ({ tipo, ...v })),
    rotacion,
    sinMovimiento,
    mermas,
    perdidaMermas: round2(mermas.reduce((a, m) => a + m.totalLoss, 0))
  };
}

/** CSV simple con comillas escapadas (se abre en Excel). */
export function csv(filas: (string | number | null | undefined)[][]): string {
  return filas.map(f => f.map(v => {
    const t = String(v ?? '');
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }).join(',')).join('\n');
}
