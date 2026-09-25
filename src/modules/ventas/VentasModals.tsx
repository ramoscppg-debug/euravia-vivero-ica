import { useState } from 'react';
import { Printer, QrCode, ScanLine, Truck, X } from 'lucide-react';
import { ModalShell, useDocLookup, useScanner } from '../../components/shared';
import type { ComprobanteSunat } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

// ============================================================
// MODAL: POS VENTA RÁPIDA
// ============================================================
export function PosModal({ presetSku }: { presetSku?: string }) {
  const { state, actions } = useErp();
  const { open, close } = useUi();
  const { busy, consultar } = useDocLookup();
  const { products, company } = state;

  const [sku, setSku] = useState(presetSku ?? products[0]?.sku ?? '');
  const [qty, setQty] = useState(1);
  const [tipo, setTipo] = useState<'01' | '03' | 'NV'>('03');
  const [doc, setDoc] = useState('47891234');
  const [clientName, setClientName] = useState('Valeria Benavides');
  const [payment, setPayment] = useState('Efectivo');
  const [generarGre, setGenerarGre] = useState(false);
  const [sending, setSending] = useState(false);

  const emitir = async () => {
    setSending(true);
    const r = await actions.registrarVenta({ sku, qty, tipoComprobante: tipo, docIdentidad: doc, clientName, payment, generarGre });
    setSending(false);
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
          <h3 className="font-serif font-bold text-lg text-[#082017]">Emitir Venta & CPE SUNAT (POS)</h3>
          <p className="text-[11px] text-[#5c7367]">Descuenta stock de Kardex, suma a caja y genera comprobante UBL 2.1</p>
        </div>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Especie Botánica o Producto</label>
            <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold text-xs">
              {products.map(p => <option key={p.sku} value={p.sku}>{p.name} — S/ {p.price.toFixed(2)} (Stock: {p.stock} u.)</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Cantidad</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Tipo de Comprobante</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as '01' | '03')} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs">
              <option value="03">📄 Boleta ({company.serieBoleta} - DNI)</option>
              <option value="01">🏢 Factura ({company.serieFactura} - RUC)</option>
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Medio de Pago</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold text-xs">
              <option value="Efectivo">💵 Efectivo (Gaveta)</option>
              <option value="Yape">📱 Yape / Plin</option>
              <option value="Tarjeta">💳 Tarjeta POS</option>
              <option value="Transferencia">🏦 Transferencia BCP</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1 text-[#082017]">{tipo === '01' ? 'RUC Cliente' : 'DNI Cliente'}</label>
            <div className="flex gap-1.5">
              <input type="text" value={doc} onChange={(e) => setDoc(e.target.value)} className="flex-1 min-w-0 p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono font-bold text-xs" />
              <button type="button" disabled={busy} onClick={() => consultar(doc, setClientName)} className="shrink-0 px-2.5 rounded-xl bg-[#082017] text-[#d4af37] font-bold text-[10px] flex items-center gap-1 disabled:opacity-50" title="Validar y consultar en SUNAT / RENIEC">
                <ScanLine className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Nombre / Razón Social</label>
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs" />
          </div>
        </div>

        <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#eae4dc] flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={generarGre}
              onChange={(e) => setGenerarGre(e.target.checked)}
              className="rounded text-[#082017] focus:ring-0"
            />
            <span className="font-semibold text-[#082017]">Generar Guía de Remisión (GRE {company.serieGre}) para Delivery</span>
          </label>
          <Truck className="w-4 h-4 text-[#8fa89b]" />
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-[#f0eae1]">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={emitir} disabled={sending} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-60">
          {sending ? 'Enviando a SUNAT...' : 'Emitir Comprobante SUNAT'}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: TICKET TÉRMICO 80MM
// ============================================================
export function TicketModal({ invoice }: { invoice: ComprobanteSunat }) {
  const { state } = useErp();
  const { close } = useUi();
  const { company } = state;
  return (
    <ModalShell size="max-w-sm" padding="p-6" overlay="bg-[#082017]/80" className="space-y-4 font-mono text-center">
      <div className="flex justify-between items-center pb-2 border-b">
        <span className="text-[10px] font-bold text-[#8fa89b]">COMPROBANTE ELECTRÓNICO</span>
        <button onClick={close}><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-[#082017]">{company.razonSocial}</h2>
        <p className="text-[10px]">RUC: {company.ruc}</p>
        <p className="text-[9px] text-gray-500">{company.direccion}</p>
      </div>
      <div className="border-t border-b border-dashed py-2 text-left space-y-1">
        <p className="font-bold text-center text-sm">{invoice.tipoComprobante === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}</p>
        <p className="text-center font-bold">{invoice.id}</p>
        <p className="text-[10px]">Cliente: {invoice.cliente.nombreRazonSocial}</p>
        <p className="text-[10px]">Total: S/ {invoice.montoTotal.toFixed(2)}</p>
      </div>
      <button onClick={() => { window.print(); close(); }} className="w-full py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold">
        Imprimir Ticket
      </button>
    </ModalShell>
  );
}

// ============================================================
// MODAL: GENERADOR DE ETIQUETAS QR BOTÁNICAS
// ============================================================
export function QrModal({ presetSku }: { presetSku: string }) {
  const { state } = useErp();
  const { close } = useUi();
  const scan = useScanner();
  const { products, company } = state;
  const [sku, setSku] = useState(presetSku);
  const [size, setSize] = useState<'50x30' | '70x40' | 'A4_SHEET'>('50x30');
  const [qty, setQty] = useState(1);
  const currentProd = products.find(p => p.sku === sku) || products[0];

  return (
    <ModalShell size="max-w-xl" padding="p-6" overlay="bg-[#082017]/80" className="space-y-5">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#134e2e]" />
          <h3 className="font-serif font-bold text-lg text-[#082017]">Generador de Etiquetas & QR Botánico</h3>
        </div>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Seleccionar Planta</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs">
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}
          </select>
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Formato de Etiqueta</label>
          <select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className="w-full p-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold text-xs">
            <option value="50x30">🏷️ 50x30 mm (Maceta estándar)</option>
            <option value="70x40">🌿 70x40 mm (Estaca grande)</option>
            <option value="A4_SHEET">📄 Pliego A4 (24 stickers)</option>
          </select>
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Cantidad</label>
          <input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-bold text-xs" />
        </div>
      </div>

      {/* Vista Previa */}
      <div className="p-4 bg-[#faf8f5] border-2 border-dashed border-[#d4af37]/60 rounded-3xl flex items-center justify-center">
        <div className="w-[320px] bg-white border-2 border-[#082017] p-3.5 rounded-2xl shadow-md space-y-2 text-[#082017]">
          <div className="flex items-center justify-between border-b border-[#082017] pb-1">
            <span className="font-serif font-bold text-[11px] uppercase tracking-wider">{company.nombreComercial.split(' - ')[0]}</span>
            <span className="font-mono text-[9px] font-bold bg-[#082017] text-[#d4af37] px-1.5 py-0.5 rounded">{currentProd.sku}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-[#082017] rounded-xl flex flex-col items-center justify-center shrink-0">
              <QrCode className="w-14 h-14 text-[#082017]" />
              <span className="text-[7px] font-mono font-bold">ESCANEAR POS</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-serif font-bold text-sm truncate">{currentProd.name}</h4>
              <p className="text-[9px] text-[#8c6239] italic font-serif truncate">{currentProd.scientificName}</p>
              <p className="text-[8px] text-[#5c7367]">{currentProd.careLight} • {currentProd.careWater}</p>
            </div>
          </div>
          <div className="pt-1 border-t border-dashed flex justify-between items-center text-xs">
            <span className="font-mono text-[8px] text-gray-500 font-bold">{currentProd.location}</span>
            <span className="font-serif font-bold text-sm text-[#082017]">S/ {currentProd.price.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button onClick={() => scan(sku)} className="flex-1 py-3 rounded-2xl bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] font-bold text-xs flex items-center justify-center gap-1.5">
          <ScanLine className="w-4 h-4 text-[#134e2e]" /> Simular Escaneo en Caja
        </button>
        <button onClick={() => { window.print(); alert(`✅ Imprimiendo ${qty} etiqueta(s) térmica(s) (${size})`); }} className="flex-1 py-3 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg">
          <Printer className="w-4 h-4" /> Imprimir Etiqueta(s)
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: REGISTRAR GASTO MENOR CAJA CHICA
// ============================================================
export function EgresoModal() {
  const { actions } = useErp();
  const { close } = useUi();
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState(15);

  const registrar = () => {
    const r = actions.registrarEgreso(motivo, monto);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`💵 Egreso de S/ ${monto.toFixed(2)} registrado en caja chica.`);
  };

  return (
    <ModalShell size="max-w-sm" padding="p-6">
      <div className="flex justify-between items-center pb-2 border-b">
        <h3 className="font-serif font-bold text-base text-[#082017]">Vale de Egreso - Caja Chica</h3>
        <button onClick={close}><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1">Motivo / Concepto del Gasto</label>
          <input type="text" placeholder="Ej: Pasajes chofer, compra de bolsas..." value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-semibold" />
        </div>
        <div>
          <label className="font-bold block mb-1">Monto en Efectivo (S/)</label>
          <input type="number" step="0.50" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-bold font-mono" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-2 rounded-xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={registrar} className="flex-1 py-2 rounded-xl bg-[#082017] text-[#d4af37] font-bold">Registrar Egreso</button>
      </div>
    </ModalShell>
  );
}
