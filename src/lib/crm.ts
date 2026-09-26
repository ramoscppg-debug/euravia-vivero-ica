// ==========================================
// CRM (funciones puras): historial unificado, segmentos, cuidados de plantas y CSV
// ==========================================
import type { CatalogProduct, ComprobanteSunat, CrmClient, GardeningProject, NotaCliente, Pedido } from '../domain/types';
import { round2 } from './peru';
import { hoyLocal } from './fechas';

const DIA = 86_400_000;
const hoyISO = () => hoyLocal();
const dias = (desde: string, hasta = hoyISO()) => Math.floor((Date.parse(hasta) - Date.parse(desde.slice(0, 10))) / DIA);

const norm = (s = '') => s.trim().toLowerCase();

/** ¿El documento o registro pertenece a este cliente? Primero por DNI/RUC, si no por nombre. */
export function esDelCliente(c: CrmClient, nombre: string, doc?: string, telefono?: string): boolean {
  if (c.doc && doc) return c.doc === doc;
  if (c.phone && telefono && c.phone.replace(/\D/g, '').slice(-9) === telefono.replace(/\D/g, '').slice(-9)) return true;
  return norm(c.name) === norm(nombre);
}

export interface EventoCliente {
  fecha: string;
  tipo: 'compra' | 'devolucion' | 'pedido' | 'servicio' | 'nota';
  titulo: string;
  detalle: string;
  monto?: number;
}

export interface FuentesCrm {
  invoices: ComprobanteSunat[];
  pedidos: Pedido[];
  projects: GardeningProject[];
  notas: NotaCliente[];
  products: CatalogProduct[];
}

export function comprasDe(c: CrmClient, invoices: ComprobanteSunat[]) {
  return invoices.filter(i => ['01', '03', '07'].includes(i.tipoComprobante) && esDelCliente(c, i.cliente.nombreRazonSocial, i.cliente.numDoc));
}

