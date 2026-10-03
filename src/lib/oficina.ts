// ==========================================
// OFICINA VIRTUAL (puro)
// Ventas del día y del mes, avance de la meta y lo pendiente para el tablero y el resumen por WhatsApp.
// El resumen que sale cada mañana lo arma la base (resumen_diario_texto) con las mismas reglas.
// ==========================================
import type { ErpState } from '../store/ErpStore';
import type { ComprobanteSunat } from '../types/sunat';
import type { TabId } from '../layout/navigation';

const r2 = (n: number) => Math.round(n * 100) / 100;
const esVenta = (i: ComprobanteSunat) => i.tipoComprobante === '01' || i.tipoComprobante === '03' || i.tipoComprobante === '07';
const importe = (i: ComprobanteSunat) => (i.tipoComprobante === '07' ? -i.montoTotal : i.montoTotal);

/** Ventas entre dos fechas (inclusive); las notas de crédito restan. */
export function ventasEntre(invoices: ComprobanteSunat[], desde: string, hasta: string) {
  const lista = invoices.filter(i => esVenta(i) && i.fechaEmision >= desde && i.fechaEmision <= hasta);
  return { total: r2(lista.reduce((a, i) => a + importe(i), 0)), comprobantes: lista.filter(i => i.tipoComprobante !== '07').length, lista };
}

const finDeMes = (periodo: string) => { const [y, m] = periodo.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const restarMes = (periodo: string) => { const [y, m] = periodo.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

/** Avance de la meta del mes: ritmo diario necesario y proyección al cierre. */
export function avanceMeta(invoices: ComprobanteSunat[], meta: number | undefined, hoy: string) {
  const periodo = hoy.slice(0, 7);
  const dia = Number(hoy.slice(8, 10));
  const diasMes = Number(finDeMes(periodo).slice(8, 10));
  const vendido = ventasEntre(invoices, `${periodo}-01`, hoy).total;
  const diasRestantes = diasMes - dia; // sin contar hoy
  const proyeccion = r2((vendido / dia) * diasMes);
  // Mismo corte del mes anterior, para comparar
  const anterior = restarMes(periodo);
  const corteAnterior = `${anterior}-${String(Math.min(dia, Number(finDeMes(anterior).slice(8, 10)))).padStart(2, '0')}`;
  const mesAnterior = ventasEntre(invoices, `${anterior}-01`, corteAnterior).total;
  return {
    periodo, vendido, meta, proyeccion, diasRestantes, mesAnterior,
    pct: meta ? Math.round((vendido / meta) * 100) : undefined,
    falta: meta ? r2(Math.max(0, meta - vendido)) : undefined,
    ritmoNecesario: meta ? r2(Math.max(0, meta - vendido) / Math.max(1, diasRestantes + 1)) : undefined
  };
}

export interface Pendiente {
  clave: string;
  icono: string;
  texto: string;
  tab: TabId;
  urgente?: boolean;
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Lo que hay que atender hoy, en orden de urgencia. */
export function pendientesDelDia(s: ErpState, hoy: string, dias = 3): Pendiente[] {
  const p: Pendiente[] = [];
  for (const v of [...s.vencimientos].filter(v => !v.hecho && v.fecha <= sumar(hoy, dias)).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const d = diasEntre(hoy, v.fecha);
    p.push({ clave: `VEN:${v.id}`, icono: '📅', texto: `${d < 0 ? 'VENCIDO ' : d === 0 ? 'HOY ' : ''}${ddmm(v.fecha)} ${v.descripcion}`, tab: 'agenda', urgente: d <= 0 });
  }
  for (const d of s.detracciones.filter(x => x.estado === 'PENDIENTE' && x.fechaVencimientoBn <= sumar(hoy, dias))) {
    p.push({ clave: `DET:${d.id}`, icono: '🏦', texto: `Detracción ${d.facturaId}: ${soles(d.montoDetraccion)} vence ${ddmm(d.fechaVencimientoBn)}`, tab: 'detracciones', urgente: d.fechaVencimientoBn <= hoy });
  }
  const porEmitir = s.invoices.filter(i => !i.numeroSunat && i.estadoSunat === 'PENDIENTE').length;
  if (porEmitir) p.push({ clave: 'EMITIR', icono: '🧾', texto: `${porEmitir} comprobante(s) por emitir en SUNAT`, tab: 'finanzas', urgente: true });
  const entregar = s.pedidos.filter(x => x.fechaEntrega === hoy && x.estado !== 'entregado' && x.estado !== 'cancelado').length;
  if (entregar) p.push({ clave: 'ENTREGAS', icono: '🚚', texto: `${entregar} pedido(s) para entregar hoy`, tab: 'pedidos' });
  const web = s.solicitudes.filter(x => x.estado === 'NUEVA').length;
  if (web) p.push({ clave: 'WEB', icono: '🛒', texto: `${web} pedido(s) web sin atender`, tab: 'solicitudes', urgente: true });
  const cot = s.cotizaciones.filter(c => c.estado === 'ENVIADA').length;
  if (cot) p.push({ clave: 'COT', icono: '📝', texto: `${cot} cotización(es) esperando respuesta`, tab: 'cotizaciones' });
  const porPagar = s.gastos.filter(g => !g.medioPago);
  if (porPagar.length) p.push({ clave: 'CXP', icono: '💳', texto: `${porPagar.length} cuenta(s) por pagar: ${soles(porPagar.reduce((a, g) => a + g.total - (g.retencion ?? 0), 0))}`, tab: 'finanzas' });
  const stock = s.products.filter(x => x.stock <= x.minStock).length;
  if (stock) p.push({ clave: 'STOCK', icono: '🌱', texto: `${stock} producto(s) con stock bajo`, tab: 'kardex' });
  return p.sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente));
}

function sumar(fecha: string, dias: number) {
  return new Date(Date.parse(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** El mismo resumen que llega por WhatsApp (para verlo en el modo demo). */
export function resumenTexto(s: ErpState, hoy: string, dias = 3): string {
  const ayer = sumar(hoy, -1);
  const v = ventasEntre(s.invoices, ayer, ayer);
  const meta = s.metasVenta[hoy.slice(0, 7)];
  const mes = ventasEntre(s.invoices, `${hoy.slice(0, 7)}-01`, ayer).total;
  const pend = pendientesDelDia(s, hoy, dias);
  return [
    `📋 AUREVIA · ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}/${hoy.slice(0, 4)}`,
    `💰 Ventas de ayer: ${soles(v.total)} (${v.comprobantes} comprobante(s))`,
    ...(meta ? [`🎯 Meta del mes: ${soles(mes)} de ${soles(meta)} (${Math.round((mes * 100) / meta)}%)`] : []),
    '',
    ...(pend.length ? pend.map(x => `${x.icono} ${x.texto}`) : ['✅ Nada pendiente para hoy'])
  ].join('\n');
}
