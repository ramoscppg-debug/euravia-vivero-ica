// ==========================================
// CONTABILIDAD PCGE 2026 (Plan Contable General Empresarial, NIIF vigentes al 1-1-2026)
// En la nube el libro diario lo escribe la base con disparadores, en la misma transacción de cada hecho.
// Aquí vive la misma dinámica para el modo demo y las utilidades del plan, el diario y el mayor.
// ==========================================
import type { CatalogProduct, ComprobanteSunat, Gasto, GastoCaja, KardexMovement, Purchase } from '../domain/types';

export interface Cuenta {
  codigo: string;
  nombre: string;
  elemento: number;
  padre?: string;
  nivel: number;
  naturaleza: 'DEUDORA' | 'ACREEDORA';
  aceptaMovimiento: boolean;
  personalizada?: boolean;
}

export interface LineaAsiento {
  cuenta: string;
  debe: number;
  haber: number;
  glosa?: string;
}

export interface Asiento {
  id: string;
  fecha: string;
  glosa: string;
  origen: 'KARDEX' | 'VENTA' | 'COMPRA' | 'COBRO' | 'MANUAL' | 'GASTO' | 'PAGO' | 'CAJA';
  origenId?: string;
  tipoComprobante?: string;
  serie?: string;
  numero?: string;
  lineas: LineaAsiento[];
}

/** Cuentas por tipo de existencia (SUNAT Tabla 5). */
export interface CuentasExistencia {
  tipoExistencia: string;
  descripcion: string;
  inventario: string;
  compra?: string;
  variacion?: string;
  costoVenta: string;
  venta: string;
  devolucionVenta: string;
  deterioro: string;
  variacionProduccion?: string;
}

/** Categorías de gasto frecuentes en un vivero, con su cuenta de último nivel del PCGE 2026. */
export const CATEGORIAS_GASTO: { cuenta: string; nombre: string }[] = [
  { cuenta: '6361', nombre: 'Luz (energía eléctrica)' },
  { cuenta: '6363', nombre: 'Agua' },
  { cuenta: '6364', nombre: 'Teléfono' },
  { cuenta: '6365', nombre: 'Internet' },
  { cuenta: '6362', nombre: 'Gas' },
  { cuenta: '63111', nombre: 'Fletes y transporte de carga' },
  { cuenta: '63112', nombre: 'Pasajes y movilidad' },
  { cuenta: '6314', nombre: 'Alimentación (viajes y jornadas)' },
  { cuenta: '6352', nombre: 'Alquiler del local' },
  { cuenta: '6343', nombre: 'Mantenimiento y reparaciones' },
  { cuenta: '6371', nombre: 'Publicidad' },
  { cuenta: '6323', nombre: 'Asesoría contable' },
  { cuenta: '6322', nombre: 'Asesoría legal y tributaria' },
  { cuenta: '638', nombre: 'Servicios de contratistas' },
  { cuenta: '6391', nombre: 'Comisiones y gastos bancarios' },
  { cuenta: '656', nombre: 'Útiles, combustible y suministros' },
  { cuenta: '651', nombre: 'Seguros' },
  { cuenta: '6431', nombre: 'Impuesto predial' },
  { cuenta: '6432', nombre: 'Arbitrios municipales' },
  { cuenta: '6434', nombre: 'Licencia de funcionamiento' },
  { cuenta: '6593', nombre: 'Otros gastos de gestión' }
];
export const nombreCategoria = (cuenta?: string) => CATEGORIAS_GASTO.find(c => c.cuenta === cuenta)?.nombre ?? (cuenta ? `Cuenta ${cuenta}` : 'Sin categoría');

export const ELEMENTOS: Record<number, string> = {
  1: 'Activo disponible y exigible', 2: 'Activo realizable', 3: 'Activo inmovilizado', 4: 'Pasivo', 5: 'Patrimonio',
  6: 'Gastos por naturaleza', 7: 'Ingresos por naturaleza', 8: 'Saldos intermediarios de gestión', 9: 'Gastos por categoría'
};

