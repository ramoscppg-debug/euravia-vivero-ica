import { Building2, Download } from 'lucide-react';
import type { RegimenTributario } from '../../domain/types';
import { descargarTxt, generarSire } from '../../lib/exports';
import { useErp } from '../../store/ErpStore';
import { calcularFinanzas, REGIMEN_LABELS } from '../../store/selectors';

const REGIMENES: RegimenTributario[] = ['NRUS', 'RER', 'RMT', 'RG'];

export default function Contabilidad() {
  const { state, actions } = useErp();
  const { company, invoices, purchases, regimenTributario } = state;
  const f = calcularFinanzas(state);

  const exportar = (tipo: 'RVIE' | 'RCE') => {
    descargarTxt(`SIRE_${tipo}_${company.ruc}_202609.txt`, generarSire(tipo, company, invoices, purchases));
    alert(`✅ Archivo oficial ${tipo} para el SIRE SUNAT descargado exitosamente.`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#082017] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#134e2e]" /> Configuración del Régimen Tributario SUNAT
          </h3>
          <p className="text-xs text-[#5c7367]">Elige el régimen tributario para adaptar automáticamente los libros contables y las tasas impositivas</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {REGIMENES.map(r => (
            <button
              key={r}
              onClick={() => actions.setRegimen(r)}
              className={`px-3.5 py-2 rounded-2xl font-bold text-xs border transition ${regimenTributario === r ? 'bg-[#082017] text-[#d4af37] border-[#082017]' : 'bg-[#faf8f5] text-[#5c7367]'}`}
            >
              {r === 'RMT' ? '⭐ ' : ''}{REGIMEN_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-Liquidación Declara Fácil 621 */}
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold">Pre-Liquidación Mensual (Formulario Virtual 621 IGV - Renta)</span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Total Impuesto Mensual a Pagar: S/ {f.totalImpuestosMes.toFixed(2)}</h3>
          <p className="text-xs text-[#c2d4cb]">{f.usaIgv ? 'Débito Fiscal (IGV Ventas) menos Crédito Fiscal (IGV Compras con Factura) más ' : 'Sin IGV en NRUS. '}Pago a Cuenta de Renta: {f.pagoCuentaRentaDetalle.detalle}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportar('RVIE')} className="px-4 py-2.5 rounded-2xl bg-[#d4af37] text-[#082017] font-bold text-xs shadow-md flex items-center gap-1.5"><Download className="w-4 h-4" /> Exportar RVIE (SIRE)</button>
          <button onClick={() => exportar('RCE')} className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5"><Download className="w-4 h-4" /> Exportar RCE (SIRE)</button>
        </div>
      </div>
    </div>
  );
}
