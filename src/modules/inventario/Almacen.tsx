import { useState } from 'react';
import { Download } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import { csv, reporteAlmacen } from '../../lib/analitica';
import { descargarTxt } from '../../lib/exports';
import { soles } from '../../lib/formato';
import { rangoDe, type Periodo } from '../../lib/reportes';
import { useErp } from '../../store/ErpStore';
import { Barra, Bloque, Cifra, SelectorPeriodo } from '../admin/comunes';

/** Logística y almacén: cuánto vale el inventario, qué rota, qué no se mueve y cuánto se perdió. */
export default function Almacen() {
  const { state } = useErp();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const { desde, hasta } = rangoDe(periodo);
  const r = reporteAlmacen(state, desde, hasta);
  const topValor = Math.max(1, ...r.valorizacion.map(v => v.valor));

  const exportar = () => descargarTxt(`almacen_${desde}_${hasta}.csv`, `﻿${csv([
    ['Valorización al', hasta], ['SKU', 'Producto', 'Ubicación', 'Stock', 'Costo unit.', 'Valor a costo', 'Valor a precio de venta'],
    ...r.valorizacion.map(v => [v.sku, v.nombre, v.ubicacion, v.stock, v.costo.toFixed(2), v.valor.toFixed(2), v.valorVenta.toFixed(2)]),
    [], ['Rotación', `${desde} a ${hasta}`], ['SKU', 'Producto', 'Salidas', 'Stock', 'Rotación'],
    ...r.rotacion.map(x => [x.sku, x.nombre, x.salidas, x.stock, x.rotacion ?? 'sin stock']),
    [], ['Movimientos por tipo'], ['Tipo', 'Entradas', 'Salidas', 'Movimientos'], ...r.porTipo.map(t => [t.tipo, t.entradas, t.salidas, t.movimientos]),
    [], ['Mermas'], ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Pérdida'], ...r.mermas.map(m => [m.date, m.productName, m.type, m.qty, m.totalLoss.toFixed(2)])
  ])}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectorPeriodo valor={periodo} cambiar={setPeriodo} />
        <Boton tamano="sm" variante="secundario" onClick={exportar}><Download className="w-4 h-4" aria-hidden /> Exportar CSV</Boton>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra titulo="Inventario a costo" valor={soles(r.valorTotal)} nota={`${r.unidades} unidades`} />
        <Cifra titulo="A precio de venta" valor={soles(r.valorVentaTotal)} nota={`Margen potencial ${soles(r.valorVentaTotal - r.valorTotal)}`} />
        <Cifra titulo="Bajo el mínimo" valor={String(r.stockBajo.length)} tono={r.stockBajo.length ? 'mal' : 'neutro'} nota="Productos por reponer" />
        <Cifra titulo="Pérdida por mermas" valor={soles(r.perdidaMermas)} nota={`${r.mermas.length} baja(s) en el periodo`} tono={r.perdidaMermas ? 'mal' : 'neutro'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Dónde está el dinero (valor a costo)">
          <ul className="space-y-2.5">
            {r.valorizacion.slice(0, 10).map(v => (
              <li key={v.sku}>
                <div className="flex justify-between gap-2"><span className="truncate font-semibold">{v.nombre}</span><span className="shrink-0 font-bold">{soles(v.valor)}</span></div>
                <Barra valor={v.valor} maximo={topValor} />
                <p className="text-[11px] text-tinta-suave">{v.stock} u. · {v.ubicacion || 'sin ubicación'}</p>
              </li>
            ))}
            {!r.valorizacion.length && <p className="text-tinta-suave">Sin productos.</p>}
          </ul>
        </Bloque>
        <Bloque titulo="Rotación del periodo">
          <p className="text-xs text-tinta-suave">Rotación = unidades que salieron ÷ stock actual. Mayor número, más rápido se vende.</p>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1">Producto</th><th className="text-right">Salidas</th><th className="text-right">Stock</th><th className="text-right">Rotación</th></tr></thead>
            <tbody className="divide-y divide-crema-200">
              {r.rotacion.slice(0, 12).map(x => <tr key={x.sku}><td className="py-1.5 truncate max-w-[200px]">{x.nombre}</td><td className="text-right">{x.salidas}</td><td className="text-right">{x.stock}</td><td className="text-right font-bold">{x.rotacion ?? 'agotado'}</td></tr>)}
            </tbody>
          </table>
        </Bloque>
        <Bloque titulo="Movimientos por tipo">
          {r.porTipo.length ? (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1">Tipo</th><th className="text-right">Entradas</th><th className="text-right">Salidas</th><th className="text-right">Registros</th></tr></thead>
              <tbody className="divide-y divide-crema-200">{r.porTipo.map(t => <tr key={t.tipo}><td className="py-1.5">{t.tipo}</td><td className="text-right text-exito font-bold">{t.entradas}</td><td className="text-right text-error font-bold">{t.salidas}</td><td className="text-right">{t.movimientos}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-tinta-suave">Sin movimientos de Kardex en el periodo.</p>}
        </Bloque>
        <Bloque titulo="Sin movimiento (con stock)">
          {r.sinMovimiento.length ? (
            <ul className="flex flex-wrap gap-2">{r.sinMovimiento.map(x => <li key={x.sku}><Insignia tono="aviso">{x.nombre} · {x.stock} u.</Insignia></li>)}</ul>
          ) : <p className="text-tinta-suave">Todo el stock tuvo salidas en el periodo.</p>}
          {!!r.stockBajo.length && (
            <>
              <p className="font-bold text-tinta pt-2">Por reponer</p>
              <ul className="flex flex-wrap gap-2">{r.stockBajo.map(p => <li key={p.sku}><Insignia tono="error">{p.name}: {p.stock} / mín. {p.minStock}</Insignia></li>)}</ul>
            </>
          )}
        </Bloque>
      </div>
    </div>
  );
}
