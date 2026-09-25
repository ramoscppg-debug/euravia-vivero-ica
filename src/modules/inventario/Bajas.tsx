import { PlusCircle, Scissors } from 'lucide-react';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Bajas() {
  const { state } = useErp();
  const { open } = useUi();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#fee2e2] text-[#b91c1c] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Scissors className="w-4 h-4" /> Módulo de Bajas Biológicas & Cuarentena
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Mermas, Desmedros Fitosanitarios & Aislamiento</h3>
          <p className="text-xs text-[#c2d4cb]">Sustenta legal y tributariamente la pérdida de plantas por plagas o marchitez para deducción del Impuesto a la Renta.</p>
        </div>
        <button
          onClick={() => open({ type: 'baja' })}
          className="px-4 py-2.5 rounded-2xl bg-[#d4af37] text-[#082017] font-bold text-xs flex items-center gap-1.5 shadow-md"
        >
          <PlusCircle className="w-4 h-4" /> Registrar Baja / Cuarentena
        </button>
      </div>

      {/* Registro de Bajas */}
      <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
        <h4 className="font-serif font-bold text-base text-[#082017]">Historial de Bajas Biológicas y Cuarentena</h4>
        <div className="space-y-3 text-xs">
          {state.losses.map(loss => (
            <div key={loss.id} className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#082017]">{loss.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${loss.type === 'DESMEDRO_PLAGA' ? 'bg-[#fee2e2] text-[#b91c1c]' : loss.type === 'CUARENTENA_FITOSANITARIA' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#f3f4f6] text-[#4b5563]'}`}>
                    {loss.type.replace('_', ' ')}
                  </span>
                  <span className="font-serif font-bold text-[#082017]">{loss.productName} ({loss.qty} u.)</span>
                </div>
                <p className="text-[#5c7367] text-[11px] mt-1">{loss.reason}</p>
                <p className="text-[10px] text-[#8fa89b] mt-0.5">Fecha: {loss.date} • Estado: {loss.status}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Pérdida Valorizada</span>
                <span className="font-serif font-bold text-base text-[#e05780]">S/ {loss.totalLoss.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
