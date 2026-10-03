// ==========================================
// TABLERO DEL DÍA
// Lo primero al entrar: cómo van las ventas de hoy y del mes, y lo que hay que atender (cada punto lleva a su pantalla).
// ==========================================
import { ArrowRight } from 'lucide-react';
import { Tarjeta } from '../../components/ui';
import { hoyLocal } from '../../lib/fechas';
import { soles } from '../../lib/formato';
import { avanceMeta, pendientesDelDia, ventasEntre } from '../../lib/oficina';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { recordatoriosDelDia } from '../clientes/Recordatorios';
import { Barra, Cifra } from '../admin/comunes';

export default function TableroDia() {
  const { state } = useErp();
  const { setTab } = useUi();
  const hoy = hoyLocal();
  const ayer = new Date(Date.parse(hoy) - 86_400_000).toISOString().slice(0, 10);
  const deHoy = ventasEntre(state.invoices, hoy, hoy);
  const deAyer = ventasEntre(state.invoices, ayer, ayer);
  const meta = avanceMeta(state.invoices, state.metasVenta[hoy.slice(0, 7)], hoy);
  const pendientes = pendientesDelDia(state, hoy, state.avisos.diasAnticipacion ?? 3);
  const recordatorios = recordatoriosDelDia(state, hoy, '').length;
  const opiniones = state.resenas.filter(r => !r.aprobada).length;
  const extra = [
    ...(recordatorios ? [{ clave: 'REC', icono: '💬', texto: `${recordatorios} recordatorio(s) de WhatsApp para enviar`, tab: 'recordatorios' as const, urgente: false }] : []),
    ...(opiniones ? [{ clave: 'RES', icono: '⭐', texto: `${opiniones} opinión(es) de clientes por aprobar`, tab: 'resenas' as const, urgente: false }] : [])
  ];
  const lista = [...pendientes, ...extra];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Ventas de hoy" valor={soles(deHoy.total)} nota={`${deHoy.comprobantes} comprobante(s)`} />
        <Cifra titulo="Ayer" valor={soles(deAyer.total)} nota={deAyer.total ? `${deHoy.total >= deAyer.total ? '▲' : '▼'} hoy vs. ayer` : undefined} />
        <Cifra titulo="Vendido en el mes" valor={soles(meta.vendido)} nota={meta.mesAnterior ? `mes pasado al mismo día: ${soles(meta.mesAnterior)}` : undefined} tono={meta.mesAnterior && meta.vendido < meta.mesAnterior ? 'mal' : 'neutro'} />
        <Cifra titulo="Por atender" valor={String(lista.length)} nota={lista.some(x => x.urgente) ? 'hay pendientes urgentes' : undefined} tono={lista.some(x => x.urgente) ? 'mal' : 'bien'} />
      </div>

      <Tarjeta as="section" className="p-5 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-tinta">Meta del mes</h3>
          <button onClick={() => setTab('metas')} className="text-xs font-bold text-bosque-700 hover:underline">{meta.meta ? 'Ver detalle' : 'Fijar meta'}</button>
        </div>
        {meta.meta ? (
          <>
            <Barra valor={meta.vendido} maximo={meta.meta} />
            <p className="text-tinta-suave">{meta.pct}% de {soles(meta.meta)} · faltan {soles(meta.falta ?? 0)} · para llegar vende <b className="text-tinta">{soles(meta.ritmoNecesario ?? 0)} por día</b> ({meta.diasRestantes + 1} día(s) con hoy) · proyección: {soles(meta.proyeccion)}</p>
          </>
        ) : <p className="text-tinta-suave">Aún no hay meta para este mes. Fíjala para ver tu avance y el ritmo diario que necesitas.</p>}
      </Tarjeta>

      <Tarjeta as="section" className="p-5 space-y-2 text-sm" >
        <h3 className="font-extrabold text-tinta">Para hoy</h3>
        {lista.length ? (
          <ul aria-label="Pendientes del día" className="divide-y divide-crema-200">
            {lista.map(p => (
              <li key={p.clave}>
                <button onClick={() => setTab(p.tab)} className={`w-full py-2.5 flex items-center gap-3 text-left hover:bg-crema-50 rounded-control px-2 ${p.urgente ? 'font-bold text-tinta' : 'text-tinta'}`}>
                  <span aria-hidden className="text-lg">{p.icono}</span>
                  <span className="flex-1">{p.texto}</span>
                  {p.urgente && <span className="text-[10px] font-extrabold uppercase text-error">urgente</span>}
                  <ArrowRight className="w-4 h-4 text-tinta-suave" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-tinta-suave">✅ Nada pendiente para hoy.</p>}
      </Tarjeta>
    </div>
  );
}