// Las mismas cuentas que siembra la migración 20260928120000 (el dueño o su contador pueden cambiarlas)
export const CUENTAS_EXISTENCIA: CuentasExistencia[] = [
  { tipoExistencia: '01', descripcion: 'Mercaderías', inventario: '20111', compra: '6011', variacion: '6111', costoVenta: '69121', venta: '70121', devolucionVenta: '70911', deterioro: '6951' },
  { tipoExistencia: '02', descripcion: 'Productos terminados (producción propia y cosecha)', inventario: '21111', costoVenta: '69221', venta: '70221', devolucionVenta: '70931', deterioro: '6952', variacionProduccion: '7111' },
  { tipoExistencia: '03', descripcion: 'Materias primas (sustratos, semillas, esquejes)', inventario: '24111', compra: '602', variacion: '6121', costoVenta: '69121', venta: '70121', devolucionVenta: '70911', deterioro: '6955' },
  { tipoExistencia: '04', descripcion: 'Envases y embalajes', inventario: '261', compra: '6041', variacion: '6141', costoVenta: '69121', venta: '70121', devolucionVenta: '70911', deterioro: '6957', variacionProduccion: '7141' },
  { tipoExistencia: '05', descripcion: 'Suministros diversos (bandejas, materiales auxiliares)', inventario: '251', compra: '6031', variacion: '6131', costoVenta: '69121', venta: '70121', devolucionVenta: '70911', deterioro: '6956' },
  { tipoExistencia: '99', descripcion: 'Otros', inventario: '20111', compra: '6011', variacion: '6111', costoVenta: '69121', venta: '70121', devolucionVenta: '70911', deterioro: '6951' }
];

export const CONFIG_CONTABLE: Record<string, { cuenta: string; descripcion: string }> = {
  CAJA: { cuenta: '101', descripcion: 'Cobros y pagos en efectivo' },
  BANCOS: { cuenta: '1041', descripcion: 'Cobros con Yape, Plin, tarjeta o transferencia' },
  CXC: { cuenta: '1212', descripcion: 'Comprobantes por cobrar a clientes' },
  IGV: { cuenta: '40111', descripcion: 'IGV – Cuenta propia' },
  CXP: { cuenta: '4212', descripcion: 'Facturas por pagar a proveedores' },
  VENTA_SERV: { cuenta: '70321', descripcion: 'Venta de servicios (jardinería, delivery)' },
  COSTO_SERV: { cuenta: '69321', descripcion: 'Costo de los materiales usados en servicios' },
  DEVOL_SERV: { cuenta: '70941', descripcion: 'Devoluciones de servicios' },
  APERTURA: { cuenta: '5911', descripcion: 'Contrapartida del inventario inicial (ajústala con tu contador)' },
  FALTANTES: { cuenta: '6593', descripcion: 'Faltantes de inventario sin causa' },
  SOBRANTES: { cuenta: '7599', descripcion: 'Sobrantes de inventario' }
};

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Tipo de existencia del producto (Tabla 5); sin elegir, sustratos y fertilizantes son materia prima. */
export const tipoExistenciaDe = (p?: CatalogProduct) => p?.tipoExistencia ?? (p && ['sustratos', 'fertilizantes'].includes(p.category) ? '03' : '01');
const D = (cuenta: string, monto: number): LineaAsiento => ({ cuenta, debe: r4(monto), haber: 0 });
const H = (cuenta: string, monto: number): LineaAsiento => ({ cuenta, debe: 0, haber: r4(monto) });

/** Plan de cuentas con jerarquía por prefijo (el padre es el prefijo existente más largo). */
export function armarPlan(filas: [string, string][]): Cuenta[] {
  const codigos = new Set(filas.map(f => f[0]));
  const padreDe = (c: string) => { for (let n = c.length - 1; n >= 2; n--) if (codigos.has(c.slice(0, n))) return c.slice(0, n); return undefined; };
  const conHijos = new Set(filas.map(f => padreDe(f[0])).filter(Boolean) as string[]);
  return filas.map(([codigo, nombre]) => {
    const elemento = Number(codigo[0]);
    const acreedora = /^(19|29|36|39)/.test(codigo) || ([4, 5, 7, 8].includes(elemento) && !codigo.startsWith('88'));
    return { codigo, nombre, elemento, padre: padreDe(codigo), nivel: codigo.length, naturaleza: acreedora ? 'ACREEDORA' : 'DEUDORA', aceptaMovimiento: !conHijos.has(codigo) };
  });
}

