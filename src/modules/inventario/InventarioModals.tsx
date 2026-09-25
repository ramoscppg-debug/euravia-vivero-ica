import { useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { ModalShell, useDocLookup } from '../../components/shared';
import type { BiologicalLoss } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

// ============================================================
// MODAL: COMPRA MAYORISTA
// ============================================================
export function CompraModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const { busy, consultar } = useDocLookup();
  const { products } = state;

  const [proveedor, setProveedor] = useState('Viveros Mayoristas del Sur SAC');
  const [ruc, setRuc] = useState('20556677884');
  const [numeroFactura, setNumeroFactura] = useState('FC01-0009981');
  const [sku, setSku] = useState(products[0]?.sku ?? '');
  const [qty, setQty] = useState(20);
  const [costoUnitario, setCostoUnitario] = useState(35);

  const [enviando, setEnviando] = useState(false);

  const registrar = async () => {
    setEnviando(true);
    const r = await actions.registrarCompra({ ruc, proveedor, numeroFactura, sku, qty, costoUnitario });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`✅ ¡Ingreso registrado con éxito!\nSe añadieron ${qty} unidades a ${r.productName}.\nCrédito Fiscal generado para SIRE: S/ ${r.igv.toFixed(2)}`);
  };

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <h3 className="font-serif font-bold text-lg text-[#082017]">Registrar Compra Mayorista (Almacén)</h3>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1">RUC Proveedor</label>
            <div className="flex gap-1.5">
              <input type="text" value={ruc} onChange={(e) => setRuc(e.target.value)} className="flex-1 min-w-0 p-2.5 bg-[#faf8f5] border rounded-xl font-mono font-bold" />
              <button type="button" disabled={busy} onClick={() => consultar(ruc, setProveedor)} className="shrink-0 px-3 rounded-xl bg-[#082017] text-[#d4af37] font-bold text-[10px] flex items-center gap-1 disabled:opacity-50">
                <ScanLine className="w-3.5 h-3.5" /> {busy ? '...' : 'Consultar'}
              </button>
            </div>
          </div>
          <div>
            <label className="font-bold block mb-1">N° Factura</label>
            <input type="text" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-mono font-bold" />
          </div>
        </div>
        <div>
          <label className="font-bold block mb-1">Razón Social del Proveedor</label>
          <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
        </div>
        <div>
          <label className="font-bold block mb-1">Especie a Ingresar</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-semibold">
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} (Stock Actual: {p.stock} u.)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1">Cantidad Comprada</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
          </div>
          <div>
            <label className="font-bold block mb-1">Costo Unitario (S/)</label>
            <input type="number" step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(Number(e.target.value))} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={registrar} disabled={enviando} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-60">Registrar e Incrementar Stock</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: BAJA BIOLÓGICA (MERMA/DESMEDRO)
// ============================================================
export function BajaModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const { products } = state;

  const [sku, setSku] = useState(products[0]?.sku ?? '');
  const [type, setType] = useState<BiologicalLoss['type']>('MERMA_NATURAL');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('Deshidratación por calor estacional');
  const [enviando, setEnviando] = useState(false);

  const registrar = async () => {
    setEnviando(true);
    const r = await actions.registrarBaja({ sku, type, qty, reason });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`🥀 Baja biológica / Cuarentena registrada con éxito.\nSKU: ${r.loss.sku} - ${r.loss.productName} (${qty} u.)\nImpacto valorizado: S/ ${r.loss.totalLoss.toFixed(2)}`);
  };

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <h3 className="font-serif font-bold text-lg text-[#082017]">Registrar Baja Biológica / Cuarentena</h3>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Especie Afectada</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-semibold">
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} (Stock: {p.stock} u.)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Tipo de Evento Fitosanitario</label>
            <select value={type} onChange={(e) => setType(e.target.value as BiologicalLoss['type'])} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold">
              <option value="MERMA_NATURAL">🍂 Merma Natural (Deshidratación)</option>
              <option value="DESMEDRO_PLAGA">🐛 Desmedro (Plaga / Inutilizable)</option>
              <option value="CUARENTENA_FITOSANITARIA">🧪 Cuarentena (Aislamiento)</option>
              <option value="ROTURA_MECANICA">💥 Daño Mecánico / Caída</option>
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1 text-[#082017]">Cantidad de Plantas</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
          </div>
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Informe / Causa Detallada</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl" />
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={registrar} disabled={enviando} className="flex-1 py-3 rounded-2xl bg-[#b91c1c] text-white font-bold shadow-lg disabled:opacity-60">Confirmar y Descontar Kardex</button>
      </div>
    </ModalShell>
  );
}
