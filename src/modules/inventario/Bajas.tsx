import { PlusCircle, Scissors } from 'lucide-react';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Bajas() {
  const { state } = useErp();
  const { open } = useUi();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-error-fondo text-error px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Scissors className="w-4 h-4" /> Módulo de Bajas Biológicas & Cuarentena
          </span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Mermas, Desmedros Fitosanitarios & Aislamiento</h3>
          <p className="text-xs text-bosque-200">Sustenta legal y tributariamente la pérdida de plantas por plagas o marchitez para deducción del Impuesto a la Renta.</p>
        </div>
        <button
          onClick={() => open({ type: 'baja' })}
          className="px-4 py-2.5 rounded-2xl bg-oro text-tinta font-bold text-xs flex items-center gap-1.5 shadow-md"
        >
          <PlusCircle className="w-4 h-4" /> Registrar Baja / Cuarentena
        </button>
      </div>

      {/* Registro de Bajas */}
      <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4">
        <h4 className="font-serif font-bold text-base text-tinta">Historial de Bajas Biológicas y Cuarentena</h4>
        <div className="space-y-3 text-xs">
          {state.losses.map(loss => (
            <div key={loss.id} className="p-4 bg-crema rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-tinta">{loss.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${loss.type === 'DESMEDRO_PLAGA' ? 'bg-error-fondo text-error' : loss.type === 'CUARENTENA_FITOSANITARIA' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#f3f4f6] text-[#4b5563]'}`}>
                    {loss.type.replace('_', ' ')}
                  </span>
                  <span className="font-serif font-bold text-tinta">{loss.productName} ({loss.qty} u.)</span>
                </div>
                <p className="text-tinta-suave text-[11px] mt-1">{loss.reason}</p>
                <p className="text-[10px] text-tinta-suave mt-0.5">Fecha: {loss.date} • Estado: {loss.status}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-tinta-suave uppercase font-bold block">Pérdida Valorizada</span>
                <span className="font-serif font-bold text-base text-[#e05780]">S/ {loss.totalLoss.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
