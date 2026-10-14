// ==========================================
// PRE-COTIZACIÓN (puro)
// Línea: concepto, unidad, cantidad, precio unitario SIN IGV y afectación.
// Valor venta = cantidad × precio; IGV 18% sólo en lo gravado y sólo si "con IGV" (boleta o factura).
// El mismo HTML sirve para imprimir/PDF y para la página que ve el cliente con su enlace.
// ==========================================
import type { EmpresaConfig } from '../domain/types';
import { esc } from './documentos';

export type Afectacion = 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
export const AFECTACIONES: Afectacion[] = ['GRAVADO', 'EXONERADO', 'INAFECTO'];
export const UNIDADES = ['UND', 'M2', 'ML', 'M3', 'KG', 'SACO', 'PAQ', 'GLB', 'SERV.', 'HORA'];

export interface LineaPrecotizacion {
  concepto: string;
  unidad: string;
  cantidad: number;
  precio: number; // valor unitario sin IGV
  afectacion: Afectacion;
  sku?: string; // si viene del catálogo
}

export type ComprobanteSolicitado = 'NINGUNO' | 'BOLETA' | 'FACTURA';
export const COMPROBANTE_SOLICITADO: Record<ComprobanteSolicitado, string> = { NINGUNO: 'Sin comprobante (sin IGV)', BOLETA: 'Boleta', FACTURA: 'Factura' };

export interface PagoPrecotizacion { fecha: string; monto: number; medio: string; operacion?: string }

/** Comprobante emitido en el portal SUNAT: se anota su número y el enlace (Drive) del PDF. */
export interface ComprobantePrecotizacion { tipo: '01' | '03'; numero: string; fecha: string; url: string; enviadoAt?: string }
export const NOMBRE_CPE = { '01': 'Factura', '03': 'Boleta' } as const;

export interface Precotizacion {
  id: string;
  numero: string;
  token: string;
  fecha: string;
  validezDias: number;
  cliente: { nombre: string; doc?: string; telefono?: string; direccion?: string };
  /** NINGUNO = sin IGV; BOLETA o FACTURA = con IGV (la factura exige RUC). */
  comprobante: ComprobanteSolicitado;
  conIgv: boolean;
  lineas: LineaPrecotizacion[];
  condiciones: string[];
  notas?: string;
  opGravadas: number;
  opExoneradas: number;
  opInafectas: number;
  igv: number;
  total: number;
  estado: 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'PAGADA' | 'RECHAZADA';
  pagos: PagoPrecotizacion[];
  comprobantes: ComprobantePrecotizacion[];
}

export const TASA = 0.18;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Valor, IGV y total de cada línea y de la cotización (como la tabla del modelo). */
export function calcularPrecotizacion(lineas: LineaPrecotizacion[], conIgv: boolean) {
  const filas = lineas.map(l => {
    const valor = r2(l.cantidad * l.precio);
    const igv = conIgv && l.afectacion === 'GRAVADO' ? r2(valor * TASA) : 0;
    return { ...l, valor, igv, total: r2(valor + igv) };
  });
  const suma = (af: Afectacion) => r2(filas.filter(f => f.afectacion === af).reduce((a, f) => a + f.valor, 0));
  const opGravadas = suma('GRAVADO');
  const opExoneradas = suma('EXONERADO');
  const opInafectas = suma('INAFECTO');
  const igv = r2(filas.reduce((a, f) => a + f.igv, 0));
  return { filas, opGravadas, opExoneradas, opInafectas, igv, valor: r2(opGravadas + opExoneradas + opInafectas), total: r2(opGravadas + opExoneradas + opInafectas + igv) };
}

/** Las no aceptadas (sin pagos) se eliminan a los 20 días de su fecha; la base lo hace cada noche. */
export const DIAS_ELIMINACION = 20;
export const seEliminaEl = (c: Pick<Precotizacion, 'estado' | 'pagos' | 'fecha'>): string | null =>
  (c.estado === 'BORRADOR' || c.estado === 'ENVIADA' || c.estado === 'RECHAZADA') && !c.pagos.length
    ? new Date(Date.parse(c.fecha) + (DIAS_ELIMINACION + 1) * 86_400_000).toISOString().slice(0, 10)
    : null;
