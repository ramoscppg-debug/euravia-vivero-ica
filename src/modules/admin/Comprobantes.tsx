import { useState } from 'react';
import { PlusCircle, Printer, ShieldCheck, Undo2, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import { MEDIOS_PAGO, type ComprobanteSunat, type MedioPago } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito', NV: 'Nota de Venta' };

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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.tipoComprobante === '07' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#134e2e] text-[#d4af37]'}`}>{TIPO[inv.tipoComprobante] ?? inv.tipoComprobante}</span>
                  {inv.referencia && <span className="text-[10px] font-mono text-[#b91c1c]">modifica {inv.referencia}</span>}
                  <span className="text-[10px] text-[#8fa89b]">{inv.fechaEmision} {inv.horaEmision}</span>
                </div>
                <p className="font-bold text-[#082017] text-xs mt-1">{inv.cliente.nombreRazonSocial}{inv.cliente.numDoc ? ` (${inv.cliente.tipoDoc === '6' ? 'RUC' : 'DNI'} ${inv.cliente.numDoc})` : ''}</p>
                <p className="text-[10px] text-[#5c7367]">Base Gravada: S/ {inv.opGravadas.toFixed(2)} | IGV (18%): S/ {inv.totalIgv.toFixed(2)}{inv.descuentoTotal ? ` | Descuento: S/ ${inv.descuentoTotal.toFixed(2)}` : ''}</p>
                {!!inv.pagos?.length && <p className="text-[10px] text-[#5c7367]">{inv.tipoComprobante === '07' ? 'Reembolso' : 'Pago'}: {inv.pagos.map(p => `${p.medio} S/ ${p.monto.toFixed(2)}`).join(' + ')}</p>}
                {inv.motivo && <p className="text-[10px] text-[#b91c1c]">Motivo: {inv.motivo}</p>}
              </div>
              <div className="text-right flex md:flex-col justify-between items-end gap-1">
                <span className={`font-serif font-bold text-lg ${inv.tipoComprobante === '07' ? 'text-[#b91c1c]' : 'text-[#082017]'}`}>{inv.tipoComprobante === '07' ? '− ' : ''}S/ {inv.montoTotal.toFixed(2)}</span>
                <button
                  onClick={() => open({ type: 'ticket', invoice: inv })}
                  className="px-3 py-1.5 bg-[#082017] text-[#d4af37] rounded-xl font-bold text-[10px] flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Ver Ticket 80mm
                </button>
                {(inv.tipoComprobante === '01' || inv.tipoComprobante === '03') && (
                  <button
                    onClick={() => open({ type: 'devolucion', invoice: inv })}
                    className="px-3 py-1.5 bg-[#fee2e2] text-[#b91c1c] rounded-xl font-bold text-[10px] flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Devolución
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

// ============================================================
// MODAL: DEVOLUCIÓN (NOTA DE CRÉDITO)
// ============================================================
export function DevolucionModal({ invoice }: { invoice: ComprobanteSunat }) {
  const { actions } = useErp();
  const { open, close } = useUi();
  const devuelto = actions.devueltoDe(invoice.id);
  const vendidos = invoice.items.map(it => ({ ...it, disponible: it.cantidad - (devuelto.get(it.sku) ?? 0) }));

  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState('');
  const [medio, setMedio] = useState<MedioPago>((invoice.pagos?.[0]?.medio as MedioPago) ?? 'Efectivo');
  const [enviando, setEnviando] = useState(false);

  const monto = vendidos.reduce((a, it) => a + (cantidades[it.sku] ?? 0) * it.precioUnitario, 0);

  const emitir = async () => {
    setEnviando(true);
    const r = await actions.registrarDevolucion({
      invoiceId: invoice.id,
      items: vendidos.map(it => ({ sku: it.sku, qty: cantidades[it.sku] ?? 0 })),
      motivo,
      medioReembolso: medio
    });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice });
  };

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">Devolución · Nota de Crédito</h3>
          <p className="text-[11px] text-[#5c7367]">Sobre {invoice.id} · {invoice.cliente.nombreRazonSocial}. Devuelve el stock al Kardex y registra el reembolso en caja.</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="space-y-2">
        {vendidos.map(it => (
          <div key={it.sku} className="flex items-center gap-3 p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]">
            <span className="flex-1">
              <span className="font-bold text-[#082017] block">{it.descripcion}</span>
              <span className="text-[10px] text-[#8fa89b]">Vendidas {it.cantidad} · por devolver {it.disponible} · S/ {it.precioUnitario.toFixed(2)} c/u</span>
            </span>
            <input
              aria-label={`Devolver ${it.sku}`}
              type="number"
              min={0}
              max={it.disponible}
              disabled={it.disponible <= 0}
              value={cantidades[it.sku] ?? 0}
              onChange={e => setCantidades({ ...cantidades, [it.sku]: Math.min(it.disponible, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
              className="w-16 p-1.5 bg-white border rounded-lg text-center font-bold disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Motivo</label>
          <input aria-label="Motivo de la devolución" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: planta llegó dañada" className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-semibold" />
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Reembolso por</label>
          <select aria-label="Medio de reembolso" value={medio} onChange={e => setMedio(e.target.value as MedioPago)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-semibold">
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={emitir} disabled={enviando || monto <= 0} className="flex-1 py-3 rounded-2xl bg-[#b91c1c] text-white font-bold shadow-lg disabled:opacity-50">
          {enviando ? 'Enviando a SUNAT...' : `Emitir Nota de Crédito · S/ ${monto.toFixed(2)}`}
        </button>
      </div>
    </ModalShell>
  );
}
