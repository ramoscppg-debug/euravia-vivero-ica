// ==========================================
// METAS DE VENTA
// Meta del mes, avance, ritmo diario para llegar, proyección y lo que la mueve:
// vendedores, canales, productos y cotizaciones convertidas.
// ==========================================
import { useState } from 'react';
import { Target } from 'lucide-react';
import { Boton, Tarjeta } from '../../components/ui';
import { hoyLocal } from '../../lib/fechas';
import { soles } from '../../lib/formato';
import { avanceMeta, ventasEntre } from '../../lib/oficina';
import { useAuth } from '../../store/AuthStore';
import { useErp } from '../../store/ErpStore';
import { Barra, Bloque, Cifra } from '../admin/comunes';

const agrupar = (pares: [string, number][]) => {
  const m = new Map<string, number>();
  pares.forEach(([k, v]) => m.set(k, (m.get(k) ?? 0) + v));
  return [...m].sort((a, b) => b[1] - a[1]);
};

export default function MetasVenta() {
  const { state, actions } = useErp();
  const esDueno = (useAuth().perfil?.rol ?? 'dueno') === 'dueno';
  const hoy = hoyLocal();
  const periodo = hoy.slice(0, 7);
  const metaActual = state.metasVenta[periodo];
  const [monto, setMonto] = useState(metaActual ? String(metaActual) : '');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const a = avanceMeta(state.invoices, metaActual, hoy);
  const { lista } = ventasEntre(state.invoices, `${periodo}-01`, hoy);
  const signo = (t: string) => (t === '07' ? -1 : 1);

  const vendedores = agrupar(lista.map(i => [i.vendedor || 'Sin vendedor', signo(i.tipoComprobante) * i.montoTotal]));
  const canales = agrupar(lista.map(i => [i.canal || 'Directo / Vivero', signo(i.tipoComprobante) * i.montoTotal]));
  const productos = agrupar(lista.flatMap(i => i.items.filter(it => !it.sku.startsWith('SRV-')).map(it => [it.descripcion, signo(i.tipoComprobante) * it.cantidad * it.precioUnitario] as [string, number]))).slice(0, 5);
  const cotizaciones = state.cotizaciones.filter(c => c.fecha.startsWith(periodo));
  const convertidas = cotizaciones.filter(c => c.estado === 'CONVERTIDA').length;
  const ticket = lista.filter(i => i.tipoComprobante !== '07').length ? a.vendido / lista.filter(i => i.tipoComprobante !== '07').length : 0;

  const guardar = async () => {
    const r = await actions.guardarMeta(periodo, Number(monto));
    setMsg(r.ok ? { ok: true, texto: 'Meta guardada ✓' } : { ok: false, texto: r.error });
  };

  return (
    <div className="space-y-5">
      <Tarjeta as="section" className="p-5 space-y-3 text-sm">
        <h3 className="font-extrabold text-tinta flex items-center gap-2"><Target className="w-5 h-5 text-bosque-700" aria-hidden /> Meta de {periodo}</h3>
        {esDueno && (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Meta del mes" type="number" min={0} step={100} value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej. 15000" className="w-40 min-h-[40px] px-3 rounded-control border border-crema-300" />
            <Boton onClick={() => void guardar()}>Guardar meta</Boton>
            {msg && <span role="status" className={`text-xs font-bold ${msg.ok ? 'text-exito' : 'text-error'}`}>{msg.texto}</span>}
          </div>
        )}
        {a.meta ? (
          <>
            <Barra valor={a.vendido} maximo={a.meta} />
            <p aria-label="Avance de la meta" className="text-tinta">
              <b>{a.pct}%</b> · vendido {soles(a.vendido)} de {soles(a.meta)} · faltan <b>{soles(a.falta ?? 0)}</b>
            </p>
          </>
        ) : <p className="text-tinta-suave">Fija la meta del mes para ver el avance y el ritmo diario necesario.</p>}
      </Tarjeta>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Para llegar, vende por día" valor={a.meta ? soles(a.ritmoNecesario ?? 0) : '—'} nota={`${a.diasRestantes + 1} día(s) con hoy`} />
        <Cifra titulo="Proyección al cierre" valor={soles(a.proyeccion)} tono={a.meta ? (a.proyeccion >= a.meta ? 'bien' : 'mal') : 'neutro'} nota={a.meta ? (a.proyeccion >= a.meta ? 'llegas a la meta' : 'a este ritmo no llegas') : undefined} />
        <Cifra titulo="Mes pasado al mismo día" valor={soles(a.mesAnterior)} tono={a.vendido >= a.mesAnterior ? 'bien' : 'mal'} nota={a.mesAnterior ? `${a.vendido >= a.mesAnterior ? '▲' : '▼'} ${Math.abs(Math.round(((a.vendido - a.mesAnterior) / a.mesAnterior) * 100))}%` : undefined} />
        <Cifra titulo="Ticket promedio" valor={soles(ticket)} nota={`cotizaciones convertidas: ${convertidas}/${cotizaciones.length}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Ranking titulo="Por vendedor" filas={vendedores} />
        <Ranking titulo="Por canal" filas={canales} />
        <Ranking titulo="Productos que más venden" filas={productos} />
      </div>
    </div>
  );
}

function Ranking({ titulo, filas }: { titulo: string; filas: [string, number][] }) {
  const max = Math.max(1, ...filas.map(f => f[1]));
  return (
    <Bloque titulo={titulo}>
      {filas.length ? (
        <ul className="space-y-2">
          {filas.map(([k, v]) => (
            <li key={k} className="space-y-1">
              <div className="flex justify-between gap-2 text-xs"><span className="truncate">{k}</span><b>{soles(v)}</b></div>
              <Barra valor={v} maximo={max} />
            </li>
          ))}
        </ul>
      ) : <p className="text-tinta-suave text-xs">Sin ventas en el mes.</p>}
    </Bloque>
  );
}
