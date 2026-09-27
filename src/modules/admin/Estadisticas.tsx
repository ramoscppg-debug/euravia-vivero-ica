import { useState } from 'react';
import { Download, PackagePlus } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import { comprasSugeridas, csv, serviciosMasPedidos, ventasPorProducto } from '../../lib/analitica';
import { descargarTxt } from '../../lib/exports';
import { soles } from '../../lib/formato';
import { rangoDe, type Periodo } from '../../lib/reportes';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { Barra, Bloque, Cifra, SelectorPeriodo } from './comunes';

/** Qué sale más, qué servicios piden y cuánto comprar: para decidir compras con datos. */
export default function Estadisticas() {
  const { state } = useErp();
  const { open } = useUi();
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [cobertura, setCobertura] = useState(30);
  const { desde, hasta } = rangoDe(periodo);
  const productos = ventasPorProducto(state, desde, hasta);
  const vendidos = productos.filter(p => p.unidades > 0);
  const sinVenta = productos.filter(p => p.unidades <= 0 && p.stock > 0);
  const servicios = serviciosMasPedidos(state, desde, hasta);
  const compras = comprasSugeridas(state, cobertura, 30);
  const aComprar = compras.filter(c => c.sugerido > 0);
  const topU = Math.max(1, ...vendidos.map(p => p.unidades));
  const topS = Math.max(1, ...servicios.map(s => s.total));

  const exportarCompras = () => descargarTxt(`compras_sugeridas_${hasta}.csv`, `﻿${csv([
    ['SKU', 'Producto', 'Stock', 'Mínimo', 'Venta diaria', 'Días de cobertura', 'Comprar', 'Costo estimado', 'Motivo'],
    ...aComprar.map(c => [c.sku, c.nombre, c.stock, c.minimo, c.ventaDiaria, c.diasCobertura ?? 'sin ventas', c.sugerido, c.costoEstimado.toFixed(2), c.motivo])
  ])}`);

  return (
    <div className="space-y-6">
      <SelectorPeriodo valor={periodo} cambiar={setPeriodo} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Cifra titulo="Unidades vendidas" valor={String(vendidos.reduce((a, p) => a + p.unidades, 0))} nota={`${desde} al ${hasta}`} />
        <Cifra titulo="Productos con venta" valor={`${vendidos.length} / ${productos.length}`} />
        <Cifra titulo="Sin venta (con stock)" valor={String(sinVenta.length)} nota="Capital inmovilizado" tono={sinVenta.length ? 'mal' : 'neutro'} />
        <Cifra titulo="Compra sugerida" valor={soles(aComprar.reduce((a, c) => a + c.costoEstimado, 0))} nota={`${aComprar.length} producto(s) a costo`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Productos que más salen">
          {vendidos.length ? (
            <ol className="space-y-2.5">
              {vendidos.slice(0, 10).map((p, i) => (
                <li key={p.sku}>
                  <div className="flex justify-between gap-2"><span className="truncate font-semibold text-tinta">{i + 1}. {p.nombre}</span><span className="shrink-0 font-bold">{p.unidades} u. · {soles(p.monto)}</span></div>
                  <Barra valor={p.unidades} maximo={topU} />
                </li>
              ))}
            </ol>
          ) : <p className="text-tinta-suave">Sin ventas de productos en el periodo.</p>}
        </Bloque>
        <Bloque titulo="Servicios más solicitados">
          {servicios.length ? (
            <ul className="space-y-2.5">
              {servicios.map(s => (
                <li key={s.servicio}>
                  <div className="flex justify-between gap-2"><span className="truncate font-semibold text-tinta">{s.servicio}</span><span className="shrink-0 font-bold">{s.total}</span></div>
                  <Barra valor={s.total} maximo={topS} />
                  <p className="text-[11px] text-tinta-suave mt-0.5">{s.solicitudes} solicitud(es) web · {s.proyectos} proyecto(s) · {s.contratos} contrato(s) activo(s){s.monto ? ` · ${soles(s.monto)}` : ''}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-tinta-suave">Aún no hay pedidos de servicios.</p>}
        </Bloque>
      </div>

      <Bloque titulo="Compras sugeridas" accion={
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 font-bold">Cubrir
            <select value={cobertura} onChange={e => setCobertura(Number(e.target.value))} className="min-h-[32px] px-2 rounded-lg border border-crema-300 bg-white">
              {[15, 30, 45, 60].map(d => <option key={d} value={d}>{d} días</option>)}
            </select>
          </label>
          <Boton tamano="sm" variante="secundario" onClick={exportarCompras} disabled={!aComprar.length}><Download className="w-4 h-4" aria-hidden /> CSV</Boton>
        </div>
      }>
        <p className="text-xs text-tinta-suave">Venta diaria de los últimos 30 días × días a cubrir + stock mínimo − stock actual.</p>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1.5">Producto</th><th className="text-right">Stock</th><th className="text-right">Mín.</th><th className="text-right">Venta/día</th><th className="text-right">Cobertura</th><th className="text-right">Comprar</th><th className="text-right">Costo est.</th><th /></tr></thead>
            <tbody className="divide-y divide-crema-200">
              {compras.map(c => (
                <tr key={c.sku} className={c.sugerido ? '' : 'text-tinta-suave'}>
                  <td className="py-1.5"><span className="font-semibold">{c.nombre}</span> <Insignia tono={c.motivo === 'Agotado' ? 'error' : c.motivo === 'Stock suficiente' ? 'exito' : 'aviso'}>{c.motivo}</Insignia></td>
                  <td className="text-right">{c.stock}</td><td className="text-right">{c.minimo}</td><td className="text-right">{c.ventaDiaria}</td>
                  <td className="text-right">{c.diasCobertura === null ? '—' : `${c.diasCobertura} d`}</td>
                  <td className="text-right font-extrabold">{c.sugerido || '—'}</td><td className="text-right">{c.sugerido ? soles(c.costoEstimado) : '—'}</td>
                  <td className="text-right">{c.sugerido > 0 && <button onClick={() => open({ type: 'compra' })} className="text-bosque-700 font-bold inline-flex items-center gap-1 hover:underline"><PackagePlus className="w-3.5 h-3.5" aria-hidden /> Registrar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!compras.length && <p className="text-tinta-suave">Crea productos para ver sugerencias de compra.</p>}
      </Bloque>

      {sinVenta.length > 0 && (
        <Bloque titulo="Productos sin venta en el periodo">
          <p className="text-xs text-tinta-suave">Considera promocionarlos, marcarlos como destacados en la tienda o no reponerlos.</p>
          <ul className="flex flex-wrap gap-2">{sinVenta.map(p => <li key={p.sku}><Insignia>{p.nombre} · {p.stock} u.</Insignia></li>)}</ul>
        </Bloque>
      )}
    </div>
  );
}
