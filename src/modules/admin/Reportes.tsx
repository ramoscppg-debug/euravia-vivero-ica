import { useState } from 'react';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { descargarTxt } from '../../lib/exports';
import { generarReporte, PERIODOS, rangoDe, type Fila, type Periodo } from '../../lib/reportes';
import { useErp } from '../../store/ErpStore';

// Una sola serie por gráfico: un solo tono de la marca, sin leyenda (el título la nombra)
const TINTA = '#134e2e';
const PISTA = '#f4ede4';
const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Kpi({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]">
      <span className="font-bold text-[#5c7367] uppercase text-[10px]">{titulo}</span>
      <p className="font-serif text-2xl font-bold text-[#082017]">{valor}</p>
      {nota && <p className="text-[10px] text-[#8fa89b]">{nota}</p>}
    </div>
  );
}

/** Ranking en barras horizontales: etiqueta y valor en texto (no en color), barra como marca. */
function Ranking({ titulo, filas, conMargen = false, max = 8 }: { titulo: string; filas: Fila[]; conMargen?: boolean; max?: number }) {
  const [tabla, setTabla] = useState(false);
  const visibles = filas.slice(0, max);
  const tope = Math.max(1, ...visibles.map(f => Math.abs(f.monto)));
  return (
    <section aria-label={titulo} className="bg-white rounded-3xl border border-[#e8e2d8] p-5 space-y-3 text-xs">
      <div className="flex justify-between items-center">
        <h4 className="font-serif font-bold text-sm text-[#082017]">{titulo}</h4>
        <button onClick={() => setTabla(t => !t)} className="text-[10px] font-bold text-[#5c7367] flex items-center gap-1" aria-pressed={tabla}>
          {tabla ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />} {tabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>
      {!visibles.length && <p className="text-[#8fa89b]">Sin ventas en el periodo.</p>}
      {tabla ? (
        <table className="w-full">
          <thead className="text-[10px] uppercase text-[#5c7367]"><tr><th className="text-left py-1">Nombre</th><th className="text-right">Cant.</th><th className="text-right">Monto</th>{conMargen && <th className="text-right">Margen</th>}</tr></thead>
          <tbody className="divide-y divide-[#f5efe6]">
            {filas.map(f => (
              <tr key={f.clave}><td className="py-1 text-[#082017]">{f.clave}</td><td className="text-right">{f.cantidad}</td><td className="text-right font-mono">{soles(f.monto)}</td>{conMargen && <td className="text-right font-mono">{soles(f.margen ?? 0)}</td>}</tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-2">
          {visibles.map(f => (
            <li key={f.clave} className="group" title={`${f.clave}: ${soles(f.monto)} · ${f.cantidad} ${conMargen ? 'u.' : 'venta(s)'}${conMargen ? ` · margen ${soles(f.margen ?? 0)}` : ''}`}>
              <div className="flex justify-between gap-2 text-[#082017]">
                <span className="truncate font-semibold">{f.clave}</span>
                <span className="font-mono shrink-0">{soles(f.monto)}</span>
              </div>
              <div className="h-2 rounded-full mt-1" style={{ background: PISTA }}>
                <div className="h-2 rounded-full transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(2, (Math.abs(f.monto) / tope) * 100)}%`, background: TINTA }} />
              </div>
              <span className="text-[10px] text-[#8fa89b]">{f.cantidad} {conMargen ? 'u.' : 'venta(s)'}{conMargen && f.margen !== undefined ? ` · margen ${soles(f.margen)}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ventas por día: columnas finas con línea base, tooltip al pasar el mouse o el foco. */
function VentasPorDia({ serie }: { serie: { fecha: string; monto: number }[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const tope = Math.max(1, ...serie.map(d => d.monto));
  const punto = activo !== null ? serie[activo] : null;
  return (
    <section aria-label="Ventas por día" className="bg-white rounded-3xl border border-[#e8e2d8] p-5 space-y-2 text-xs">
      <div className="flex justify-between items-baseline">
        <h4 className="font-serif font-bold text-sm text-[#082017]">Ventas netas por día</h4>
        <span className="text-[#5c7367] h-4" aria-live="polite">{punto ? `${punto.fecha}: ${soles(punto.monto)}` : `Máximo ${soles(tope)}`}</span>
      </div>
      <div className="h-40 flex items-end gap-[2px] border-b border-[#e8e2d8]" onMouseLeave={() => setActivo(null)}>
        {serie.map((d, i) => (
          <button
            key={d.fecha}
            aria-label={`${d.fecha}: ${soles(d.monto)}`}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            className="flex-1 h-full flex items-end min-w-[2px] focus:outline-none"
          >
            <span
              className="w-full rounded-t-[4px] transition-opacity"
              style={{ height: `${d.monto > 0 ? Math.max(2, (d.monto / tope) * 100) : 0}%`, background: TINTA, opacity: activo === null || activo === i ? 1 : 0.45 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[#8fa89b]"><span>{serie[0]?.fecha}</span><span>{serie[serie.length - 1]?.fecha}</span></div>
    </section>
  );
}

export default function Reportes() {
  const { state } = useErp();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const { desde, hasta } = rangoDe(periodo);
  const r = generarReporte(state.invoices, state.products, desde, hasta);

  const exportar = () => {
    const bloque = (titulo: string, filas: Fila[]) => [titulo, 'nombre,cantidad,monto,margen', ...filas.map(f => `"${f.clave.replace(/"/g, '""')}",${f.cantidad},${f.monto.toFixed(2)},${f.margen?.toFixed(2) ?? ''}`)].join('\n');
    const csv = [
      `Reporte de ventas ${desde} a ${hasta}`,
      `Ventas netas,${r.ventasNetas.toFixed(2)}`, `Tickets,${r.tickets}`, `Ticket promedio,${r.ticketPromedio.toFixed(2)}`,
      `Descuentos,${r.descuentos.toFixed(2)}`, `Devoluciones,${r.devoluciones.toFixed(2)}`, `Margen bruto (sin IGV),${r.margenBruto.toFixed(2)}`, '',
      bloque('Por producto', r.porProducto), '', bloque('Por canal', r.porCanal), '', bloque('Por vendedor', r.porVendedor), '', bloque('Por medio de pago', r.porMedio)
    ].join('\n');
    descargarTxt(`reporte_ventas_${desde}_${hasta}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017] flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#134e2e]" /> Reportes de Ventas</h3>
          <p className="text-xs text-[#5c7367]">Del {desde} al {hasta} · incluye devoluciones · margen = base sin IGV − costo de inventario</p>
        </div>
        <button onClick={exportar} className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md"><Download className="w-4 h-4" /> Exportar CSV</button>
      </div>

      {/* Filtro de periodo: una sola fila sobre los gráficos */}
      <div className="flex flex-wrap gap-1.5 text-xs" role="radiogroup" aria-label="Periodo">
        {PERIODOS.map(p => (
          <button key={p.id} role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)} className={`px-3 py-1.5 rounded-full font-bold border ${periodo === p.id ? 'bg-[#082017] text-[#d4af37] border-[#082017]' : 'bg-white text-[#5c7367] border-[#e8e2d8]'}`}>{p.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
        <Kpi titulo="Ventas netas" valor={soles(r.ventasNetas)} nota={`${r.tickets} ticket(s)`} />
        <Kpi titulo="Ticket promedio" valor={soles(r.ticketPromedio)} />
        <Kpi titulo="Margen bruto" valor={soles(r.margenBruto)} nota={`${r.margenPct}% sobre la base sin IGV`} />
        <Kpi titulo="Descuentos otorgados" valor={soles(r.descuentos)} />
        <Kpi titulo="Devoluciones" valor={soles(r.devoluciones)} />
      </div>

      <VentasPorDia serie={r.porDia} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Ranking titulo="Productos más vendidos" filas={r.porProducto} conMargen />
        <Ranking titulo="Ventas por canal" filas={r.porCanal} />
        <Ranking titulo="Ventas por vendedor" filas={r.porVendedor} />
        <Ranking titulo="Ventas por medio de pago" filas={r.porMedio} />
      </div>
    </div>
  );
}
