import { useState } from 'react';
import { PlusCircle, Printer, ShieldCheck, Undo2, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import { MEDIOS_PAGO, type ComprobanteSunat, type MedioPago } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { AccionesEmision, EstadoEmision, porEmitir } from './Emision';
import { useUi } from '../../store/UiStore';

const TIPO: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito', NV: 'Nota de Venta' };

export default function Comprobantes() {
  const { state } = useErp();
  const { open } = useUi();
  const { invoices, company } = state;
  const [filtro, setFiltro] = useState<'emitir' | 'enviar' | 'todos'>(invoices.some(porEmitir) ? 'emitir' : 'todos');
  const porEnviar = (i: ComprobanteSunat) => !porEmitir(i) && !i.enviadoClienteAt && i.tipoComprobante !== 'NV';
  const lista = invoices.filter(i => (filtro === 'emitir' ? porEmitir(i) : filtro === 'enviar' ? porEnviar(i) : true));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-bosque-700 text-oro px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <ShieldCheck className="w-4 h-4" /> {company.modoEmision === 'DIRECTA' ? 'Emisión directa a SUNAT' : 'Emisión en el portal SUNAT (con modelo del sistema)'}
          </span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Comprobantes de Pago Electrónicos</h3>
          <p className="text-xs text-bosque-200">Cada venta deja listo el modelo de su factura ({company.serieFactura}) o boleta ({company.serieBoleta}): emítelo en SUNAT, anota el número y envíalo al cliente por WhatsApp.</p>
        </div>
        <button
          onClick={() => open({ type: 'pos' })}
          className="px-5 py-2.5 rounded-2xl bg-oro text-tinta font-bold text-xs shadow-md flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> Emitir Comprobante (POS)
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-crema-300 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-serif font-bold text-base text-tinta">Registro de comprobantes</h4>
          <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtrar comprobantes">
            {([['emitir', `Por emitir en SUNAT (${invoices.filter(porEmitir).length})`], ['enviar', `Por enviar al cliente (${invoices.filter(porEnviar).length})`], ['todos', `Todos (${invoices.length})`]] as const).map(([id, t]) => (
              <button key={id} aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`px-3 py-1.5 rounded-full font-bold border ${filtro === id ? 'bg-bosque-950 text-white border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>{t}</button>
            ))}
          </div>
        </div>
        {!lista.length && <p className="text-xs text-tinta-suave">No hay comprobantes en esta lista.</p>}
        <div className="space-y-3 text-xs">
          {lista.map(inv => (
            <div key={inv.id} className="p-4 bg-crema rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-tinta">{inv.numeroSunat ?? inv.id}</span>
                  <EstadoEmision inv={inv} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.tipoComprobante === '07' ? 'bg-error-fondo text-error' : 'bg-bosque-700 text-oro'}`}>{TIPO[inv.tipoComprobante] ?? inv.tipoComprobante}</span>
                  {inv.referencia && <span className="text-[10px] font-mono text-error">modifica {inv.referencia}</span>}
                  <span className="text-[10px] text-tinta-suave">{inv.fechaEmision} {inv.horaEmision}</span>
                </div>
                <p className="font-bold text-tinta text-xs mt-1">{inv.cliente.nombreRazonSocial}{inv.cliente.numDoc ? ` (${inv.cliente.tipoDoc === '6' ? 'RUC' : 'DNI'} ${inv.cliente.numDoc})` : ''}</p>
                <p className="text-[10px] text-tinta-suave">Base Gravada: S/ {inv.opGravadas.toFixed(2)} | IGV (18%): S/ {inv.totalIgv.toFixed(2)}{inv.descuentoTotal ? ` | Descuento: S/ ${inv.descuentoTotal.toFixed(2)}` : ''}</p>
                {!!inv.pagos?.length && <p className="text-[10px] text-tinta-suave">{inv.tipoComprobante === '07' ? 'Reembolso' : 'Pago'}: {inv.pagos.map(p => `${p.medio} S/ ${p.monto.toFixed(2)}`).join(' + ')}</p>}
                {inv.motivo && <p className="text-[10px] text-error">Motivo: {inv.motivo}</p>}
                {inv.numeroSunat && inv.numeroSunat !== inv.id && <p className="text-[10px] text-tinta-suave">Registro interno {inv.id}</p>}
                {inv.tipoComprobante !== 'NV' && <div className="pt-2"><AccionesEmision key={`${inv.id}-${inv.numeroSunat ?? ''}`} inv={inv} /></div>}
              </div>
              <div className="text-right flex md:flex-col justify-between items-end gap-1">
                <span className={`font-serif font-bold text-lg ${inv.tipoComprobante === '07' ? 'text-error' : 'text-tinta'}`}>{inv.tipoComprobante === '07' ? '− ' : ''}S/ {inv.montoTotal.toFixed(2)}</span>
                <button
                  onClick={() => open({ type: 'ticket', invoice: inv })}
                  className="px-3 py-1.5 bg-bosque-950 text-oro rounded-xl font-bold text-[10px] flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Ver Ticket 80mm
                </button>
                {(inv.tipoComprobante === '01' || inv.tipoComprobante === '03') && (
                  <button
                    onClick={() => open({ type: 'devolucion', invoice: inv })}
                    className="px-3 py-1.5 bg-error-fondo text-error rounded-xl font-bold text-[10px] flex items-center gap-1"
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
          <h3 className="font-serif font-bold text-lg text-tinta">Devolución · Nota de Crédito</h3>
          <p className="text-[11px] text-tinta-suave">Sobre {invoice.id} · {invoice.cliente.nombreRazonSocial}. Devuelve el stock al Kardex y registra el reembolso en caja.</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>

      <div className="space-y-2">
        {vendidos.map(it => (
          <div key={it.sku} className="flex items-center gap-3 p-2.5 bg-crema rounded-xl border border-[#eae4dc]">
            <span className="flex-1">
              <span className="font-bold text-tinta block">{it.descripcion}</span>
              <span className="text-[10px] text-tinta-suave">Vendidas {it.cantidad} · por devolver {it.disponible} · S/ {it.precioUnitario.toFixed(2)} c/u</span>
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
          <label className="font-bold block mb-1 text-tinta">Motivo</label>
          <input aria-label="Motivo de la devolución" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: planta llegó dañada" className="w-full p-2.5 bg-crema border rounded-xl font-semibold" />
        </div>
        <div>
          <label className="font-bold block mb-1 text-tinta">Reembolso por</label>
          <select aria-label="Medio de reembolso" value={medio} onChange={e => setMedio(e.target.value as MedioPago)} className="w-full p-2.5 bg-crema border rounded-xl font-semibold">
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={emitir} disabled={enviando || monto <= 0} className="flex-1 py-3 rounded-2xl bg-error text-white font-bold shadow-lg disabled:opacity-50">
          {enviando ? 'Enviando a SUNAT...' : `Emitir Nota de Crédito · S/ ${monto.toFixed(2)}`}
        </button>
      </div>
    </ModalShell>
  );
}
