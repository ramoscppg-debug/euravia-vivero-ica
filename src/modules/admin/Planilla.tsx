import { useState } from 'react';
import { Download, Users } from 'lucide-react';
import { lineasPlanilla } from '../../lib/contabilidad';
import { descargarTxt, generarPlaprote } from '../../lib/exports';
import { useErp } from '../../store/ErpStore';
import { calcularPlanillaMes } from '../../store/selectors';
import { periodoLocal } from '../../lib/fechas';

export default function Planilla() {
  const { state } = useErp();
  const { employees, company } = state;
  const planilla = calcularPlanillaMes(employees);

  const exportarAfpnet = () => {
    descargarTxt(`PLAPROTE_${company.ruc}_${periodoLocal().replace('-', '')}.txt`, generarPlaprote(planilla));
    alert('✅ Archivo oficial PLAPROTE.TXT generado exitosamente.\nListo para subir en afpnet.com.pe');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-[#e05780] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Users className="w-4 h-4" /> Planilla MYPE, Provisiones & AFPnet Oficial
          </span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Gestión de Nómina, AFP y Seguro Social</h3>
          <p className="text-xs text-bosque-200">Cálculo de sueldos netos, aportes previsionales, provisión mensual de CTS, Gratificaciones y Vacaciones MYPE.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarAfpnet} className="px-4 py-2.5 rounded-2xl bg-oro text-tinta font-bold text-xs shadow-md flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Exportar a AFPnet (PLAPROTE.TXT)
          </button>
        </div>
      </div>

      {/* 4 KPIs de Planilla y Provisiones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-crema-300 shadow-sm">
          <span className="text-xs font-bold text-tinta-suave uppercase">Sueldo Bruto Nómina</span>
          <div className="text-2xl font-serif font-bold text-tinta mt-1.5">S/ {planilla.totalBruto.toFixed(2)}</div>
          <p className="text-[11px] text-tinta-suave mt-1">{employees.length} colaboradores activos</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-crema-300 shadow-sm">
          <span className="text-xs font-bold text-tinta-suave uppercase">Aporte Salud (EsSalud / SIS)</span>
          <div className="text-2xl font-serif font-bold text-bosque-700 mt-1.5">S/ {planilla.totalEssalud.toFixed(2)}</div>
          <p className="text-[11px] text-bosque-700 font-semibold mt-1">EsSalud 9% · Microempresa: SIS S/ 15/trab.</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-crema-300 shadow-sm">
          <span className="text-xs font-bold text-tinta-suave uppercase">Provisiones Mes</span>
          <div className="text-2xl font-serif font-bold text-oro mt-1.5">S/ {planilla.provTotalMensual.toFixed(2)}</div>
          <p className="text-[11px] text-tinta-suave mt-1">CTS, gratis y vacaciones según régimen (micro: solo vacaciones 15 d)</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-crema-300 shadow-sm">
          <span className="text-xs font-bold text-tinta-suave uppercase">Costo Laboral Total</span>
          <div className="text-2xl font-serif font-bold text-tinta mt-1.5">S/ {planilla.costoTotalPlanilla.toFixed(2)}</div>
          <p className="text-[11px] text-bosque-700 font-bold mt-1">Renta 5ta retenida: S/ {planilla.totalRenta5ta.toFixed(2)}</p>
        </div>
      </div>

      <AsientoPlanilla />
    </div>
  );
}

/** Asiento contable del mes (PCGE 2026) con la planilla vigente. */
function AsientoPlanilla() {
  const { state, actions } = useErp();
  const [periodo, setPeriodo] = useState(periodoLocal());
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const lineas = lineasPlanilla(calcularPlanillaMes(state.employees));
  const plan: Record<string, string> = {
    '6211': 'Sueldos y salarios', '6271': 'Régimen de prestaciones de salud', '4031': 'ESSALUD', '417': 'Administradoras de fondos de pensiones',
    '4032': 'ONP', '40173': 'Renta de quinta categoría', '4111': 'Sueldos y salarios por pagar', '6291': 'Compensación por tiempo de servicio',
    '4151': 'CTS por pagar', '6214': 'Gratificaciones', '4114': 'Gratificaciones por pagar', '6215': 'Vacaciones', '4115': 'Vacaciones por pagar'
  };
  const contabilizar = async () => {
    const r = await actions.contabilizarPlanilla(periodo);
    setAviso(r.ok ? { ok: true, texto: `✓ Planilla de ${periodo} contabilizada en el libro diario.` } : { ok: false, texto: r.error });
  };
  return (
    <section aria-label="Asiento de planilla" className="bg-white rounded-3xl border border-crema-300 p-6 space-y-3 text-xs">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="font-serif font-bold text-base text-tinta">Asiento contable de la planilla (PCGE 2026)</h4>
          <p className="text-tinta-suave">Remuneraciones y aportes (62) contra tributos y remuneraciones por pagar (40/41), con las provisiones del mes. Uno por periodo.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="font-bold">Periodo<input type="month" aria-label="Periodo de la planilla" value={periodo} onChange={e => setPeriodo(e.target.value)} className="block mt-1 min-h-[36px] px-2 rounded-xl border border-crema-300" /></label>
          <button onClick={() => void contabilizar()} disabled={!lineas.length} className="px-4 py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold disabled:opacity-50">Contabilizar planilla del mes</button>
        </div>
      </div>
      {aviso && <p role={aviso.ok ? 'status' : 'alert'} className={`font-bold ${aviso.ok ? 'text-exito' : 'text-error'}`}>{aviso.texto}</p>}
      <table className="w-full">
        <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1">Cuenta</th><th className="text-left">Denominación</th><th className="text-right">Debe</th><th className="text-right">Haber</th></tr></thead>
        <tbody className="divide-y divide-crema-200">
          {lineas.map(l => <tr key={l.cuenta}><td className={`py-1.5 font-mono font-bold ${l.haber ? 'pl-6' : ''}`}>{l.cuenta}</td><td>{plan[l.cuenta] ?? ''}</td><td className="text-right">{l.debe ? l.debe.toFixed(2) : ''}</td><td className="text-right">{l.haber ? l.haber.toFixed(2) : ''}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