/** "21111 Costo" se entiende mejor con su ruta: Productos terminados › Costo. */
export function rutaCuenta(plan: Map<string, Cuenta>, codigo: string): string {
  const partes: string[] = [];
  for (let c = plan.get(codigo); c; c = c.padre ? plan.get(c.padre) : undefined) partes.unshift(c.nombre);
  // Evita repetir el mismo nombre en niveles seguidos (211 Productos terminados › 2111 Productos terminados)
  return partes.filter((p, i) => p !== partes[i - 1]).slice(-3).join(' › ');
}

/**
 * Dinámica contable desde el Kardex (modo demo). Misma regla que public.contabilizar_kardex:
 * consumo 61 a 24/25/26 · producción 21 a 711 · compra 60 a 42 y destino 2x a 61 · venta 69 a 2x · merma 695 a 2x.
 */
export function asientoDeKardex(m: KardexMovement, producto: CatalogProduct | undefined, cuentas = CUENTAS_EXISTENCIA, cfg = CONFIG_CONTABLE): Asiento | null {
  const monto = r4(m.costoTotal ?? 0);
  if (!(monto > 0) || !m.tipoOperacion) return null;
  const tipo = m.tipoOperacion === '19' ? '02' : tipoExistenciaDe(producto);
  const c = cuentas.find(x => x.tipoExistencia === tipo) ?? cuentas[0];
  const b = cuentas[0];
  const nombre = producto?.name ?? m.productName;
  let glosa: string;
  let lineas: LineaAsiento[];
  switch (m.tipoOperacion) {
    case '02': glosa = `Compra de ${nombre}`; lineas = [D(c.compra ?? b.compra!, monto), H(cfg.CXP.cuenta, monto), D(c.inventario, monto), H(c.variacion ?? b.variacion!, monto)]; break;
    case '01': glosa = `Costo de venta de ${nombre}`; lineas = [D(c.costoVenta, monto), H(c.inventario, monto)]; break;
    case '05': glosa = `Devolución de ${nombre}`; lineas = [D(c.inventario, monto), H(c.costoVenta, monto)]; break;
    case '10': glosa = `Consumo de ${nombre} en producción`; lineas = [D(c.variacion ?? b.variacion!, monto), H(c.inventario, monto)]; break;
    case '19': glosa = `Producción propia de ${nombre}`; lineas = [D(c.inventario, monto), H(c.variacionProduccion ?? '7111', monto)]; break;
    case '13':
    case '14': glosa = `${m.tipoOperacion === '13' ? 'Merma' : 'Desmedro'} de ${nombre}`; lineas = [D(c.deterioro, monto), H(c.inventario, monto)]; break;
    case '16': glosa = `Inventario inicial de ${nombre}`; lineas = [D(c.inventario, monto), H(cfg.APERTURA.cuenta, monto)]; break;
    default:
      if (m.movimiento === 'ENTRADA') { glosa = `Sobrante de ${nombre}`; lineas = [D(c.inventario, monto), H(cfg.SOBRANTES.cuenta, monto)]; }
      else if (m.tipoOperacion === '99') { glosa = `Materiales de ${nombre} usados en servicio`; lineas = [D(cfg.COSTO_SERV.cuenta, monto), H(c.inventario, monto)]; }
      else { glosa = `Faltante de ${nombre}`; lineas = [D(cfg.FALTANTES.cuenta, monto), H(c.inventario, monto)]; }
  }
  return { id: `K-${m.id}`, fecha: m.fechaEmision ?? m.date, glosa: `${glosa} (${m.referenceDoc ?? 'Kardex'})`, origen: 'KARDEX', origenId: m.id, tipoComprobante: m.tipoComprobante, serie: m.comprobanteSerie, numero: m.comprobanteNumero, lineas };
}