/** Igual regla para las cotizaciones del carrito (enviadas o rechazadas). */
export const cotizacionSeEliminaEl = (c: { estado: string; fecha: string; comprobanteId?: string }): string | null =>
  (c.estado === 'ENVIADA' || c.estado === 'RECHAZADA') && !c.comprobanteId
    ? new Date(Date.parse(c.fecha) + (DIAS_ELIMINACION + 1) * 86_400_000).toISOString().slice(0, 10)
    : null;

export const pagado = (c: Pick<Precotizacion, 'pagos'>) => r2(c.pagos.reduce((a, p) => a + p.monto, 0));
export const saldo = (c: Pick<Precotizacion, 'pagos' | 'total'>) => r2(c.total - pagado(c));

/** Condiciones del modelo; la primera cambia según se considere el IGV. */
export function condicionesBase(conIgv: boolean, validezDias = 15, hayExonerados = false): string[] {
  return [
    conIgv ? 'Precios expresados en Soles (S/). El IGV (18%) se detalla por ítem.' : 'Precios expresados en Soles (S/), sin IGV. Si requiere boleta o factura se agrega el IGV (18%) a lo gravado.',
    ...(hayExonerados ? ['Los ítems exonerados no llevan IGV; el resto de ítems está gravado.'] : []),
    `Validez de la cotización: ${validezDias} días calendario.`,
    'Forma de pago: a coordinar (50% adelanto / 50% contra entrega).',
    'Tiempo de entrega/instalación: a coordinar según disponibilidad.'
  ];
}

