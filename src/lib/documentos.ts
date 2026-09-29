// ==========================================
// DOCUMENTOS IMPRIMIBLES (cotización, proforma, nota de pedido, brochure, ticket y etiquetas QR)
// Cada documento se arma como una página propia y se imprime desde un marco oculto:
// así nunca sale en papel la pantalla del panel. "Guardar como PDF" del navegador da el archivo.
// Estructura inspirada en plantillas abiertas de facturas (p. ej. sparksuite/simple-html-invoice-template, MIT):
// lo impreso se ve igual que en pantalla. Todo texto del usuario se escapa.
// ==========================================
import qrcode from 'qrcode-generator';
import type { EmpresaConfig } from '../domain/types';
import { round2 } from './peru';

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const dinero = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** QR como SVG escalable (nítido en impresoras térmicas y láser). */
export function qrSvg(texto: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/** Imprime una página HTML completa en un marco oculto y lo retira al terminar. */
export function imprimirHtml(titulo: string, cuerpo: string, estilos = ''): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(marco);
  const doc = marco.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>${BASE}${estilos}</style></head><body>${cuerpo}</body></html>`);
  doc.close();
  const lanzar = async () => {
    const imgs = Array.from(doc.images).filter(i => !i.complete);
    await Promise.race([
      Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))),
      new Promise(r => setTimeout(r, 2500))
    ]);
    try { await doc.fonts?.ready; } catch { /* sin fuentes web: usa las del sistema */ }
    marco.contentWindow!.focus();
    marco.contentWindow!.print();
    setTimeout(() => marco.remove(), 60_000);
  };
  if (doc.readyState === 'complete') void lanzar();
  else marco.addEventListener('load', () => void lanzar(), { once: true });
}

const BASE = `
  *{box-sizing:border-box} body{margin:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hoja{max-width:800px;margin:0 auto;padding:36px}
  table{width:100%;border-collapse:collapse} th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#475569;text-align:left;padding:8px 10px;background:#f0fdf4;border-bottom:2px solid #15803d}
  td{padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top} .d{text-align:right;white-space:nowrap} .c{text-align:center}
  .verde{color:#15803d} .suave{color:#475569} h1,h2,h3{margin:0}
  @page{margin:12mm}
`;

// ---------------- Documentos comerciales ----------------
export type TipoDocumento = 'COTIZACIÓN' | 'PROFORMA' | 'NOTA DE PEDIDO';

export interface DocumentoComercial {
  tipo: TipoDocumento;
  numero: string;
  fecha: string;
  vence?: string;
  empresa: EmpresaConfig;
  contacto?: { telefono?: string; email?: string; whatsapp?: string };
  cliente: { nombre: string; doc?: string; telefono?: string; direccion?: string };
  comprobante?: 'BOLETA' | 'FACTURA' | 'RXH';
  lineas: { codigo?: string; descripcion: string; cantidad: number; precio: number; descuentoPct?: number }[];
  descuento?: number; // descuento global en soles
  delivery?: number;
  notas?: string;
  condiciones?: string[];
}

const CONDICIONES_BASE: Record<TipoDocumento, string[]> = {
  'COTIZACIÓN': ['Precios unitarios en soles con IGV: el valor de venta de nuestras plantas no incluye IGV y aquí ya se suma el 18%.', 'Disponibilidad sujeta a stock al momento de confirmar.', 'Pago y entrega se coordinan con su asesor de ventas.'],
  'PROFORMA': ['Documento previo a la emisión del comprobante electrónico.', 'Precios unitarios en soles con IGV: el valor de venta de nuestras plantas no incluye IGV y aquí ya se suma el 18%.', 'El comprobante se emite al confirmarse el pago.'],
  'NOTA DE PEDIDO': ['Documento interno de preparación y despacho.', 'El comprobante electrónico se entrega junto con el pedido.']
};

export function htmlDocumentoComercial(d: DocumentoComercial): string {
  const filas = d.lineas.map((l, i) => {
    const bruto = l.cantidad * l.precio;
    const neto = round2(bruto * (1 - (l.descuentoPct ?? 0) / 100));
    return `<tr><td class="c suave">${i + 1}</td><td>${l.codigo ? `<span class="suave">${esc(l.codigo)}</span> · ` : ''}${esc(l.descripcion)}</td>
      <td class="c">${l.cantidad}</td><td class="d">${dinero(l.precio)}</td><td class="d">${l.descuentoPct ? `${l.descuentoPct}%` : '—'}</td><td class="d"><b>${dinero(neto)}</b></td></tr>`;
  }).join('');
  const subtotal = round2(d.lineas.reduce((a, l) => a + l.cantidad * l.precio * (1 - (l.descuentoPct ?? 0) / 100), 0));
  const total = round2(subtotal - (d.descuento ?? 0) + (d.delivery ?? 0));
  const gravada = round2(total / 1.18);
  const igv = round2(total - gravada);
  const e = d.empresa;
  const nombreEmpresa = e.nombreComercial?.split(' - ')[0] || e.razonSocial || 'AUREVIA';
  const contacto = [d.contacto?.whatsapp && `WhatsApp ${d.contacto.whatsapp}`, d.contacto?.telefono || e.telefono, d.contacto?.email || e.email].filter(Boolean).map(esc).join(' · ');
  const condiciones = [...(d.condiciones ?? []), ...CONDICIONES_BASE[d.tipo]];

  return `<div class="hoja">
    <header style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid #e2e8f0">
      <div style="display:flex;gap:14px;align-items:center">
        <img src="${window.location.origin}/logo.jpg" alt="" style="width:58px;height:58px;border-radius:14px;object-fit:cover">
        <div><h1 style="font-size:20px;letter-spacing:.14em;font-weight:800" class="verde">${esc(nombreEmpresa.toUpperCase())}</h1>
          ${e.razonSocial ? `<div class="suave">${esc(e.razonSocial)}</div>` : ''}
          ${e.direccion ? `<div class="suave">${esc(e.direccion)}</div>` : ''}
          ${contacto ? `<div class="suave">${contacto}</div>` : ''}</div>
      </div>
      <div style="border:2px solid #15803d;border-radius:14px;padding:12px 18px;text-align:center;min-width:200px">
        ${e.ruc ? `<div style="font-weight:700">RUC ${esc(e.ruc)}</div>` : '<div class="suave">RUC por configurar</div>'}
        <div style="font-size:15px;font-weight:800;margin:4px 0" class="verde">${d.tipo}</div>
        <div style="font-weight:700">N° ${esc(d.numero)}</div>
      </div>
    </header>
    <section style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0">
      <div style="background:#f8fafc;border-radius:12px;padding:12px 14px"><div class="suave" style="font-size:10px;text-transform:uppercase;font-weight:700">Cliente</div>
        <div style="font-weight:700;font-size:13px">${esc(d.cliente.nombre)}</div>
        ${d.cliente.doc ? `<div>${d.cliente.doc.length === 11 ? 'RUC' : 'DNI'} ${esc(d.cliente.doc)}</div>` : ''}
        ${d.cliente.telefono ? `<div>${esc(d.cliente.telefono)}</div>` : ''}${d.cliente.direccion ? `<div>${esc(d.cliente.direccion)}</div>` : ''}</div>
      <div style="background:#f8fafc;border-radius:12px;padding:12px 14px"><div class="suave" style="font-size:10px;text-transform:uppercase;font-weight:700">Datos del documento</div>
        <div>Fecha de emisión: <b>${esc(d.fecha)}</b></div>${d.vence ? `<div>Válido hasta: <b>${esc(d.vence)}</b></div>` : ''}
        ${d.comprobante ? `<div>Comprobante solicitado: <b>${d.comprobante === 'FACTURA' ? 'Factura' : d.comprobante === 'RXH' ? 'Recibo por honorarios' : 'Boleta'}</b></div>` : ''}<div>Moneda: Soles (PEN)</div></div>
    </section>
    <table><thead><tr><th class="c" style="width:32px">#</th><th>Descripción</th><th class="c">Cant.</th><th class="d">P. unit.</th><th class="d">Dscto.</th><th class="d">Importe</th></tr></thead><tbody>${filas}</tbody></table>
    <section style="display:flex;justify-content:space-between;gap:24px;margin-top:18px;align-items:flex-start">
      <div style="flex:1">${d.notas ? `<div style="margin-bottom:10px"><b>Observaciones:</b> ${esc(d.notas)}</div>` : ''}
        <div style="font-weight:700;margin-bottom:4px">Condiciones</div><ul style="margin:0;padding-left:16px" class="suave">${condiciones.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        ${e.cuentaBcpSoles || e.cuentaBbvaSoles ? `<div style="margin-top:10px"><b>Cuentas:</b> ${[e.cuentaBcpSoles && `BCP ${esc(e.cuentaBcpSoles)}`, e.cuentaBbvaSoles && `BBVA ${esc(e.cuentaBbvaSoles)}`].filter(Boolean).join(' · ')}</div>` : ''}</div>
      <table style="width:260px"><tbody>
        <tr><td>Op. gravada</td><td class="d">${dinero(gravada)}</td></tr><tr><td>IGV (18%)</td><td class="d">${dinero(igv)}</td></tr>
        ${d.descuento ? `<tr><td>Descuento</td><td class="d">− ${dinero(d.descuento)}</td></tr>` : ''}${d.delivery ? `<tr><td>Delivery</td><td class="d">${dinero(d.delivery)}</td></tr>` : ''}
        <tr><td style="font-size:14px;font-weight:800;background:#f0fdf4">TOTAL</td><td class="d verde" style="font-size:15px;font-weight:800;background:#f0fdf4">${dinero(total)}</td></tr></tbody></table>
    </section>
    <footer class="suave" style="margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px">
      ${d.tipo === 'NOTA DE PEDIDO' ? 'Documento interno · no es comprobante de pago' : 'Este documento no es un comprobante de pago'} · Generado por ${esc(nombreEmpresa)}
    </footer></div>`;
}

export function imprimirDocumento(d: DocumentoComercial) {
  imprimirHtml(`${d.tipo} ${d.numero}`, htmlDocumentoComercial(d));
}

// ---------------- Brochure ----------------
export interface DatosBrochure {
  empresa: EmpresaConfig;
  contacto: { whatsapp?: string; email?: string; direccion?: string; horario?: string };
  lema?: string;
  presentacion?: string;
  productos: { nombre: string; categoria: string; precio: number; imagen?: string; descripcion?: string }[];
  servicios: { nombre: string; resumen: string; imagen?: string }[];
  mostrarPrecios: boolean;
  urlTienda: string;
}

export function imprimirBrochure(b: DatosBrochure) {
  const nombre = b.empresa.nombreComercial?.split(' - ')[0] || b.empresa.razonSocial || 'AUREVIA';
  const tarjetas = b.productos.map(p => `<div class="prod">${p.imagen ? `<img src="${esc(p.imagen)}" alt="">` : '<div class="sinfoto">🌿</div>'}
    <div class="cat">${esc(p.categoria)}</div><div class="nom">${esc(p.nombre)}</div>${b.mostrarPrecios ? `<div class="pre">${dinero(p.precio)} <small>+ IGV</small></div>` : ''}</div>`).join('');
  const servicios = b.servicios.map(s => `<div class="serv"><div class="nom">${esc(s.nombre)}</div><div class="suave">${esc(s.resumen)}</div></div>`).join('');
  const contacto = [b.contacto.whatsapp && `WhatsApp ${esc(b.contacto.whatsapp)}`, b.contacto.email && esc(b.contacto.email), b.contacto.direccion && esc(b.contacto.direccion), b.contacto.horario && esc(b.contacto.horario)].filter(Boolean);
  imprimirHtml(`Brochure ${nombre}`, `
    <section class="portada">
      <img src="${window.location.origin}/logo.jpg" alt="" class="logo">
      <h1>${esc(nombre.toUpperCase())}</h1>
      <p class="lema">${esc(b.lema || 'Plantas, insumos y jardinería')}</p>
      ${b.presentacion ? `<p class="pres">${esc(b.presentacion)}</p>` : ''}
      <div class="qr">${qrSvg(b.urlTienda)}<span>Escanea y cotiza en línea<br><b>${esc(b.urlTienda.replace(/^https?:\/\//, ''))}</b></span></div>
    </section>
    ${b.productos.length ? `<section class="pagina"><h2>Nuestro catálogo</h2><div class="grid">${tarjetas}</div></section>` : ''}
    ${b.servicios.length ? `<section class="pagina"><h2>Servicios de jardinería</h2><div class="servs">${servicios}</div></section>` : ''}
    <section class="cierre"><h2>Contáctanos</h2>${contacto.map(c => `<p>${c}</p>`).join('')}
      <p class="suave">Cotiza en ${esc(b.urlTienda.replace(/^https?:\/\//, ''))} y envía tu pedido por WhatsApp.</p>
      ${b.empresa.ruc ? `<p class="suave">${esc(b.empresa.razonSocial)} · RUC ${esc(b.empresa.ruc)}</p>` : ''}</section>`,
  `@page{size:A4;margin:0} body{font-size:13px}
   section{padding:48px 52px} .portada{min-height:297mm;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(160deg,#f0fdf4 0%,#fff 60%);page-break-after:always}
   .logo{width:96px;height:96px;border-radius:24px;object-fit:cover} .portada h1{font-size:54px;letter-spacing:.16em;font-weight:800;color:#14532d;margin-top:28px}
   .lema{font-size:22px;color:#15803d;font-weight:700;margin:6px 0 0} .pres{font-size:15px;color:#334155;max-width:520px;line-height:1.6;margin-top:24px}
   .qr{display:flex;gap:18px;align-items:center;margin-top:48px} .qr svg{width:120px;height:120px} .qr span{color:#334155}
   .pagina{page-break-after:always} h2{font-size:28px;color:#14532d;font-weight:800;margin-bottom:22px}
   .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px} .prod{border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;padding-bottom:12px;break-inside:avoid}
   .prod img,.sinfoto{width:100%;aspect-ratio:1;object-fit:cover;display:flex;align-items:center;justify-content:center;background:#f0fdf4;font-size:40px}
   .cat{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#15803d;font-weight:700;padding:10px 12px 0} .nom{font-weight:800;font-size:14px;padding:2px 12px 0} .pre{font-weight:800;color:#15803d;padding:4px 12px 0}
   .servs{display:grid;grid-template-columns:1fr 1fr;gap:16px} .serv{border-left:4px solid #15803d;background:#f8fafc;border-radius:12px;padding:16px} .serv .nom{padding:0 0 6px}
   .cierre{text-align:center;padding-top:80px} .cierre p{font-size:15px;margin:6px 0}`);
}

// ---------------- Ticket (80 mm) ----------------
export function imprimirTicket(html: string, titulo: string) {
  imprimirHtml(titulo, `<div class="ticket">${html}</div>`,
    '@page{size:80mm auto;margin:3mm} body{font-size:11px} .ticket{width:72mm;margin:0 auto}');
}

// ---------------- Etiquetas QR ----------------
export type FormatoEtiqueta = '50x30' | '70x40' | 'A4';

export interface EtiquetaProducto {
  sku: string;
  nombre: string;
  cientifico?: string;
  precio: number;
  enlace: string; // lo que abre el celular al escanear (ficha pública con precio)
  copias: number;
}

/**
 * Imprime N etiquetas por producto. El QR lleva el enlace a la ficha pública del producto:
 * el celular muestra el precio y el lector de la caja reconoce el SKU dentro del enlace.
 */
export function imprimirEtiquetas(items: EtiquetaProducto[], formato: FormatoEtiqueta, empresa: string) {
  const etiquetas = items.flatMap(it => Array.from({ length: Math.max(0, Math.min(500, it.copias)) }, () => it));
  if (!etiquetas.length) return;
  const cache = new Map<string, string>();
  const qr = (t: string) => cache.get(t) ?? (cache.set(t, qrSvg(t)), cache.get(t)!);
  const html = etiquetas.map(e => `<div class="et"><div class="q">${qr(e.enlace)}</div><div class="t">
    <div class="m">${esc(empresa)}</div><div class="n">${esc(e.nombre)}</div>${e.cientifico && formato !== '50x30' ? `<div class="s">${esc(e.cientifico)}</div>` : ''}
    <div class="p">${dinero(e.precio)} <small>+IGV</small></div><div class="k">${esc(e.sku)}</div></div></div>`).join('');
  const tam = formato === '50x30' ? { w: 50, h: 30, q: 24 } : formato === '70x40' ? { w: 70, h: 40, q: 32 } : { w: 63.5, h: 38.1, q: 30 };
  const pagina = formato === 'A4'
    ? '@page{size:A4;margin:12mm 8mm} .hoja{display:grid;grid-template-columns:repeat(3,63.5mm);gap:0 2.5mm;justify-content:center}'
    : `@page{size:${tam.w}mm ${tam.h}mm;margin:0} .et{page-break-after:always}`;
  imprimirHtml(`Etiquetas QR (${etiquetas.length})`, `<div class="hoja">${html}</div>`, `${pagina}
    .et{width:${tam.w}mm;height:${tam.h}mm;padding:2mm;display:flex;gap:2mm;align-items:center;overflow:hidden;${formato === 'A4' ? 'border:1px dashed #cbd5e1;' : ''}}
    .q{width:${tam.q}mm;height:${tam.q}mm;flex-shrink:0} .q svg{width:100%;height:100%}
    .t{min-width:0;line-height:1.15} .m{font-size:6pt;letter-spacing:.12em;font-weight:800;color:#15803d;text-transform:uppercase}
    .n{font-size:${formato === '50x30' ? 7.5 : 9}pt;font-weight:800;max-height:2.4em;overflow:hidden} .s{font-size:6.5pt;font-style:italic;color:#475569}
    .p{font-size:${formato === '50x30' ? 10 : 12}pt;font-weight:800;margin-top:1mm} .k{font-size:6pt;font-family:monospace;color:#475569}`);
}

/** Extrae el SKU de lo que leyó un escáner: un SKU directo o el enlace de la etiqueta QR (…/tienda/producto/SKU). */
export function skuDeLectura(lectura: string): string {
  const t = lectura.trim();
  const m = t.match(/\/producto\/([^/?#\s]+)/i);
  return (m ? decodeURIComponent(m[1]) : t).toUpperCase();
}