/** Venta o nota de crédito: 1212 a 40111 + 70 (o al revés). La base de cada ítem va a la cuenta de su tipo de existencia. */
export function asientoDeComprobante(inv: ComprobanteSunat, productos: CatalogProduct[], cuentas = CUENTAS_EXISTENCIA, cfg = CONFIG_CONTABLE): Asiento | null {
  const total = r4(inv.montoTotal);
  if (!(total > 0)) return null;
  const nc = inv.tipoComprobante === '07';
  const porCuenta = new Map<string, number>();
  for (const it of inv.items) {
    const p = productos.find(x => x.sku === it.sku);
    const c = cuentas.find(x => x.tipoExistencia === tipoExistenciaDe(p)) ?? cuentas[0];
    const cuenta = p ? (nc ? c.devolucionVenta : c.venta) : nc ? cfg.DEVOL_SERV.cuenta : cfg.VENTA_SERV.cuenta;
    porCuenta.set(cuenta, r4((porCuenta.get(cuenta) ?? 0) + (it.subtotal ?? it.total / 1.18)));
  }
  const igv = r4(inv.totalIgv);
  const bases = [...porCuenta].sort((a, b) => a[1] - b[1]);
  const diferencia = r4(total - igv - bases.reduce((a, [, v]) => a + v, 0));
  if (bases.length && diferencia) bases[bases.length - 1][1] = r4(bases[bases.length - 1][1] + diferencia); // céntimos de redondeo
  const ingresos = bases.map(([cuenta, v]) => (nc ? D(cuenta, v) : H(cuenta, v)));
  const lineas = nc ? [...ingresos, D(cfg.IGV.cuenta, igv), H(cfg.CXC.cuenta, total)] : [D(cfg.CXC.cuenta, total), ...ingresos, H(cfg.IGV.cuenta, igv)];
  return {
    id: `V-${inv.id}`, fecha: inv.fechaEmision, glosa: `${nc ? 'Nota de crédito' : 'Venta'} ${inv.id} · ${inv.cliente.nombreRazonSocial}`, origen: 'VENTA', origenId: inv.id,
    tipoComprobante: ['01', '03', '07'].includes(inv.tipoComprobante) ? inv.tipoComprobante : '00', serie: inv.serie, numero: String(inv.correlativo).padStart(8, '0'),
    lineas: lineas.filter(l => l.debe > 0 || l.haber > 0)
  };
}

export function asientoDeCompra(p: Purchase, cfg = CONFIG_CONTABLE): Asiento | null {
  if (!(p.igv > 0)) return null;
  return { id: `C-${p.ruc}-${p.id}`, fecha: p.fecha, glosa: `IGV de la compra ${p.id} · ${p.proveedor}`, origen: 'COMPRA', origenId: p.id, tipoComprobante: '01', lineas: [D(cfg.IGV.cuenta, p.igv), H(cfg.CXP.cuenta, p.igv)] };
}

/** Cobro de un comprobante con sus medios de pago (efectivo a caja, lo demás a bancos). */
export function asientoDeCobro(inv: ComprobanteSunat, cfg = CONFIG_CONTABLE): Asiento | null {
  const pagos = (inv.pagos ?? []).filter(p => p.monto > 0);
  if (!pagos.length) return null;
  const nc = inv.tipoComprobante === '07';
  const total = r4(pagos.reduce((a, p) => a + p.monto, 0));
  const disp = (m: string) => (m === 'Efectivo' ? cfg.CAJA.cuenta : cfg.BANCOS.cuenta);
  const porCuenta = new Map<string, number>();
  pagos.forEach(p => porCuenta.set(disp(p.medio), r4((porCuenta.get(disp(p.medio)) ?? 0) + p.monto)));
  const lineas = nc
    ? [D(cfg.CXC.cuenta, total), ...[...porCuenta].map(([c, v]) => H(c, v))]
    : [...[...porCuenta].map(([c, v]) => D(c, v)), H(cfg.CXC.cuenta, total)];
  return { id: `P-${inv.id}`, fecha: inv.fechaEmision, glosa: `${nc ? 'Reembolso' : 'Cobro'} ${inv.id} · ${pagos.map(p => p.medio).join(' + ')}`, origen: 'COBRO', origenId: inv.id, lineas };
}