export function historialCliente(c: CrmClient, f: FuentesCrm): EventoCliente[] {
  const eventos: EventoCliente[] = [
    ...comprasDe(c, f.invoices).map(i => ({
      fecha: `${i.fechaEmision}T${i.horaEmision || '00:00:00'}`,
      tipo: (i.tipoComprobante === '07' ? 'devolucion' : 'compra') as EventoCliente['tipo'],
      titulo: i.tipoComprobante === '07' ? `Devolución ${i.id}` : `Compra ${i.id}`,
      detalle: i.items.map(it => `${it.cantidad}× ${it.descripcion}`).join(', '),
      monto: (i.tipoComprobante === '07' ? -1 : 1) * i.montoTotal
    })),
    ...f.pedidos.filter(p => esDelCliente(c, p.cliente.nombre, p.cliente.doc, p.cliente.telefono)).map(p => ({
      fecha: p.createdAt,
      tipo: 'pedido' as const,
      titulo: `Pedido ${p.id} · ${p.estado}`,
      detalle: `${p.canal} · entrega ${p.fechaEntrega} · ${p.items.map(it => `${it.qty}× ${it.name}`).join(', ')}`,
      monto: p.total
    })),
    ...f.projects.filter(p => esDelCliente(c, p.client, p.doc, p.phone)).map(p => ({
      fecha: p.date,
      tipo: 'servicio' as const,
      titulo: `${p.type} · ${p.id}`,
      detalle: `${p.status}${p.invoiceId ? ` · facturado ${p.invoiceId}` : ''}`,
      monto: p.total
    })),
    ...f.notas.filter(n => n.clienteId === c.id).map(n => ({
      fecha: n.fecha,
      tipo: 'nota' as const,
      titulo: `Nota de ${n.autor}`,
      detalle: n.texto
    }))
  ];
  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type Segmento = 'VIP' | 'Frecuente' | 'Nuevo' | 'Activo' | 'Inactivo' | 'Sin compras';

export interface MetricasCliente {
  total: number;
  compras: number;
  ticketPromedio: number;
  ultimaCompra?: string;
  diasSinComprar?: number;
  segmento: Segmento;
}

export function metricasCliente(c: CrmClient, invoices: ComprobanteSunat[]): MetricasCliente {
  const docs = comprasDe(c, invoices);
  const ventas = docs.filter(i => i.tipoComprobante !== '07');
  const total = round2(docs.reduce((a, i) => a + (i.tipoComprobante === '07' ? -1 : 1) * i.montoTotal, 0));
  const ultimaCompra = ventas.map(i => i.fechaEmision).sort().pop();
  const diasSinComprar = ultimaCompra ? dias(ultimaCompra) : undefined;
  let segmento: Segmento = 'Sin compras';
  if (ventas.length) {
    if (total >= 1000) segmento = 'VIP';
    else if (diasSinComprar! > 90) segmento = 'Inactivo';
    else if (ventas.length >= 3) segmento = 'Frecuente';
    else if (ventas.length === 1 && diasSinComprar! <= 30) segmento = 'Nuevo';
    else segmento = 'Activo';
  }
  return { total, compras: ventas.length, ticketPromedio: ventas.length ? round2(total / ventas.length) : 0, ultimaCompra, diasSinComprar, segmento };
}

export interface PlantaCliente {
  sku: string;
  nombre: string;
  compradaEl: string;
  riego?: string;
  luz?: string;
  proximoCuidado: string; // cada 30 días desde la compra
  toca: boolean; // el próximo cuidado ya llegó (o llega en ≤ 3 días)
}

/** Plantas vivas que el cliente compró, con su siguiente cuidado recomendado (cada 30 días). */
export function plantasDelCliente(c: CrmClient, invoices: ComprobanteSunat[], products: CatalogProduct[]): PlantaCliente[] {
  const ultima = new Map<string, string>();
  comprasDe(c, invoices)
    .filter(i => i.tipoComprobante !== '07')
    .forEach(i => i.items.forEach(it => {
      if (!ultima.has(it.sku) || ultima.get(it.sku)! < i.fechaEmision) ultima.set(it.sku, i.fechaEmision);
    }));
  const hoy = hoyISO();
  return [...ultima]
    .map(([sku, fecha]) => ({ sku, fecha, prod: products.find(p => p.sku === sku) }))
    .filter(x => x.prod?.isLivePlant)
    .map(({ sku, fecha, prod }) => {
      const transcurridos = Math.max(0, dias(fecha, hoy));
      const ciclos = Math.max(1, Math.ceil((transcurridos - 3) / 30)); // tolerancia de 3 días
      const proximo = new Date(Date.parse(fecha) + ciclos * 30 * DIA).toISOString().slice(0, 10);
      return {
        sku,
        nombre: prod!.name,
        compradaEl: fecha,
        riego: prod!.careWater,
        luz: prod!.careLight,
        proximoCuidado: proximo,
        toca: dias(hoy, proximo) <= 3
      };
    });
}

/** Mensaje de WhatsApp con los cuidados de las plantas que compró. */
export function mensajeCuidados(c: CrmClient, plantas: PlantaCliente[]): string {
  const nombre = c.name.split(' ')[0];
  if (!plantas.length) return `Hola ${nombre}, te saludamos de AUREVIA Botanical 🌿. ${c.seasonalAlert}`;
  const tips = plantas.map(p => `• ${p.nombre}: ${[p.riego, p.luz].filter(Boolean).join(' · ')}`).join('\n');
  return `Hola ${nombre}, te saludamos de AUREVIA Botanical 🌿. Recordatorio de cuidados para tus plantas:\n${tips}\n¿Te ayudamos con fertilizante o una visita de mantenimiento?`;
}

// ---------------- CSV ----------------

const CAMPOS_CSV = ['nombre', 'documento', 'telefono', 'email', 'direccion', 'distrito', 'canal', 'urgencia', 'plantas'] as const;

const celda = (v: unknown) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function clientesACsv(clientes: CrmClient[]): string {
  const filas = clientes.map(c => [c.name, c.doc, c.phone, c.email, c.address, c.district, c.canal, c.urgency, c.plantsOwned.join(' | ')].map(celda).join(','));
  return [CAMPOS_CSV.join(','), ...filas].join('\n');
}

/** Lee un CSV (coma o punto y coma) con encabezados; acepta los nombres de columna en español. */
export function csvAClientes(texto: string): { nombre: string; doc?: string; telefono?: string; email?: string; direccion?: string; distrito?: string; canal?: string }[] {
  const lineas = texto.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lineas.length < 2) return [];
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (l: string) => {
    const out: string[] = [];
    let cur = '';
    let comillas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') comillas = !comillas;
      else if (ch === sep && !comillas) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(x => x.trim());
  };
  const cab = partir(lineas[0]).map(h => norm(h).normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...nombres: string[]) => cab.findIndex(h => nombres.includes(h));
  const idx = {
    nombre: col('nombre', 'cliente', 'razon social', 'name'),
    doc: col('documento', 'dni', 'ruc', 'doc'),
    telefono: col('telefono', 'celular', 'whatsapp', 'phone'),
    email: col('email', 'correo'),
    direccion: col('direccion', 'address'),
    distrito: col('distrito'),
    canal: col('canal', 'origen')
  };
  if (idx.nombre < 0) return [];
  return lineas.slice(1).map(l => {
    const v = partir(l);
    const get = (i: number) => (i >= 0 ? v[i] || undefined : undefined);
    return { nombre: get(idx.nombre) ?? '', doc: get(idx.doc), telefono: get(idx.telefono), email: get(idx.email), direccion: get(idx.direccion), distrito: get(idx.distrito), canal: get(idx.canal) };
  }).filter(r => r.nombre);
}
