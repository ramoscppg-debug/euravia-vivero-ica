// ==========================================
// MODELOS PARA EMITIR FUERA DEL SISTEMA (portal SOL u otra plataforma)
// Mientras no se conecte la API de SUNAT o un proveedor OSE/PSE, el sistema registra la venta
// y entrega el modelo con los datos en el orden en que se piden al emitir. No es un comprobante.
// ==========================================
import type { ComprobanteSunat, EmpresaConfig, GuiaRemisionSunat } from '../domain/types';
import { esc, imprimirHtml } from './documentos';

export const TIPOS_CPE: Record<string, string> = { '01': 'FACTURA ELECTRÓNICA', '03': 'BOLETA DE VENTA ELECTRÓNICA', '07': 'NOTA DE CRÉDITO ELECTRÓNICA', NV: 'NOTA DE VENTA' };
const TIPO_DOC: Record<string, string> = { '6': 'RUC', '1': 'DNI', '0': 'Sin documento', '4': 'Carné de extranjería', '7': 'Pasaporte' };

const textoPago = (p: { medio: string; monto: number; operacion?: string }) => `${p.medio} ${p.monto.toFixed(2)}${p.operacion ? ` (op. ${p.operacion})` : ''}`;

/** Datos del comprobante en texto plano (para copiar y pegar al emitir). */
export function textoModelo(inv: ComprobanteSunat): string {
  const lineas = [
    `${TIPOS_CPE[inv.tipoComprobante] ?? inv.tipoComprobante} · N° sugerido ${inv.id}`,
    `Fecha de emisión: ${inv.fechaEmision} · Moneda: Soles · Forma de pago: Contado`,
    `Cliente: ${TIPO_DOC[inv.cliente.tipoDoc] ?? 'Doc.'} ${inv.cliente.numDoc || '—'} · ${inv.cliente.nombreRazonSocial}${inv.cliente.direccion ? ` · ${inv.cliente.direccion}` : ''}`,
    inv.referencia ? `Comprobante que modifica: ${inv.referencia} · Motivo: ${inv.motivo ?? ''}` : '',
    '',
    'Cant. | Unidad | Descripción | Valor unit. (sin IGV) | Precio unit. (con IGV) | Importe',
    ...inv.items.map(it => `${it.cantidad} | ${it.unidadMedida === 'NIU' ? 'Unidad (NIU)' : it.unidadMedida} | ${it.descripcion} | ${it.valorUnitario.toFixed(2)} | ${it.precioUnitario.toFixed(2)} | ${it.total.toFixed(2)}`),
    '',
    inv.descuentoTotal ? `Descuento (ya aplicado en los precios): ${inv.descuentoTotal.toFixed(2)}` : '',
    `Op. gravada: ${inv.opGravadas.toFixed(2)} · IGV 18%: ${inv.totalIgv.toFixed(2)} · Importe total: ${inv.montoTotal.toFixed(2)}`,
    inv.pagos?.length ? `Pagado con: ${inv.pagos.map(textoPago).join(' + ')}` : ''
  ];
  return lineas.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}

