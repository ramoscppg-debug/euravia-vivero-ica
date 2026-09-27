import { Download, Users } from 'lucide-react';
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
    </div>
  );
}
