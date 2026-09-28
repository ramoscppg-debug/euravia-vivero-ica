import { Building2, Download } from 'lucide-react';
import type { RegimenTributario } from '../../domain/types';
import { descargar, generarRce, generarRvie, nombreSire, zip } from '../../lib/librosSunat';
import { useErp } from '../../store/ErpStore';
import { calcularFinanzas, REGIMEN_LABELS } from '../../store/selectors';

const REGIMENES: RegimenTributario[] = ['NRUS', 'RER', 'RMT', 'RG'];

export default function Contabilidad() {
  const { state, actions } = useErp();
  const { company, regimenTributario } = state;
  const f = calcularFinanzas(state);

  const exportar = (tipo: 'RVIE' | 'RCE') => {
    if (!/^\d{11}$/.test(company.ruc)) return alert('Configura el RUC de la empresa en Ajustes antes de generar el SIRE.');
    const r = tipo === 'RVIE' ? generarRvie(company, state.invoices, f.periodo) : generarRce(company, state.purchases, state.gastos, f.periodo);
    const nombre = nombreSire(company.ruc, f.periodo, tipo === 'RVIE' ? '140400' : '080400', r.registros > 0);
    descargar(nombre.replace(/\.TXT$/, '.zip'), zip([{ nombre, contenido: r.contenido }]));
    alert(`✅ ${tipo} (reemplazo de propuesta SIRE): ${r.registros} comprobante(s) en ${nombre} (comprimido en ZIP para subirlo en SIRE → Reemplazar propuesta).${r.omitidos.length ? `\n\nNo incluidos (${r.omitidos.length}):\n• ${r.omitidos.slice(0, 12).join('\n• ')}` : ''}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-tinta flex items-center gap-2">
            <Building2 className="w-5 h-5 text-bosque-700" /> Configuración del Régimen Tributario SUNAT
          </h3>
          <p className="text-xs text-tinta-suave">Elige el régimen tributario para adaptar automáticamente los libros contables y las tasas impositivas</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {REGIMENES.map(r => (
            <button
              key={r}
              onClick={async () => { const res = await actions.setRegimen(r); if (!res.ok) alert(res.error); }}
              className={`px-3.5 py-2 rounded-2xl font-bold text-xs border transition ${regimenTributario === r ? 'bg-bosque-950 text-oro border-bosque-950' : 'bg-crema text-tinta-suave'}`}
            >
              {r === 'RMT' ? '⭐ ' : ''}{REGIMEN_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-Liquidación Declara Fácil 621 */}
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-bosque-700 text-oro px-3 py-1 rounded-full text-xs font-bold">Pre-Liquidación Mensual {f.periodo} (Formulario Virtual 621 IGV - Renta)</span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Total Impuesto Mensual a Pagar: S/ {f.totalImpuestosMes.toFixed(2)}</h3>
          <p className="text-xs text-bosque-200">{f.usaIgv ? 'Débito Fiscal (IGV Ventas) menos Crédito Fiscal (IGV Compras con Factura) más ' : 'Sin IGV en NRUS. '}Pago a Cuenta de Renta: {f.pagoCuentaRentaDetalle.detalle}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportar('RVIE')} className="px-4 py-2.5 rounded-2xl bg-oro text-tinta font-bold text-xs shadow-md flex items-center gap-1.5"><Download className="w-4 h-4" /> Exportar RVIE (SIRE)</button>
          <button onClick={() => exportar('RCE')} className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 flex items-center gap-1.5"><Download className="w-4 h-4" /> Exportar RCE (SIRE)</button>
        </div>
      </div>
    </div>
  );
}
