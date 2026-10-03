import { useState } from 'react';
import { BookOpen, Download, PackagePlus, Printer, QrCode, Scissors } from 'lucide-react';
import { Boton } from '../../components/ui';
import type { KardexMovement } from '../../domain/types';
import { csv } from '../../lib/analitica';
import { esc, imprimirHtml } from '../../lib/documentos';
import { descargarTxt } from '../../lib/exports';
import { hoyLocal } from '../../lib/fechas';
import { libro131, saldoDe, TABLA_10, TABLA_12, TABLA_5, TABLA_6, type Libro131 } from '../../lib/kardexValorado';
import { useErp } from '../../store/ErpStore';
import { descargar, generarPle131, nombrePle } from '../../lib/librosSunat';
import { useUi } from '../../store/UiStore';

const n2 = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nq = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, ''));

export default function Kardex() {
  const { state } = useErp();
  const { open } = useUi();
  const { products, kardex } = state;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-tinta">Kardex valorizado (costo promedio ponderado)</h3>
          <p className="text-xs text-tinta-suave">Entradas por compras, producción propia y devoluciones; salidas por ventas, insumos a producción y mermas. Cada movimiento lleva su documento (Tabla 10), operación (Tabla 12) y saldo valorizado.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => open({ type: 'baja' })} className="px-4 py-2.5 rounded-2xl bg-error-fondo text-error font-bold text-xs flex items-center gap-1.5 shadow-sm">
            <Scissors className="w-4 h-4" /> Registrar Merma / Baja (-)
          </button>
          <button onClick={() => open({ type: 'compra' })} className="px-4 py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold text-xs flex items-center gap-1.5 shadow-md">
            <PackagePlus className="w-4 h-4" /> Ingreso de Compra (+)
          </button>
        </div>
      </div>

      {/* Inventario valorizado */}
      <div className="bg-white rounded-3xl border border-crema-300 shadow-sm overflow-hidden p-6 space-y-4">
        <h4 className="font-serif font-bold text-base text-tinta">Inventario valorizado al costo promedio</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-crema text-tinta-suave font-bold border-b border-crema-300">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Especie / Artículo</th>
                <th className="p-3">Ubicación Almacén</th>
                <th className="p-3 text-right">Costo promedio</th>
                <th className="p-3 text-right">Precio Venta</th>
                <th className="p-3 text-center">Stock Actual</th>
                <th className="p-3 text-center">Mínimo</th>
                <th className="p-3 text-right">Valor del saldo</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Etiqueta QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100">
              {products.map(p => {
                const isLow = p.stock <= p.minStock;
                const saldo = saldoDe(p);
                return (
                  <tr key={p.sku} className="hover:bg-crema">
                    <td className="p-3 font-mono font-bold text-tinta">{p.sku}</td>
                    <td className="p-3">
                      <p className="font-serif font-bold text-tinta">{p.name}</p>
                      <p className="text-[10px] text-tinta-suave italic">{p.scientificName}</p>
                    </td>
                    <td className="p-3 text-tinta-suave">{p.location}</td>
                    <td className="p-3 text-right text-tinta-suave">S/ {saldo.costoUnitario.toFixed(4)}</td>
                    <td className="p-3 text-right font-bold text-tinta">S/ {p.price.toFixed(2)}</td>
                    <td className="p-3 text-center font-bold text-base text-tinta">{nq(p.stock)}</td>
                    <td className="p-3 text-center text-tinta-suave">{p.minStock}</td>
                    <td className="p-3 text-right font-serif font-bold text-bosque-700">S/ {n2(saldo.costoTotal)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isLow ? 'bg-error-fondo text-error' : 'bg-exito-fondo text-bosque-700'}`}>{isLow ? '⚠️ Reponer' : '✅ Óptimo'}</span>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => open({ type: 'qr', sku: p.sku })} className="px-2.5 py-1 rounded-xl bg-bosque-950 hover:bg-bosque-800 text-oro font-bold text-[10px] flex items-center gap-1 mx-auto transition shadow-sm">
                        <QrCode className="w-3 h-3" /> Imprimir QR
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="bg-white rounded-3xl border border-crema-300 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-serif font-bold text-base text-tinta">Movimientos de Kardex</h4>
          <span className="text-[10px] text-tinta-suave">Las salidas se valorizan al costo promedio vigente</span>
        </div>
        <div className="overflow-x-auto max-h-96 custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[980px]">
            <thead className="bg-crema text-tinta-suave font-bold border-b border-crema-300 sticky top-0">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Movimiento</th>
                <th className="p-3">Documento</th>
                <th className="p-3 text-center" title="SUNAT Tabla 10 · Tabla 12">T10 · T12</th>
                <th className="p-3 text-center">Entrada</th>
                <th className="p-3 text-center">Salida</th>
                <th className="p-3 text-right">Costo unit.</th>
                <th className="p-3 text-right">Costo total</th>
                <th className="p-3 text-center">Saldo</th>
                <th className="p-3 text-right">Saldo S/</th>
                <th className="p-3">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100">
              {kardex.map((m: KardexMovement) => (
                <tr key={m.id} className="hover:bg-crema">
                  <td className="p-3 font-mono text-tinta-suave">{m.fechaEmision ?? m.date}</td>
                  <td className="p-3 font-mono font-bold text-tinta">{m.productSku}</td>
                  <td className="p-3 text-tinta">{m.movementType}</td>
                  <td className="p-3 font-mono text-tinta-suave">{m.referenceDoc}</td>
                  <td className="p-3 text-center font-mono text-tinta-suave" title={m.tipoOperacion ? `${TABLA_10[m.tipoComprobante ?? ''] ?? ''} · ${TABLA_12[m.tipoOperacion] ?? ''}` : undefined}>{m.tipoComprobante ?? '—'} · {m.tipoOperacion ?? '—'}</td>
                  <td className="p-3 text-center font-bold text-bosque-700">{m.quantityIn ? nq(m.quantityIn) : ''}</td>
                  <td className="p-3 text-center font-bold text-[#e05780]">{m.quantityOut ? nq(m.quantityOut) : ''}</td>
                  <td className="p-3 text-right text-tinta-suave">{m.unitCost.toFixed(4)}</td>
                  <td className="p-3 text-right text-tinta-suave">{m.costoTotal !== undefined ? n2(m.costoTotal) : '—'}</td>
                  <td className="p-3 text-center font-bold text-tinta">{nq(m.balance)}</td>
                  <td className="p-3 text-right font-bold text-tinta">{m.saldoCostoTotal !== undefined ? n2(m.saldoCostoTotal) : '—'}</td>
                  <td className="p-3 text-tinta-suave">{m.responsibleUser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Libro />
    </div>
  );
}

/** Registro de Inventario Permanente Valorado – Formato 13.1 (vista, impresión y CSV). */
function Libro() {
  const { state, actions } = useErp();
  const { company, products } = state;
  const [periodo, setPeriodo] = useState(hoyLocal().slice(0, 7));
  const [sku, setSku] = useState('');
  const [libros, setLibros] = useState<Libro131[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [y, m] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const movs = await actions.kardexHasta(hasta);
      setLibros(libro131(products.filter(p => !sku || p.sku === sku), movs, desde, hasta).filter(l => l.filas.length || l.saldoInicial.cantidad));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  };

  const cabecera = (l: Libro131) => [
    ['PERIODO', periodo.replace('-', '')], ['RUC', company.ruc], ['APELLIDOS Y NOMBRES, DENOMINACIÓN O RAZÓN SOCIAL', company.razonSocial],
    ['ESTABLECIMIENTO (1)', company.codigoEstablecimiento || '0000'], ['CÓDIGO DE LA EXISTENCIA', l.sku], ['TIPO (TABLA 5)', `${l.tipoExistencia} ${TABLA_5[l.tipoExistencia] ?? ''}`],
    ['DESCRIPCIÓN', l.descripcion], ['CÓDIGO DE LA UNIDAD DE MEDIDA (TABLA 6)', `${l.unidad} ${TABLA_6[l.unidad] ?? ''}`], ['MÉTODO DE VALUACIÓN', 'PROMEDIO PONDERADO']
  ];

  const exportarCsv = () => {
    if (!libros) return;
    const filas: (string | number)[][] = [['FORMATO 13.1: REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DEL INVENTARIO VALORIZADO']];
    libros.forEach(l => {
      filas.push([], ...cabecera(l));
      filas.push(['FECHA', 'TIPO (TABLA 10)', 'SERIE', 'NÚMERO', 'TIPO DE OPERACIÓN (TABLA 12)', 'ENTRADA CANT.', 'ENTRADA C.U.', 'ENTRADA C.T.', 'SALIDA CANT.', 'SALIDA C.U.', 'SALIDA C.T.', 'SALDO CANT.', 'SALDO C.U.', 'SALDO C.T.']);
      filas.push([desde, '', '', '', '16 SALDO INICIAL', '', '', '', '', '', '', l.saldoInicial.cantidad, l.saldoInicial.costoUnitario.toFixed(4), l.saldoInicial.costoTotal.toFixed(4)]);
      l.filas.forEach(f => filas.push([f.fecha, f.tipoComprobante, f.serie, f.numero, f.tipoOperacion,
        f.entrada?.cantidad ?? '', f.entrada?.costoUnitario.toFixed(4) ?? '', f.entrada?.costoTotal.toFixed(4) ?? '',
        f.salida?.cantidad ?? '', f.salida?.costoUnitario.toFixed(4) ?? '', f.salida?.costoTotal.toFixed(4) ?? '',
        f.saldo.cantidad, f.saldo.costoUnitario.toFixed(4), f.saldo.costoTotal.toFixed(4)]));
      filas.push(['TOTALES', '', '', '', '', l.totales.entradas, '', l.totales.costoEntradas.toFixed(4), l.totales.salidas, '', l.totales.costoSalidas.toFixed(4)]);
    });
    descargarTxt(`formato_13_1_${company.ruc || 'empresa'}_${periodo.replace('-', '')}.csv`, `﻿${csv(filas)}`);
  };

  const exportarPle = () => {
    if (!libros) return;
    if (!/^\d{11}$/.test(company.ruc)) return alert('Configura el RUC de la empresa en Ajustes antes de generar el PLE.');
    const r = generarPle131(company, libros, periodo);
    descargar(nombrePle(company.ruc, periodo, '130100', r.registros > 0), r.contenido);
    if (r.omitidos.length) alert(`PLE 13.1 descargado. Revisa antes de presentarlo: SUNAT pide el código UNSPSC de las mercaderías y productos terminados (ficha del producto):\n\n• ${r.omitidos.slice(0, 15).join('\n• ')}${r.omitidos.length > 15 ? `\n… y ${r.omitidos.length - 15} más` : ''}`);
  };

  const imprimir = () => {
    if (!libros) return;
    const td = (v: string | number, d = true) => `<td class="${d ? 'd' : ''}">${v}</td>`;
    const html = libros.map(l => `<section style="page-break-after:always">
      <h1 style="font-size:13px;text-align:center">FORMATO 13.1: REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DEL INVENTARIO VALORIZADO</h1>
      <table style="margin:8px 0 10px"><tbody>${cabecera(l).map(([k, v]) => `<tr><td style="width:280px" class="suave">${esc(k)}:</td><td><b>${esc(v)}</b></td></tr>`).join('')}</tbody></table>
      <table style="font-size:9px"><thead>
        <tr><th colspan="5" class="c">DOCUMENTO DE TRASLADO, COMPROBANTE DE PAGO, DOCUMENTO INTERNO O SIMILAR</th><th colspan="3" class="c">ENTRADAS</th><th colspan="3" class="c">SALIDAS</th><th colspan="3" class="c">SALDO FINAL</th></tr>
        <tr><th>FECHA</th><th>TIPO (T10)</th><th>SERIE</th><th>NÚMERO</th><th>TIPO OPERACIÓN (T12)</th><th class="d">CANT.</th><th class="d">C.U.</th><th class="d">C.T.</th><th class="d">CANT.</th><th class="d">C.U.</th><th class="d">C.T.</th><th class="d">CANT.</th><th class="d">C.U.</th><th class="d">C.T.</th></tr></thead>
      <tbody><tr><td>${desde}</td><td></td><td></td><td></td><td>16 Saldo inicial</td><td></td><td></td><td></td><td></td><td></td><td></td>${td(nq(l.saldoInicial.cantidad))}${td(l.saldoInicial.costoUnitario.toFixed(4))}${td(n2(l.saldoInicial.costoTotal))}</tr>
      ${l.filas.map(f => `<tr><td>${f.fecha}</td><td>${f.tipoComprobante}</td><td>${esc(f.serie)}</td><td>${esc(f.numero)}</td><td>${f.tipoOperacion} ${esc(TABLA_12[f.tipoOperacion] ?? '')}</td>
        ${f.entrada ? td(nq(f.entrada.cantidad)) + td(f.entrada.costoUnitario.toFixed(4)) + td(n2(f.entrada.costoTotal)) : '<td></td><td></td><td></td>'}
        ${f.salida ? td(nq(f.salida.cantidad)) + td(f.salida.costoUnitario.toFixed(4)) + td(n2(f.salida.costoTotal)) : '<td></td><td></td><td></td>'}
        ${td(nq(f.saldo.cantidad))}${td(f.saldo.costoUnitario.toFixed(4))}${td(n2(f.saldo.costoTotal))}</tr>`).join('')}
      <tr><td colspan="5"><b>TOTALES</b></td>${td(`<b>${nq(l.totales.entradas)}</b>`)}<td></td>${td(`<b>${n2(l.totales.costoEntradas)}</b>`)}${td(`<b>${nq(l.totales.salidas)}</b>`)}<td></td>${td(`<b>${n2(l.totales.costoSalidas)}</b>`)}<td></td><td></td><td></td></tr>
      </tbody></table></section>`).join('');
    imprimirHtml(`Formato 13.1 ${periodo}`, `<div class="hoja" style="max-width:none;padding:16px">${html}</div>`, '@page{size:A4 landscape;margin:8mm} td,th{padding:4px 5px}');
  };

  return (
    <section aria-label="Formato 13.1" className="bg-white rounded-3xl border border-crema-300 shadow-sm p-6 space-y-4 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><BookOpen className="w-5 h-5 text-bosque-700" aria-hidden /> Formato 13.1 · Registro de inventario permanente valorado</h4>
          <p className="text-tinta-suave">Por periodo y existencia, con saldo inicial, entradas, salidas y saldo final valorizados (promedio ponderado). Imprímelo o expórtalo para tu contador.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="font-bold">Periodo<input type="month" aria-label="Periodo del libro" value={periodo} onChange={e => { setPeriodo(e.target.value); setLibros(null); }} className="block mt-1 min-h-[38px] px-2 rounded-control border border-crema-300" /></label>
          <label className="font-bold">Existencia
            <select aria-label="Existencia del libro" value={sku} onChange={e => { setSku(e.target.value); setLibros(null); }} className="block mt-1 min-h-[38px] px-2 rounded-control border border-crema-300 bg-white">
              <option value="">Todas</option>
              {products.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}
            </select>
          </label>
          <Boton tamano="sm" cargando={cargando} onClick={() => void generar()}>Generar</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!libros?.length} onClick={imprimir}><Printer className="w-3.5 h-3.5" aria-hidden /> Imprimir</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!libros?.length} onClick={exportarCsv}><Download className="w-3.5 h-3.5" aria-hidden /> CSV</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!libros?.length} onClick={exportarPle}><Download className="w-3.5 h-3.5" aria-hidden /> PLE 13.1</Boton>
        </div>
      </div>
      {error && <p role="alert" className="text-error font-bold">{error}</p>}
      {libros && !libros.length && <p className="text-tinta-suave">Sin movimientos ni saldo en el periodo.</p>}
      {libros?.map(l => (
        <div key={l.sku} className="space-y-1">
          <p className="font-bold text-tinta">{l.sku} · {l.descripcion} <span className="font-normal text-tinta-suave">· Tabla 5: {l.tipoExistencia} · Tabla 6: {l.unidad} · promedio ponderado</span></p>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px]">
              <thead className="bg-crema text-[10px] uppercase text-tinta-suave"><tr><th className="p-2 text-left">Fecha</th><th className="text-left">T10</th><th className="text-left">Serie</th><th className="text-left">Número</th><th className="text-left">T12</th><th className="text-right">Ent. cant.</th><th className="text-right">Ent. C.T.</th><th className="text-right">Sal. cant.</th><th className="text-right">Sal. C.U.</th><th className="text-right">Sal. C.T.</th><th className="text-right">Saldo cant.</th><th className="text-right">Saldo C.U.</th><th className="text-right pr-2">Saldo C.T.</th></tr></thead>
              <tbody className="divide-y divide-crema-200">
                <tr className="text-tinta-suave"><td className="p-2">{desde}</td><td /><td /><td /><td>16</td><td /><td /><td /><td /><td /><td className="text-right">{nq(l.saldoInicial.cantidad)}</td><td className="text-right">{l.saldoInicial.costoUnitario.toFixed(4)}</td><td className="text-right pr-2">{n2(l.saldoInicial.costoTotal)}</td></tr>
                {l.filas.map((f, i) => (
                  <tr key={i}>
                    <td className="p-2">{f.fecha}</td><td>{f.tipoComprobante}</td><td>{f.serie}</td><td>{f.numero}</td><td title={TABLA_12[f.tipoOperacion]}>{f.tipoOperacion}</td>
                    <td className="text-right text-exito font-bold">{f.entrada ? nq(f.entrada.cantidad) : ''}</td><td className="text-right">{f.entrada ? n2(f.entrada.costoTotal) : ''}</td>
                    <td className="text-right text-error font-bold">{f.salida ? nq(f.salida.cantidad) : ''}</td><td className="text-right">{f.salida ? f.salida.costoUnitario.toFixed(4) : ''}</td><td className="text-right">{f.salida ? n2(f.salida.costoTotal) : ''}</td>
                    <td className="text-right font-bold">{nq(f.saldo.cantidad)}</td><td className="text-right">{f.saldo.costoUnitario.toFixed(4)}</td><td className="text-right pr-2 font-bold">{n2(f.saldo.costoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
