// ==========================================
// ARCHIVOS PARA SUNAT
// SIRE (reemplazo de propuesta):
//   · RVIE — Anexo 3 (RS 112-2021/SUNAT, mod. RS 138-2023): 33 campos; del 34 al 40 los completa SUNAT.
//   · RCE  — Anexo 11 (RS 112-2021/SUNAT, mod. RS 040-2022): 37 campos; del 38 al 41 los completa SUNAT.
//   Nombre: LE + RUC + AAAAMM + 00 + libro (140400 / 080400) + 02 (reemplazo) + O + I + M + 2 .TXT, subido en ZIP.
// PLE:
//   · 5.1 Libro diario (050100) y 5.3 Detalle del plan contable utilizado (050300).
//   · 13.1 Registro del inventario permanente valorizado (130100) — Anexo 2 (RS 315-2018/SUNAT): 27 campos.
//   Nombre: LE + RUC + AAAAMM + 00 + libro + 00 + O + I + M + 1 .txt
// Campos separados por "|" y cada registro termina en "|".
// ==========================================
import type { ComprobanteSunat, EmpresaConfig, Gasto, Purchase } from '../domain/types';
import type { Asiento, Cuenta } from './contabilidad';
import type { Libro131 } from './kardexValorado';

const n2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const nq = (n: number) => (Number.isInteger(n) ? n.toFixed(2) : String(Math.round(n * 1e8) / 1e8));
const fecha = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const texto = (t: string | undefined, max: number) => (t ?? '').replace(/[|\r\n]+/g, ' ').trim().slice(0, max);
const linea = (campos: (string | number)[]) => `${campos.join('|')}|`;
const aaaamm = (periodo: string) => periodo.replace('-', '');

export const nombreSire = (ruc: string, periodo: string, libro: '140400' | '080400', conDatos: boolean) =>
  `LE${ruc}${aaaamm(periodo)}00${libro}021${conDatos ? 1 : 0}12.TXT`;
export const nombrePle = (ruc: string, periodo: string, libro: '050100' | '050300' | '130100', conDatos: boolean) =>
  `LE${ruc}${aaaamm(periodo)}00${libro}001${conDatos ? 1 : 0}11.txt`;

// ---------------- SIRE: RVIE ----------------
export interface ResultadoLibro {
  contenido: string;
  registros: number;
  omitidos: string[]; // qué no se incluyó y por qué
}

/** Número con el que el comprobante existe en SUNAT: el anotado (emisión externa) o el propio. */
const numeroSunat = (inv: ComprobanteSunat) => inv.numeroSunat ?? inv.id;
const emitido = (inv: ComprobanteSunat) => !!inv.numeroSunat || inv.estadoSunat === 'ACEPTADO';

export function generarRvie(empresa: EmpresaConfig, invoices: ComprobanteSunat[], periodo: string): ResultadoLibro {
  const omitidos: string[] = [];
  const filas: string[] = [];
  const delPeriodo = invoices.filter(i => ['01', '03', '07'].includes(i.tipoComprobante) && i.fechaEmision.startsWith(periodo));
  for (const inv of delPeriodo) {
    if (!emitido(inv)) { omitidos.push(`${inv.id}: aún no emitido en SUNAT`); continue; }
    const [serie, numero] = numeroSunat(inv).split('-');
    const nc = inv.tipoComprobante === '07';
    const k = nc ? -1 : 1;
    const conDoc = !!inv.cliente.numDoc && inv.cliente.tipoDoc !== '0';
    const original = nc ? invoices.find(x => x.id === inv.referencia) : undefined;
    const [serieOrig, numeroOrig] = original ? numeroSunat(original).split('-') : ['', ''];
    filas.push(linea([
      empresa.ruc, texto(empresa.razonSocial, 1500), aaaamm(periodo), '', fecha(inv.fechaEmision), '',
      inv.tipoComprobante, serie, String(Number(numero)), '',
      conDoc ? inv.cliente.tipoDoc : '', conDoc ? inv.cliente.numDoc : '', conDoc ? texto(inv.cliente.nombreRazonSocial, 1500) : '',
      '0.00', n2(k * inv.opGravadas), '0.00', n2(k * inv.totalIgv), '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00',
      n2(k * inv.montoTotal), 'PEN', '',
      original ? fecha(original.fechaEmision) : '', original ? original.tipoComprobante : '', serieOrig ?? '', numeroOrig ? String(Number(numeroOrig)) : '',
      ''
    ]));
  }
  return { contenido: filas.join('\r\n') + (filas.length ? '\r\n' : ''), registros: filas.length, omitidos };
}

