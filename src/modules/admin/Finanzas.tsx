import { useState } from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import { Boton, EstadoVacio, Insignia } from '../../components/ui';
import { csv, libroFinanzas } from '../../lib/analitica';
import { descargarTxt } from '../../lib/exports';
import { soles } from '../../lib/formato';
import { rangoDe, type Periodo } from '../../lib/reportes';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { Bloque, Cifra, SelectorPeriodo } from './comunes';

/**
 * Área contable: lo que falta emitir (pedidos con el comprobante que pidió el cliente)
 * y el libro de ingresos y egresos del periodo.
 */
export default function Finanzas() {
  const { state } = useErp();
  const { open, setTab } = useUi();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const { desde, hasta } = rangoDe(periodo);
  const libro = libroFinanzas(state, desde, hasta);

  const porEmitir = state.pedidos.filter(p => p.estado === 'pendiente');
  const serviciosPorCotizar = state.solicitudes.filter(s => s.tipo === 'SERVICIO' && (s.estado === 'NUEVA' || s.estado === 'EN_PROCESO'));
  const proyectosPorFacturar = state.projects.filter(p => !p.invoiceId && p.status !== 'COTIZADO');
  const hayPendientes = porEmitir.length + serviciosPorCotizar.length + proyectosPorFacturar.length > 0;

  const exportar = () => {
    const filas = [['Fecha', 'Tipo', 'Categoría', 'Documento', 'Detalle', 'Monto'], ...libro.movs.map(m => [m.fecha, m.tipo, m.categoria, m.documento, m.detalle, (m.tipo === 'EGRESO' ? -m.monto : m.monto).toFixed(2)]),
      [], ['', '', '', '', 'Ingresos', libro.ingresos.toFixed(2)], ['', '', '', '', 'Egresos', libro.egresos.toFixed(2)], ['', '', '', '', 'Resultado', libro.resultado.toFixed(2)]];
    descargarTxt(`ingresos_egresos_${desde}_${hasta}.csv`, `﻿${csv(filas)}`);
  };

  return (
    <div className="space-y-6">
      {/* Por emitir */}
      <Bloque titulo="Por emitir" accion={<span className="text-xs text-tinta-suave">Pedidos y servicios con el comprobante que eligió el cliente</span>}>
        {!hayPendientes ? (
          <p className="text-tinta-suave">No hay comprobantes pendientes.</p>
        ) : (
          <ul className="divide-y divide-crema-200">
            {porEmitir.map(p => (
              <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[200px]">
                  <span className="font-bold text-tinta">{p.razonSocial || p.cliente.nombre}</span>
                  <span className="block text-xs text-tinta-suave font-mono">{p.id} · {p.cliente.doc ? `${p.cliente.doc.length === 11 ? 'RUC' : 'DNI'} ${p.cliente.doc} · ` : ''}venta de bienes · {p.canal}</span>
                </span>
                <Insignia tono={p.tipoComprobante === '01' ? 'marca' : 'neutro'}>{p.tipoComprobante === '01' ? 'Factura' : p.tipoComprobante === '03' ? 'Boleta' : 'Sin elegir'}</Insignia>
                <span className="font-extrabold text-tinta w-24 text-right">{soles(p.total)}</span>
                <Boton tamano="sm" onClick={() => open({ type: 'pedido-cobro', pedido: p })}><FileCheck2 className="w-4 h-4" aria-hidden /> Cobrar y emitir</Boton>
              </li>
            ))}
            {proyectosPorFacturar.map(p => (
              <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[200px]"><span className="font-bold text-tinta">{p.client}</span><span className="block text-xs text-tinta-suave font-mono">{p.id} · servicio: {p.type}</span></span>
                <Insignia tono={p.doc.length === 11 ? 'marca' : 'neutro'}>{p.doc.length === 11 ? 'Factura' : 'Boleta'}</Insignia>
                <span className="font-extrabold text-tinta w-24 text-right">{soles(p.total)}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => setTab('jardineria')}>Facturar servicio</Boton>
              </li>
            ))}
            {serviciosPorCotizar.map(s => (
              <li key={s.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[200px]"><span className="font-bold text-tinta">{s.razonSocial || s.nombre}</span><span className="block text-xs text-tinta-suave font-mono">Solicitud {s.id} · servicio por cotizar</span></span>
                <Insignia tono={s.comprobante === 'FACTURA' ? 'marca' : 'neutro'}>{s.comprobante === 'FACTURA' ? 'Factura' : 'Boleta'}</Insignia>
                <Boton tamano="sm" variante="secundario" onClick={() => setTab('solicitudes')}>Ver solicitud</Boton>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectorPeriodo valor={periodo} cambiar={setPeriodo} />
        <Boton tamano="sm" variante="secundario" onClick={exportar} disabled={!libro.movs.length}><Download className="w-4 h-4" aria-hidden /> Exportar CSV</Boton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Cifra titulo="Ingresos" valor={soles(libro.ingresos)} nota={`${desde} al ${hasta}`} />
        <Cifra titulo="Egresos" valor={soles(libro.egresos)} nota="Compras, gastos y devoluciones" />
        <Cifra titulo="Resultado" valor={soles(libro.resultado)} tono={libro.resultado >= 0 ? 'bien' : 'mal'} nota="Ingresos − egresos (IGV incluido)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Bloque titulo="Por categoría">
          {libro.porCategoria.length ? (
            <ul className="space-y-2">
              {libro.porCategoria.map(c => (
                <li key={c.categoria} className="flex justify-between gap-2"><span className="text-tinta">{c.categoria}</span><span className={`font-bold ${c.tipo === 'EGRESO' ? 'text-error' : 'text-exito'}`}>{c.tipo === 'EGRESO' ? '−' : '+'} {soles(c.monto)}</span></li>
              ))}
            </ul>
          ) : <p className="text-tinta-suave">Sin movimientos en el periodo.</p>}
        </Bloque>
        <Bloque titulo="Libro de ingresos y egresos">
          {libro.movs.length ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1.5">Fecha</th><th className="text-left">Categoría</th><th className="text-left">Documento</th><th className="text-left">Detalle</th><th className="text-right">Monto</th></tr></thead>
                <tbody className="divide-y divide-crema-200">
                  {libro.movs.map(m => (
                    <tr key={`${m.documento}-${m.categoria}`}><td className="py-1.5 whitespace-nowrap">{m.fecha}</td><td>{m.categoria}</td><td className="font-mono">{m.documento}</td><td className="max-w-[240px] truncate">{m.detalle}</td>
                      <td className={`text-right font-bold whitespace-nowrap ${m.tipo === 'EGRESO' ? 'text-error' : 'text-exito'}`}>{m.tipo === 'EGRESO' ? '−' : '+'} {soles(m.monto)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EstadoVacio titulo="Sin movimientos" detalle="Las ventas, compras y gastos del periodo aparecerán aquí." />}
        </Bloque>
      </div>
    </div>
  );
}
