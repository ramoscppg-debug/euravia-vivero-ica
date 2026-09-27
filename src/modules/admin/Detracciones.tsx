import { Landmark } from 'lucide-react';
import { useErp } from '../../store/ErpStore';

export default function Detracciones() {
  const { state, actions } = useErp();
  const { company, detracciones } = state;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-oro text-tinta px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Landmark className="w-4 h-4" /> Sistema de Detracciones SPOT (SUNAT & Banco de la Nación)
          </span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Cuenta de Detracciones BN: {company.cuentaDetraccionesBn}</h3>
          <p className="text-xs text-bosque-200">Control de facturas de servicios de paisajismo e instalación &gt; S/ 700 sujetas a la tasa del {Math.round(company.tasaDetraccionServicios * 100)}% (Anexo 3, cód. 037).</p>
        </div>
      </div>

      {/* Lista de Detracciones */}
      <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4">
        <h4 className="font-serif font-bold text-base text-tinta">Estado de Depósitos en Cuenta de Detracciones</h4>
        <div className="space-y-3 text-xs">
          {detracciones.map(det => (
            <div key={det.id} className="p-4 bg-crema rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-tinta">{det.facturaId}</span>
                  <span className="font-bold text-tinta">{det.cliente}</span>
                  <span className="text-[10px] text-tinta-suave font-mono">RUC {det.rucCliente}</span>
                </div>
                <p className="text-[11px] text-tinta-suave mt-1">
                  Total Factura: S/ {det.montoFactura.toFixed(2)} | Detracción ({Math.round(det.tasa * 100)}%): <strong className="text-tinta">S/ {det.montoDetraccion.toFixed(2)}</strong>
                </p>
                <p className="text-[10px] text-tinta-suave mt-0.5">
                  Fecha Límite Pago BN: <strong className="text-[#e05780]">{det.fechaVencimientoBn}</strong> {det.constanciaBn ? `• Constancia: ${det.constanciaBn}` : ''}
                </p>
              </div>

              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold inline-block ${det.estado === 'DEPOSITADO' ? 'bg-exito-fondo text-bosque-700' : 'bg-error-fondo text-error'}`}>
                  {det.estado === 'DEPOSITADO' ? '✅ Depositado en BN' : '⚠️ Pendiente de Pago'}
                </span>
                {det.estado === 'PENDIENTE' && (
                  <button
                    onClick={async () => {
                      const r = await actions.registrarConstanciaDetraccion(det.id);
                      if (!r.ok) {
                        alert(r.error);
                        return;
                      }
                      alert(`✅ Constancia de depósito de detracción registrada en Banco de la Nación para la factura ${det.facturaId}.`);
                    }}
                    className="block mt-1.5 px-3 py-1 bg-bosque-950 text-oro rounded-xl font-bold text-[10px] ml-auto"
                  >
                    Registrar Constancia BN
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