/** Hoja "modelo" para transcribir el comprobante. */
export function imprimirModeloComprobante(inv: ComprobanteSunat, empresa: EmpresaConfig) {
  const filas = inv.items.map(it => `<tr><td class="c">${it.cantidad}</td><td>${esc(it.unidadMedida)}</td><td>${esc(it.descripcion)}</td>
    <td class="d">${it.valorUnitario.toFixed(2)}</td><td class="d">${it.precioUnitario.toFixed(2)}</td><td class="d"><b>${it.total.toFixed(2)}</b></td></tr>`).join('');
  const fila = (t: string, v: string) => `<tr><td style="width:190px" class="suave">${t}</td><td>${v}</td></tr>`;
  imprimirHtml(`Modelo ${inv.id}`, `<div class="hoja">
    <div style="padding:10px 14px;border:2px dashed #b45309;border-radius:12px;color:#92400e;font-weight:700;margin-bottom:16px">
      MODELO PARA EMITIR EN SUNAT (portal SOL u otra plataforma) · NO ES UN COMPROBANTE DE PAGO</div>
    <header style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start">
      <div><h1 style="font-size:18px">${esc(empresa.razonSocial || empresa.nombreComercial)}</h1><div class="suave">RUC ${esc(empresa.ruc || 'por configurar')}${empresa.direccion ? ` · ${esc(empresa.direccion)}` : ''}</div></div>
      <div style="border:2px solid #15803d;border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-weight:800" class="verde">${TIPOS_CPE[inv.tipoComprobante] ?? inv.tipoComprobante}</div>
        <div style="font-size:18px;font-weight:800">${esc(inv.numeroSunat ?? inv.id)}</div>
        <div class="suave" style="font-size:10px">${inv.numeroSunat ? 'emitido en SUNAT' : 'número sugerido (siguiente de la serie)'}</div>
      </div>
    </header>
    <table style="margin-top:16px"><tbody>
      ${fila('Fecha de emisión', `<b>${esc(inv.fechaEmision)}</b>`)}
      ${fila('Tipo y N° de documento', `<b>${TIPO_DOC[inv.cliente.tipoDoc] ?? 'Doc.'} ${esc(inv.cliente.numDoc || '—')}</b>`)}
      ${fila('Cliente / Razón social', `<b>${esc(inv.cliente.nombreRazonSocial)}</b>`)}
      ${inv.cliente.direccion ? fila('Dirección', esc(inv.cliente.direccion)) : ''}
      ${fila('Moneda · Forma de pago', 'Soles (PEN) · Contado')}
      ${inv.referencia ? fila('Documento que modifica', `<b>${esc(inv.referencia)}</b> · ${esc(inv.motivo ?? '')}`) : ''}
    </tbody></table>
    <table style="margin-top:14px"><thead><tr><th class="c">Cant.</th><th>Unidad</th><th>Descripción</th><th class="d">V. unit. sin IGV</th><th class="d">P. unit. con IGV</th><th class="d">Importe</th></tr></thead><tbody>${filas}</tbody></table>
    <table style="width:280px;margin:14px 0 0 auto"><tbody>
      ${inv.descuentoTotal ? `<tr><td>Descuento aplicado</td><td class="d">${inv.descuentoTotal.toFixed(2)}</td></tr>` : ''}
      <tr><td>Op. gravada</td><td class="d">${inv.opGravadas.toFixed(2)}</td></tr><tr><td>IGV 18%</td><td class="d">${inv.totalIgv.toFixed(2)}</td></tr>
      <tr><td style="font-weight:800;background:#f0fdf4">IMPORTE TOTAL S/</td><td class="d verde" style="font-weight:800;background:#f0fdf4">${inv.montoTotal.toFixed(2)}</td></tr></tbody></table>
    ${inv.pagos?.length ? `<p style="margin-top:12px"><b>Pagado con:</b> ${esc(inv.pagos.map(textoPago).join(' + '))}</p>` : ''}
    <p class="suave" style="margin-top:18px;font-size:10px">Después de emitir, anota el número real en el sistema (Contabilidad → Comprobantes SUNAT) y envía el comprobante al cliente por WhatsApp.</p>
  </div>`);
}

export function imprimirModeloGuia(g: GuiaRemisionSunat, empresa: EmpresaConfig) {
  const filas = (g.items ?? []).map(it => `<tr><td class="c">${it.cantidad}</td><td>${esc(it.unidadMedida)}</td><td>${esc(it.descripcion)}</td></tr>`).join('');
  const fila = (t: string, v: string) => `<tr><td style="width:200px" class="suave">${t}</td><td>${v}</td></tr>`;
  const e = g.datosEnvio;
  imprimirHtml(`Modelo guía ${g.id}`, `<div class="hoja">
    <div style="padding:10px 14px;border:2px dashed #b45309;border-radius:12px;color:#92400e;font-weight:700;margin-bottom:16px">MODELO PARA EMITIR LA GUÍA DE REMISIÓN EN SUNAT · NO ES UNA GUÍA</div>
    <h1 style="font-size:18px">Guía de remisión remitente · ${esc(g.numeroSunat ?? g.id)}</h1>
    <table style="margin-top:12px"><tbody>
      ${fila('Remitente', `<b>${esc(empresa.razonSocial)}</b> · RUC ${esc(empresa.ruc || 'por configurar')}`)}
      ${fila('Fecha de emisión / traslado', `${esc(g.fechaEmision)} / ${esc(e?.fechaInicioTraslado ?? g.fechaEmision)}`)}
      ${fila('Motivo de traslado', `${esc(g.motivoTraslado)} · ${esc(g.descripcionMotivo ?? 'Venta')}`)}
      ${fila('Destinatario', `<b>${TIPO_DOC[g.destinatario.tipoDoc] ?? 'Doc.'} ${esc(g.destinatario.numDoc)}</b> · ${esc(g.destinatario.nombreRazonSocial ?? g.destinatario.nombre ?? '')}`)}
      ${fila('Punto de partida', `${esc(g.puntoPartida.direccion)} (ubigeo ${esc(g.puntoPartida.ubigeo || '—')})`)}
      ${fila('Punto de llegada', esc(g.puntoLlegada.direccion))}
      ${fila('Transporte', `${e?.modalidadTraslado === '01' ? 'Público' : 'Privado'} · placa ${esc(e?.placaVehiculo || '________')} · conductor ${esc(e?.conductorNombre || '________________')} · DNI ${esc(e?.conductorDni || '________')}`)}
      ${fila('Peso bruto aprox.', `${e?.pesoBrutoTotal ?? '—'} kg`)}
    </tbody></table>
    <table style="margin-top:14px"><thead><tr><th class="c">Cant.</th><th>Unidad</th><th>Descripción</th></tr></thead><tbody>${filas}</tbody></table>
  </div>`);
}
