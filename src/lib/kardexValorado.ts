// ==========================================
// REGISTRO DE INVENTARIO PERMANENTE VALORADO · SUNAT Formato 13.1
// Costo promedio ponderado. En la nube el cálculo lo hace la base (trigger del Kardex, con el producto
// bloqueado); aquí está la misma regla para el modo demo y para armar el libro por periodo.
// ==========================================
import type { CatalogProduct, KardexMovement, MovementType } from '../domain/types';

/** SUNAT Tabla 10: tipo de comprobante o documento. */
export const TABLA_10: Record<string, string> = {
  '00': 'Otros', '01': 'Factura', '03': 'Boleta de venta', '07': 'Nota de crédito', '09': 'Guía de remisión remitente'
};

/** SUNAT Tabla 12: tipo de operación. */
export const TABLA_12: Record<string, string> = {
  '01': 'Venta', '02': 'Compra', '05': 'Devolución recibida', '06': 'Devolución entregada', '10': 'Salida a producción',
  '13': 'Mermas', '14': 'Desmedros', '16': 'Saldo inicial', '19': 'Entrada de producción', '28': 'Ajuste por diferencia de inventario', '99': 'Otros'
};

/** SUNAT Tabla 5 (tipo de existencia) y Tabla 6 (unidad de medida), las que usa un vivero. */
export const TABLA_5: Record<string, string> = { '01': 'Mercaderías', '02': 'Productos terminados', '03': 'Materias primas y auxiliares', '04': 'Envases y embalajes', '05': 'Suministros diversos', '99': 'Otros' };
export const TABLA_6: Record<string, string> = { NIU: 'Unidad', KGM: 'Kilogramo', LTR: 'Litro', BG: 'Bolsa', MTR: 'Metro' };

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export interface Saldo {
  cantidad: number;
  costoTotal: number;
  costoUnitario: number;
}

export interface Valorizado {
  movimiento: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  saldo: Saldo;
}

/**
 * Aplica un movimiento con costo promedio ponderado.
 * ENTRADA: suma cantidad y costo; el promedio = saldo total / saldo cantidad.
 * SALIDA: sale al promedio vigente; el promedio no cambia.
 */
export function aplicarPromedio(prev: Saldo, mov: { movimiento: 'ENTRADA' | 'SALIDA'; cantidad: number; costoUnitario?: number }): Valorizado {
  const q = r4(mov.cantidad);
  if (!(q > 0)) throw new Error('La cantidad del movimiento debe ser mayor a cero.');
  const promedio = prev.cantidad > 0 ? r4(prev.costoTotal / prev.cantidad) : prev.costoUnitario;
  if (mov.movimiento === 'ENTRADA') {
    const cu = r4(mov.costoUnitario ?? promedio);
    const ct = r4(q * cu);
    const cantidad = r4(prev.cantidad + q);
    const costoTotal = r4(prev.costoTotal + ct);
    return { movimiento: 'ENTRADA', cantidad: q, costoUnitario: cu, costoTotal: ct, saldo: { cantidad, costoTotal, costoUnitario: cantidad > 0 ? r4(costoTotal / cantidad) : cu } };
  }
  if (prev.cantidad < q) throw new Error(`Stock insuficiente: hay ${prev.cantidad}, se piden ${q}.`);
  const ct = r4(q * promedio);
  const cantidad = r4(prev.cantidad - q);
  return { movimiento: 'SALIDA', cantidad: q, costoUnitario: promedio, costoTotal: ct, saldo: { cantidad, costoTotal: cantidad === 0 ? 0 : Math.max(0, r4(prev.costoTotal - ct)), costoUnitario: promedio } };
}

/** Tabla 12 y Tabla 10 a partir del concepto y del documento (la misma regla que public.kardex_codigos). */
export function codigosSunat(tipo: MovementType, doc = '', tipoBaja?: string): { tipoComprobante: string; tipoOperacion: string; serie: string; numero: string } {
  const d = doc.toUpperCase();
  let tipoOperacion = ({
    'Compra Proveedor': '02', 'Venta Cliente': '01', 'Devolucion Cliente': '05', 'Entrada por Produccion': '19', 'Salida a Produccion': '10'
  } as Record<string, string>)[tipo] ?? '99';
  if (tipo === 'Ajuste Inventario') tipoOperacion = d === 'INV-INICIAL' ? '16' : '28';
  if (tipo === 'Baja por Perdida') tipoOperacion = tipoBaja === 'DESMEDRO_PLAGA' || tipoBaja === 'ROTURA_MECANICA' ? '14' : '13';
  const m = d.match(/^([A-Z0-9]{1,4})-(\d{1,8})$/);
  if (m) {
    const serie = m[1];
    const tipoComprobante = tipoOperacion === '05' ? '07' : tipo === 'Compra Proveedor' ? '01' : serie.startsWith('T') ? '09' : serie.startsWith('F') ? '01' : serie.startsWith('B') ? '03' : '00';
    return { tipoComprobante, tipoOperacion, serie, numero: m[2].padStart(8, '0') };
  }
  return { tipoComprobante: tipo === 'Compra Proveedor' && d ? '01' : '00', tipoOperacion, serie: '0000', numero: d.replace(/[^A-Z0-9]/g, '').padStart(8, '0').slice(0, 8) };
}

