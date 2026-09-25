import { PlusCircle, Printer, ShieldCheck } from 'lucide-react';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Comprobantes() {
  const { state } = useErp();
  const { open } = useUi();
  const { invoices, company } = state;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <ShieldCheck className="w-4 h-4" /> Sistema de Emisión Electrónica SUNAT (SEE UBL 2.1)
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Comprobantes de Pago Electrónicos</h3>
          <p className="text-xs text-[#c2d4cb]">Emisión directa de Facturas ({company.serieFactura}), Boletas ({company.serieBoleta}), firma XML y código QR oficial.</p>
        </div>
        <button
          onClick={() => open({ type: 'pos' })}
          className="px-5 py-2.5 rounded-2xl bg-[#d4af37] text-[#082017] font-bold text-xs shadow-md flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> Emitir Comprobante (POS)
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#e8e2d8] shadow-sm p-6 space-y-4">
        <h4 className="font-serif font-bold text-base text-[#082017]">Registro de Comprobantes Emitidos</h4>
        <div className="space-y-3 text-xs">
          {invoices.map(inv => (
            <div key={inv.id} className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#082017]">{inv.id}</span>
                  <span className="bg-[#134e2e] text-[#d4af37] text-[10px] font-bold px-2 py-0.5 rounded-full">{inv.tipoComprobante === '01' ? 'Factura' : 'Boleta'}</span>
                  <span className="text-[10px] text-[#8fa89b]">{inv.fechaEmision} {inv.horaEmision}</span>
                </div>
                <p className="font-bold text-[#082017] text-xs mt-1">{inv.cliente.nombreRazonSocial} ({inv.cliente.tipoDoc === '6' ? 'RUC' : 'DNI'} {inv.cliente.numDoc})</p>
                <p className="text-[10px] text-[#5c7367]">Base Gravada: S/ {inv.opGravadas.toFixed(2)} | IGV (18%): S/ {inv.totalIgv.toFixed(2)}</p>
              </div>
              <div className="text-right flex md:flex-col justify-between items-end gap-1">
                <span className="font-serif font-bold text-lg text-[#082017]">S/ {inv.montoTotal.toFixed(2)}</span>
                <button
                  onClick={() => open({ type: 'ticket', invoice: inv })}
                  className="px-3 py-1.5 bg-[#082017] text-[#d4af37] rounded-xl font-bold text-[10px] flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Ver Ticket 80mm
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