/** Gasto con comprobante: 6x (+ 40111) a 4212; si se pagó, 4212 a caja o bancos. */
export function asientosDeGasto(g: Gasto, cfg = CONFIG_CONTABLE): Asiento[] {
  const doc = [g.serie, g.numero].filter(Boolean).join('-');
  const a: Asiento[] = [{
    id: `G-${g.id}`, fecha: g.fecha, glosa: `${g.descripcion}${g.proveedor ? ` · ${g.proveedor}` : ''}${doc ? ` (${doc})` : ''}`, origen: 'GASTO', origenId: g.id,
    tipoComprobante: g.tipoComprobante, serie: g.serie, numero: g.numero,
    lineas: [D(g.cuenta, g.base), ...(g.igv > 0 ? [D(cfg.IGV.cuenta, g.igv)] : []), H(cfg.CXP.cuenta, g.total)]
  }];
  if (g.medioPago) a.push({ id: `GP-${g.id}`, fecha: g.fecha, glosa: `Pago de ${g.descripcion} · ${g.medioPago}${g.operacion ? ` op. ${g.operacion}` : ''}`, origen: 'PAGO', origenId: g.id,
    lineas: [D(cfg.CXP.cuenta, g.total), H(g.medioPago === 'Efectivo' ? cfg.CAJA.cuenta : cfg.BANCOS.cuenta, g.total)] });
  return a;
}

/** Vale de caja chica con categoría: 6x a 101 Caja. */
export function asientoDeCajaChica(g: GastoCaja, cfg = CONFIG_CONTABLE): Asiento | null {
  if (!g.cuenta || !(g.monto > 0)) return null;
  return { id: `CC-${g.id}`, fecha: g.fecha, glosa: `Caja chica: ${g.motivo}`, origen: 'CAJA', origenId: g.id, tipoComprobante: '00', lineas: [D(g.cuenta, g.monto), H(cfg.CAJA.cuenta, g.monto)] };
}

/** Libro diario del modo demo, derivado de los hechos registrados. */
export function diarioDemo(s: { kardex: KardexMovement[]; products: CatalogProduct[]; invoices: ComprobanteSunat[]; purchases: Purchase[]; gastos?: Gasto[]; gastosCaja?: GastoCaja[] }): Asiento[] {
  const asientos: Asiento[] = [];
  (s.gastos ?? []).forEach(g => asientos.push(...asientosDeGasto(g)));
  (s.gastosCaja ?? []).forEach(g => { const a = asientoDeCajaChica(g); if (a) asientos.push(a); });
  s.invoices.forEach(inv => { const a = asientoDeComprobante(inv, s.products); if (a) asientos.push(a); const c = asientoDeCobro(inv); if (c) asientos.push(c); });
  s.purchases.forEach(p => { const a = asientoDeCompra(p); if (a) asientos.push(a); });
  s.kardex.forEach(m => { const a = asientoDeKardex(m, s.products.find(p => p.sku === m.productSku)); if (a) asientos.push(a); });
  return asientos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}

export const cuadra = (a: Asiento) => r4(a.lineas.reduce((s, l) => s + l.debe - l.haber, 0)) === 0;

/** Libro mayor: saldo por cuenta (y acumulado a sus cuentas superiores si se pide). */
export function mayor(asientos: Asiento[], plan: Map<string, Cuenta>) {
  const saldos = new Map<string, { debe: number; haber: number; movimientos: number }>();
  for (const a of asientos) for (const l of a.lineas) {
    const s = saldos.get(l.cuenta) ?? { debe: 0, haber: 0, movimientos: 0 };
    s.debe = r4(s.debe + l.debe);
    s.haber = r4(s.haber + l.haber);
    s.movimientos++;
    saldos.set(l.cuenta, s);
  }
  return [...saldos].map(([codigo, s]) => {
    const c = plan.get(codigo);
    const saldo = r4(s.debe - s.haber);
    return { codigo, nombre: c ? rutaCuenta(plan, codigo) : codigo, elemento: c?.elemento ?? Number(codigo[0]), ...s, saldoDeudor: saldo > 0 ? saldo : 0, saldoAcreedor: saldo < 0 ? -saldo : 0 };
  }).sort((a, b) => a.codigo.localeCompare(b.codigo));
}