// ---------------- SIRE: RCE ----------------
export function generarRce(empresa: EmpresaConfig, compras: Purchase[], gastos: Gasto[], periodo: string): ResultadoLibro {
  const omitidos: string[] = [];
  const filas: string[] = [];
  const fila = (f: { fecha: string; vence?: string; tipo: string; serie: string; numero: string; ruc: string; proveedor: string; baseDG: number; igvDG: number; noGravado: number; total: number }) =>
    linea([
      empresa.ruc, texto(empresa.razonSocial, 1500), aaaamm(periodo), '', fecha(f.fecha), f.vence ? fecha(f.vence) : '',
      f.tipo, texto(f.serie, 20), '', texto(f.numero, 20), '', '6', f.ruc, texto(f.proveedor, 1500),
      n2(f.baseDG), n2(f.igvDG), '0.00', '0.00', '0.00', '0.00', n2(f.noGravado), '0.00', '0.00', '0.00', n2(f.total), 'PEN', '',
      '', '', '', '', '', '', '', '', '', ''
    ]);
  for (const c of compras.filter(x => x.fecha.startsWith(periodo))) {
    const [serie, ...resto] = c.id.split('-');
    if (!resto.length) { omitidos.push(`Compra ${c.id}: el número debe tener el formato SERIE-NÚMERO`); continue; }
    filas.push(fila({ fecha: c.fecha, tipo: '01', serie, numero: String(Number(resto.join('')) || resto.join('')), ruc: c.ruc, proveedor: c.proveedor, baseDG: c.gravada, igvDG: c.igv, noGravado: 0, total: c.total }));
  }
  for (const g of gastos.filter(x => x.fecha.startsWith(periodo))) {
    if (g.tipoComprobante === '00' || g.tipoComprobante === '02') { omitidos.push(`${g.descripcion}: sin comprobante válido para el RCE`); continue; }
    if (!g.proveedorRuc || !g.serie || !g.numero) { omitidos.push(`${g.descripcion}: falta RUC, serie o número del comprobante`); continue; }
    const credito = g.tipoComprobante === '01' || g.tipoComprobante === '14';
    filas.push(fila({
      fecha: g.fecha, vence: g.tipoComprobante === '14' ? g.fechaPago ?? g.fecha : undefined, tipo: g.tipoComprobante, serie: g.serie, numero: g.numero,
      ruc: g.proveedorRuc, proveedor: g.proveedor ?? '', baseDG: credito ? g.base : 0, igvDG: credito ? g.igv : 0, noGravado: credito ? 0 : g.total, total: g.total
    }));
  }
  return { contenido: filas.join('\r\n') + (filas.length ? '\r\n' : ''), registros: filas.length, omitidos };
}