/** Saldo valorizado actual de un producto (si aún no tiene uno guardado, se valoriza stock × costo). */
export const saldoDe = (p: CatalogProduct): Saldo => {
  const costoTotal = p.valorInventario ?? r4(Math.max(0, p.stock) * p.cost);
  return { cantidad: Math.max(0, p.stock), costoTotal, costoUnitario: p.costoPromedio ?? (p.stock > 0 ? r4(costoTotal / p.stock) : p.cost) };
};

// ---------------- Libro 13.1 por periodo ----------------
export interface Fila131 {
  id?: string; // movimiento de Kardex (CUO del asiento)
  fecha: string;
  tipoComprobante: string;
  serie: string;
  numero: string;
  tipoOperacion: string;
  entrada?: { cantidad: number; costoUnitario: number; costoTotal: number };
  salida?: { cantidad: number; costoUnitario: number; costoTotal: number };
  saldo: Saldo;
}

export interface Libro131 {
  sku: string;
  descripcion: string;
  tipoExistencia: string;
  unidad: string;
  saldoInicial: Saldo;
  filas: Fila131[];
  totales: { entradas: number; costoEntradas: number; salidas: number; costoSalidas: number };
}

/**
 * Arma el libro de cada producto: saldo inicial al primer día del periodo y los movimientos del periodo.
 * Usa los saldos que guardó la base; si un movimiento no los tiene (datos antiguos o demo), los recalcula en orden.
 */
export function libro131(productos: CatalogProduct[], kardex: KardexMovement[], desde: string, hasta: string): Libro131[] {
  const porSku = new Map<string, KardexMovement[]>();
  [...kardex].sort((a, b) => (a.fechaEmision ?? a.date).localeCompare(b.fechaEmision ?? b.date) || a.id.localeCompare(b.id))
    .forEach(m => porSku.set(m.productSku, [...(porSku.get(m.productSku) ?? []), m]));

  return productos.map(p => {
    let saldo: Saldo = { cantidad: 0, costoTotal: 0, costoUnitario: p.cost };
    let saldoInicial: Saldo | null = null;
    const filas: Fila131[] = [];
    for (const m of porSku.get(p.sku) ?? []) {
      const fecha = m.fechaEmision ?? m.date;
      if (fecha > hasta) break;
      const entrada = (m.movimiento ?? (m.quantityIn > 0 ? 'ENTRADA' : 'SALIDA')) === 'ENTRADA';
      const cantidad = m.cantidad ?? (entrada ? m.quantityIn : m.quantityOut);
      if (!(cantidad > 0)) continue;
      let v: Valorizado;
      if (m.saldoCostoTotal !== undefined && m.costoTotal !== undefined && m.saldoCantidad !== undefined) {
        v = { movimiento: entrada ? 'ENTRADA' : 'SALIDA', cantidad, costoUnitario: m.unitCost, costoTotal: m.costoTotal, saldo: { cantidad: m.saldoCantidad, costoTotal: m.saldoCostoTotal, costoUnitario: m.saldoCostoUnitario ?? 0 } };
      } else {
        try {
          v = aplicarPromedio(saldo, { movimiento: entrada ? 'ENTRADA' : 'SALIDA', cantidad, costoUnitario: entrada ? m.unitCost : undefined });
        } catch {
          continue; // historial demo inconsistente: se omite la línea
        }
      }
      if (fecha < desde) {
        saldo = v.saldo;
        continue;
      }
      if (!saldoInicial) saldoInicial = saldo;
      const cod = m.tipoOperacion ? { tipoComprobante: m.tipoComprobante ?? '00', tipoOperacion: m.tipoOperacion, serie: m.comprobanteSerie ?? '0000', numero: m.comprobanteNumero ?? '' } : codigosSunat(m.movementType, m.referenceDoc);
      const mov = { cantidad: v.cantidad, costoUnitario: v.costoUnitario, costoTotal: v.costoTotal };
      filas.push({ id: m.id, fecha, ...cod, entrada: entrada ? mov : undefined, salida: entrada ? undefined : mov, saldo: v.saldo });
      saldo = v.saldo;
    }
    const suma = (k: 'entrada' | 'salida', c: 'cantidad' | 'costoTotal') => r4(filas.reduce((a, f) => a + (f[k]?.[c] ?? 0), 0));
    return {
      sku: p.sku, descripcion: p.name, tipoExistencia: p.tipoExistencia ?? '01', unidad: p.unidadMedida ?? 'NIU',
      saldoInicial: saldoInicial ?? saldo, filas,
      totales: { entradas: suma('entrada', 'cantidad'), costoEntradas: suma('entrada', 'costoTotal'), salidas: suma('salida', 'cantidad'), costoSalidas: suma('salida', 'costoTotal') }
    };
  });
}
