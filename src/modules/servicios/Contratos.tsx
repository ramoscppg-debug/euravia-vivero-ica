import { useState } from 'react';
import { CalendarCheck, PlusCircle, Receipt, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import type { Contrato } from '../../domain/types';
import { porFacturar } from '../../lib/contratos';
import { useAuth } from '../../store/AuthStore';
import { useErp, type ContratoInput } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { hoyLocal, periodoLocal } from '../../lib/fechas';

const periodoActual = () => periodoLocal();

export default function Contratos() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const gestiona = rol !== 'jardinero';
  const { contratos } = state;
  const activos = contratos.filter(c => c.activo);
  const mrr = activos.reduce((a, c) => a + c.montoMensual, 0);

  const facturar = async (c: Contrato) => {
    if (!confirm(`¿Emitir el comprobante de ${periodoActual()} por S/ ${c.montoMensual.toFixed(2)} a ${c.cliente.nombre}?`)) return;
    const r = await actions.facturarContrato(c.id);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017] flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-[#134e2e]" /> Contratos de Mantenimiento</h3>
          <p className="text-xs text-[#5c7367]">Ingreso fijo cada mes: se factura en el día de cobro (con detracción si corresponde) y se agendan las visitas del jardinero.</p>
        </div>
        {gestiona && (
          <button onClick={() => open({ type: 'contrato' })} className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md">
            <PlusCircle className="w-4 h-4" /> Nuevo Contrato
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Contratos activos</span><p className="font-serif text-2xl font-bold text-[#082017]">{activos.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Ingreso mensual fijo</span><p className="font-serif text-2xl font-bold text-[#134e2e]">S/ {mrr.toFixed(2)}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Por facturar este mes</span><p className="font-serif text-2xl font-bold text-[#e05780]">{contratos.filter(c => porFacturar(c)).length}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {contratos.map(c => {
          const toca = porFacturar(c);
          const facturadoMes = c.ultimoPeriodo === periodoActual();
          return (
            <article key={c.id} aria-label={`Contrato ${c.id}`} className={`bg-white rounded-3xl border p-5 space-y-2 ${c.activo ? 'border-[#e8e2d8]' : 'border-[#e5e7eb] opacity-60'}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <span className="font-mono text-[10px] text-[#8fa89b] font-bold">{c.id}</span>
                  <h4 className="font-serif font-bold text-base text-[#082017]">{c.cliente.nombre}</h4>
                  <p className="text-[#5c7367]">{c.servicio}</p>
                </div>
                <span className="font-serif font-bold text-lg text-[#082017] shrink-0">S/ {c.montoMensual.toFixed(2)}<span className="text-[10px] text-[#8fa89b] font-sans">/mes</span></span>
              </div>
              <p className="text-[#5c7367]">Cobro el día {c.diaCobro} · {c.visitasMes} visita(s)/mes{c.jardinero ? ` · ${c.jardinero}` : ''} · desde {c.inicio}</p>
              <p className={`font-bold ${facturadoMes ? 'text-[#134e2e]' : toca ? 'text-[#c2410c]' : 'text-[#8fa89b]'}`}>
                {!c.activo ? 'Pausado' : facturadoMes ? `✅ Facturado ${periodoActual()}` : toca ? '⚠️ Toca facturar este mes' : `Último facturado: ${c.ultimoPeriodo ?? '—'}`}
              </p>
              {gestiona && (
                <div className="flex gap-2 pt-1">
                  {c.activo && !facturadoMes && (
                    <button onClick={() => void facturar(c)} className="flex-1 py-2 rounded-xl bg-[#082017] text-[#d4af37] font-bold flex items-center justify-center gap-1"><Receipt className="w-3.5 h-3.5" /> Facturar {periodoActual()}</button>
                  )}
                  <button onClick={async () => { const r = await actions.activarContrato(c.id, !c.activo); if (!r.ok) alert(r.error); }} className="px-3 py-2 rounded-xl bg-[#f4ede4] font-bold">{c.activo ? 'Pausar' : 'Reactivar'}</button>
                </div>
              )}
            </article>
          );
        })}
        {!contratos.length && <p className="text-[#8fa89b] font-semibold">Aún no hay contratos. Convertir a un cliente de proyecto en mantenimiento mensual es la forma más estable de crecer.</p>}
      </div>
    </div>
  );
}

// ============================================================
// MODAL: NUEVO CONTRATO
// ============================================================
export function NuevoContratoModal() {
  const { actions } = useErp();
  const { close } = useUi();
  const [c, setC] = useState<ContratoInput>({
    cliente: { nombre: '', doc: '', telefono: '' },
    direccion: '',
    servicio: 'Mantenimiento mensual de jardín',
    montoMensual: 350,
    diaCobro: 5,
    visitasMes: 2,
    jardinero: '',
    inicio: hoyLocal()
  });
  const input = 'w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold';
  const campo = (label: string, el: React.ReactNode, span = '') => <label className={`block ${span}`}><span className="font-bold block mb-1 text-[#082017]">{label}</span>{el}</label>;

  const guardar = async () => {
    const r = await actions.crearContrato(c);
    if (!r.ok) alert(r.error);
    else close();
  };

  return (
    <ModalShell size="max-w-2xl" padding="p-6">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <h3 className="font-serif font-bold text-lg text-[#082017]">Nuevo Contrato de Mantenimiento</h3>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {campo('Cliente', <input aria-label="Cliente" value={c.cliente.nombre} onChange={e => setC({ ...c, cliente: { ...c.cliente, nombre: e.target.value } })} className={input} />, 'sm:col-span-2')}
        {campo('DNI / RUC', <input aria-label="DNI o RUC" value={c.cliente.doc} onChange={e => setC({ ...c, cliente: { ...c.cliente, doc: e.target.value.trim() } })} className={`${input} font-mono`} />)}
        {campo('Servicio', <input aria-label="Servicio" value={c.servicio} onChange={e => setC({ ...c, servicio: e.target.value })} className={input} />, 'sm:col-span-2')}
        {campo('WhatsApp', <input aria-label="WhatsApp" value={c.cliente.telefono} onChange={e => setC({ ...c, cliente: { ...c.cliente, telefono: e.target.value } })} className={input} />)}
        {campo('Dirección', <input aria-label="Dirección" value={c.direccion} onChange={e => setC({ ...c, direccion: e.target.value })} className={input} />, 'sm:col-span-3')}
        {campo('Monto mensual (S/, inc. IGV)', <input aria-label="Monto mensual" type="number" min={0} value={c.montoMensual} onChange={e => setC({ ...c, montoMensual: Number(e.target.value) || 0 })} className={input} />)}
        {campo('Día de cobro (1-28)', <input aria-label="Día de cobro" type="number" min={1} max={28} value={c.diaCobro} onChange={e => setC({ ...c, diaCobro: Math.floor(Number(e.target.value) || 1) })} className={input} />)}
        {campo('Visitas por mes', <input aria-label="Visitas por mes" type="number" min={1} max={8} value={c.visitasMes} onChange={e => setC({ ...c, visitasMes: Math.floor(Number(e.target.value) || 1) })} className={input} />)}
        {campo('Jardinero a cargo', <input aria-label="Jardinero" value={c.jardinero} onChange={e => setC({ ...c, jardinero: e.target.value })} className={input} />, 'sm:col-span-2')}
        {campo('Inicio', <input aria-label="Inicio" type="date" value={c.inicio} onChange={e => setC({ ...c, inicio: e.target.value })} className={input} />)}
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={guardar} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold">Guardar Contrato</button>
      </div>
    </ModalShell>
  );
}