// ---------------- PLE 5.1 Libro diario y 5.3 Plan de cuentas utilizado ----------------
/** CUO de un movimiento de Kardex: "K" + su número (igual en el 5.1 y en el 13.1). */
export const cuoKardex = (id: string) => `K${Number(id.replace(/D/g, '')) || id.replace(/[^A-Za-z0-9]/g, '')}`;
/** CUO: identificador único del asiento. */
export const cuoDe = (a: Asiento) => (a.origen === 'KARDEX' && a.origenId ? cuoKardex(a.origenId) : `${a.origen.charAt(0)}${a.id}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 40);

export function generarPle51(asientos: Asiento[], periodo: string): ResultadoLibro {
  const per = `${aaaamm(periodo)}00`;
  const filas = asientos.flatMap(a => a.lineas.map((l, j) => linea([
    per, cuoDe(a), `M${j + 1}`, l.cuenta, '', '', 'PEN', '', '',
    a.tipoComprobante ?? '00', texto(a.serie, 20), texto(a.numero, 20),
    fecha(a.fecha), '', fecha(a.fecha), texto(a.glosa, 200), '', n2(l.debe), n2(l.haber), '', '1'
  ])));
  return { contenido: filas.join('\r\n') + (filas.length ? '\r\n' : ''), registros: filas.length, omitidos: [] };
}

export function generarPle53(plan: Map<string, Cuenta>, asientos: Asiento[], periodo: string): ResultadoLibro {
  const usadas = [...new Set(asientos.flatMap(a => a.lineas.map(l => l.cuenta)))].sort();
  const filas = usadas.map(c => linea([`${aaaamm(periodo)}00`, c, texto(plan.get(c)?.nombre ?? c, 100), '01', '', '', '', '1']));
  return { contenido: filas.join('\r\n') + (filas.length ? '\r\n' : ''), registros: filas.length, omitidos: [] };
}

// ---------------- PLE 13.1 Inventario permanente valorizado ----------------
export function generarPle131(empresa: EmpresaConfig, libros: Libro131[], periodo: string): ResultadoLibro {
  const per = `${aaaamm(periodo)}00`;
  const est = (empresa.codigoEstablecimiento || '0000').padStart(4, '0');
  const filas: string[] = [];
  const primerDia = `${periodo}-01`;
  for (const l of libros) {
    const comunes = (cuo: string, correlativo: number) => [per, cuo, `M${correlativo}`, est, '9', l.tipoExistencia, texto(l.sku, 24), '', ''];
    const cierre = (desc: string) => [texto(desc, 80), l.unidad, '1'];
    let n = 1;
    // La primera tupla es el saldo inicial (operación 16)
    filas.push(linea([...comunes(`SI${l.sku}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 40), n++), fecha(primerDia), '00', '0', '0', '16', ...cierre(l.descripcion),
      nq(l.saldoInicial.cantidad), nq(l.saldoInicial.costoUnitario), n2(l.saldoInicial.costoTotal), '0.00', '0.00', '0.00',
      nq(l.saldoInicial.cantidad), nq(l.saldoInicial.costoUnitario), n2(l.saldoInicial.costoTotal), '1']));
    for (const f of l.filas) {
      const e = f.entrada;
      const s = f.salida;
      filas.push(linea([...comunes(f.id ? cuoKardex(f.id) : `K${n}`, n++), fecha(f.fecha), f.tipoComprobante, f.serie || '0', f.numero || '0', f.tipoOperacion, ...cierre(l.descripcion),
        e ? nq(e.cantidad) : '0.00', e ? nq(e.costoUnitario) : '0.00', e ? n2(e.costoTotal) : '0.00',
        s ? nq(-s.cantidad) : '0.00', s ? nq(s.costoUnitario) : '0.00', s ? n2(-s.costoTotal) : '0.00',
        nq(f.saldo.cantidad), nq(f.saldo.costoUnitario), n2(f.saldo.costoTotal), '1']));
    }
  }
  return { contenido: filas.join('\r\n') + (filas.length ? '\r\n' : ''), registros: filas.length, omitidos: [] };
}

// ---------------- ZIP (sin compresión) para subir al SIRE ----------------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Empaqueta archivos de texto en un .zip (método "store"), como lo pide el SIRE para el reemplazo. */
export function zip(archivos: { nombre: string; contenido: string }[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const datos = enc.encode(a.contenido);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, 0, true);
    local.setUint32(14, crc, true); local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true); local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, datos);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, datos.length, true); cd.setUint32(24, datos.length, true); cd.setUint16(28, nombre.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nombre);
    offset += 30 + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], { type: "application/zip" });
}

export function descargar(nombre: string, datos: Blob | string) {
  const blob = typeof datos === 'string' ? new Blob([datos], { type: 'text/plain;charset=utf-8' }) : datos;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