const dinero = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const venceEl = (fecha: string, dias: number) => new Date(Date.parse(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
const ddmmaaaa = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

export interface EmpresaDoc {
  ruc?: string; razonSocial?: string; nombreComercial?: string; direccion?: string; cuentaBcp?: string; whatsapp?: string; email?: string;
  firmanteNombre?: string; firmanteCargo?: string;
}
export const empresaDoc = (e: EmpresaConfig, contacto: { whatsapp?: string; email?: string }): EmpresaDoc =>
  ({ ruc: e.ruc, razonSocial: e.razonSocial, nombreComercial: e.nombreComercial, direccion: e.direccion, cuentaBcp: e.cuentaBcpSoles, whatsapp: contacto.whatsapp, email: contacto.email || e.email,
     firmanteNombre: e.firmanteNombre, firmanteCargo: e.firmanteCargo });

/** Estilos del documento (los usa el PDF y la página del cliente). */
export const ESTILO_PRECOTIZACION = `
  .pc{max-width:900px;margin:0 auto;padding:28px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;font-size:12px}
  .pc table{width:100%;border-collapse:collapse}
  .pc .det th{background:#1f3a68;color:#fff;font-size:10px;text-transform:uppercase;padding:9px 8px;border:1px solid #1f3a68;text-align:center}
  .pc .det td{border:1px solid #334155;padding:8px;vertical-align:middle}
  .pc .det tr:nth-child(even) td{background:#f1f5f9}
  .pc .d{text-align:right;white-space:nowrap} .pc .c{text-align:center}
  .pc .tot td{background:#dbe6f3;font-weight:800;border:1px solid #334155;padding:8px}
  .pc .res td{border:1px solid #334155;padding:9px 12px;font-size:13px}
  .pc .res tr:last-child td{background:#dbe6f3;font-weight:800;font-size:15px}
  .pc .ex{font-weight:800}
  .pc .formal{font-size:13px;line-height:1.6;margin:0 0 12px}
`;

export function htmlPrecotizacion(c: Omit<Precotizacion, 'id' | 'token'>, e: EmpresaDoc): string {
  const calc = calcularPrecotizacion(c.lineas, c.conIgv);
  const nombre = e.nombreComercial?.split(' - ')[0] || e.razonSocial || 'AUREVIA';
  // Sin IGV no se muestran la afectación ni el IGV: sólo precio y total
  const filas = calc.filas.map((f, i) => `<tr><td class="c">${i + 1}</td><td>${esc(f.concepto.toUpperCase())}</td><td class="c">${esc(f.unidad)}</td><td class="c">${f.cantidad}</td>
    <td class="d">${dinero(f.precio)}</td>${c.conIgv ? `<td class="c ${f.afectacion !== 'GRAVADO' ? 'ex' : ''}">${f.afectacion}</td><td class="d">${dinero(f.valor)}</td><td class="d">${dinero(f.igv)}</td>` : ''}<td class="d">${dinero(f.total)}</td></tr>`).join('');
  const exon = calc.filas.filter(f => f.afectacion === 'EXONERADO').map(f => f.concepto.toLowerCase());
  const pag = pagado(c);
  return `<div class="pc">
    <header style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:16px">
      <div style="display:flex;gap:14px;align-items:center">
        <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/logo.jpg" alt="${esc(nombre)}" style="width:72px;height:72px;border-radius:14px;object-fit:cover">
        <div><div style="font-size:22px;font-weight:800;letter-spacing:.12em;color:#15803d">${esc(nombre.toUpperCase())}</div>
        ${e.razonSocial ? `<div>${esc(e.razonSocial)}</div>` : ''}${e.direccion ? `<div style="color:#475569">${esc(e.direccion)}</div>` : ''}
        <div style="color:#475569">${[e.whatsapp && `WhatsApp ${esc(e.whatsapp)}`, e.email && esc(e.email)].filter(Boolean).join(' · ')}</div></div>
      </div>
      <div style="border:2px solid #1f3a68;border-radius:12px;padding:10px 16px;text-align:center;min-width:210px">
        ${e.ruc ? `<div style="font-weight:700">RUC ${esc(e.ruc)}</div>` : ''}
        <div style="font-size:15px;font-weight:800;color:#1f3a68">PRE-COTIZACIÓN</div><div style="font-weight:700">N° ${esc(c.numero)}</div></div>
    </header>
    <table style="margin-bottom:14px"><tr>
      <td style="width:60%;background:#f8fafc;padding:10px 12px;border-radius:10px"><b>Cliente:</b> ${esc(c.cliente.nombre)}${c.cliente.doc ? ` · ${c.cliente.doc.length === 11 ? 'RUC' : 'DNI'} ${esc(c.cliente.doc)}` : ''}${c.cliente.direccion ? `<br>${esc(c.cliente.direccion)}` : ''}</td>
      <td style="background:#f8fafc;padding:10px 12px;border-radius:10px">Fecha: <b>${ddmmaaaa(c.fecha)}</b><br>Válida hasta: <b>${ddmmaaaa(venceEl(c.fecha, c.validezDias))}</b><br>Comprobante: <b>${COMPROBANTE_SOLICITADO[c.comprobante ?? (c.conIgv ? 'BOLETA' : 'NINGUNO')]}</b></td>
    </tr></table>
    <p class="formal">De nuestra consideración:<br>Por medio de la presente, ${esc(nombre)} tiene el agrado de alcanzarle la siguiente cotización de acuerdo a lo solicitado:</p>
    <table class="det"><thead><tr><th>N°</th><th>Concepto</th><th>Und.</th><th>Cant.</th><th>Precio unit.${c.conIgv ? '' : ' (sin IGV)'}</th>${c.conIgv ? '<th>Afectación</th><th>Valor venta</th><th>IGV (18%)</th>' : ''}<th>Total</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot class="tot"><tr><td colspan="${c.conIgv ? 6 : 5}" class="d" style="text-align:center">TOTALES</td>${c.conIgv ? `<td class="d">${dinero(calc.valor)}</td><td class="d">${dinero(calc.igv)}</td>` : ''}<td class="d">${dinero(calc.total)}</td></tr></tfoot></table>
    <div style="display:flex;justify-content:space-between;gap:24px;margin-top:18px;align-items:flex-start">
      <div style="flex:1"><div style="font-weight:800;font-size:14px;margin-bottom:6px">Condiciones:</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${c.condiciones.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${c.notas ? `<p style="margin-top:10px"><b>Observaciones:</b> ${esc(c.notas)}</p>` : ''}
        ${e.cuentaBcp ? `<p style="margin-top:10px"><b>Cuenta BCP:</b> ${esc(e.cuentaBcp)}</p>` : ''}</div>
      <table class="res" style="width:380px"><tbody>
        ${c.conIgv ? `<tr><td>Op. gravadas</td><td class="d">${dinero(calc.opGravadas)}</td></tr>
        ${calc.opExoneradas ? `<tr><td>Op. exoneradas${exon.length ? ` (${esc(exon.join(', '))})` : ''}</td><td class="d">${dinero(calc.opExoneradas)}</td></tr>` : ''}
        ${calc.opInafectas ? `<tr><td>Op. inafectas</td><td class="d">${dinero(calc.opInafectas)}</td></tr>` : ''}
        <tr><td>IGV (18%) sobre op. gravadas</td><td class="d">${dinero(calc.igv)}</td></tr>` : '<tr><td>Precios sin IGV</td><td class="d">Sin comprobante</td></tr>'}
        ${pag ? `<tr><td>Adelanto recibido</td><td class="d">− ${dinero(pag)}</td></tr>` : ''}
        <tr><td>${pag ? 'SALDO A PAGAR' : 'TOTAL A PAGAR'}</td><td class="d">${dinero(pag ? calc.total - pag : calc.total)}</td></tr>
      </tbody></table>
    </div>
    <p class="formal" style="margin-top:20px">Quedamos atentos a cualquier consulta adicional.<br>Atentamente,</p>
    ${c.comprobantes?.length ? `<p style="margin-top:14px"><b>Comprobantes emitidos:</b> ${c.comprobantes.map(x => `${NOMBRE_CPE[x.tipo]} ${esc(x.numero)}`).join(' · ')}</p>` : ''}
    <p style="margin-top:22px;text-align:center;color:#64748b;font-size:10px">Este documento no es un comprobante de pago · ${esc(nombre)}</p>
  </div>`;
}

// Íconos del plano básico de Unicode (☘ ✿ ❀ ⏳ ➡): se ven bien en WhatsApp de celular, web y escritorio.
// Los de 4 bytes (🌿 📄) a veces llegan como "�" cuando el mensaje entra por un enlace wa.me.
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const primerNombre = (n: string) => capital(n.trim().split(/\s+/)[0]?.toLowerCase() ?? '');
const MAX_ITEMS = 5;

/** Mensaje corto con el comprobante (enlace de Drive) para el cliente. */
export function mensajeComprobante(c: Precotizacion, cp: ComprobantePrecotizacion, empresa: string): string {
  const pag = pagado(c);
  return [
    `☘️ *${empresa}* · Tu ${NOMBRE_CPE[cp.tipo].toLowerCase()} *${cp.numero}*`,
    `Hola ${primerNombre(c.cliente.nombre)}, aquí está el comprobante de tu cotización N° ${c.numero}.`,
    `*Total: ${dinero(c.total)}*${pag ? ` · Pagado: ${dinero(pag)}` : ''}${saldo(c) > 0 ? ` · Saldo: ${dinero(saldo(c))}` : ''}`,
    `➡ Descárgala: ${cp.url}`,
    '¡Gracias por tu compra! ✿'
  ].join('\n');
}

/** Mensaje corto de WhatsApp para el cliente: lo principal y el enlace con el detalle completo. */
export function mensajePrecotizacion(c: Precotizacion, empresa: string, enlace: string): string {
  const calc = calcularPrecotizacion(c.lineas, c.conIgv);
  const comprobante = c.comprobante ?? (c.conIgv ? 'BOLETA' : 'NINGUNO');
  const nota = comprobante === 'NINGUNO' ? 'sin IGV' : `IGV incluido · ${COMPROBANTE_SOLICITADO[comprobante].toLowerCase()}`;
  return [
    `☘️ *${empresa}* · Cotización *N° ${c.numero}*`,
    `Hola ${primerNombre(c.cliente.nombre)}, gracias por escribirnos ✿`,
    ...calc.filas.slice(0, MAX_ITEMS).map(x => `❀ ${x.cantidad} ${x.unidad} ${capital(x.concepto)} — ${dinero(x.total)}`),
    ...(calc.filas.length > MAX_ITEMS ? [`❀ y ${calc.filas.length - MAX_ITEMS} ítem(s) más en el detalle`] : []),
    `*Total: ${dinero(calc.total)}* (${nota})`,
    `⏳ Válida hasta el ${ddmmaaaa(venceEl(c.fecha, c.validezDias))}`,
    `➡ Ver y descargar: ${enlace}`,
    '¿La aprobamos? Responde aquí y coordinamos el adelanto ☘️'
  ].join('\n');
}
