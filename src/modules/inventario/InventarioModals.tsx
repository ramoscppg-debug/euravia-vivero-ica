import { useState } from 'react';
import { ScanLine, Trash2, X } from 'lucide-react';
import { ModalShell, useDocLookup } from '../../components/shared';
import type { BiologicalLoss } from '../../domain/types';
import { round2 } from '../../lib/peru';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

// ============================================================
// MODAL: COMPRA A PROVEEDOR (una factura, varios productos)
// ============================================================
interface LineaCompra { sku: string; qty: number; costoUnitario: number }

export function CompraModal({ presetSku }: { presetSku?: string }) {
  const { state, actions, nube } = useErp();
  const { close } = useUi();
  const { busy, consultar } = useDocLookup();
  const { products } = state;
  // En la nube el formulario empieza vacío (nada de proveedores de ejemplo); el demo trae datos para probar
  const inicial = products.find(p => p.sku === presetSku) ?? products[0];

  const [proveedor, setProveedor] = useState(nube ? '' : 'Viveros Mayoristas del Sur SAC');
  const [ruc, setRuc] = useState(nube ? '' : '20556677884');
  const [numeroFactura, setNumeroFactura] = useState(nube ? '' : 'FC01-0009981');
  const [lineas, setLineas] = useState<LineaCompra[]>(inicial ? [{ sku: inicial.sku, qty: nube ? 1 : 20, costoUnitario: nube ? inicial.cost : 35 }] : []);
  const [enviando, setEnviando] = useState(false);

  const gravada = round2(lineas.reduce((a, l) => a + l.qty * l.costoUnitario, 0));
  const igv = round2(gravada * 0.18);
  const cambiar = (i: number, c: Partial<LineaCompra>) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const agregarLinea = () => {
    const libre = products.find(p => !lineas.some(l => l.sku === p.sku));
    if (libre) setLineas(ls => [...ls, { sku: libre.sku, qty: 1, costoUnitario: libre.cost }]);
  };

  const registrar = async () => {
    setEnviando(true);
    const r = await actions.registrarCompra({ ruc, proveedor, numeroFactura, items: lineas });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`✅ ¡Ingreso registrado con éxito!\nSe añadieron ${r.unidades} unidades (${r.productName}).\nCrédito Fiscal generado para SIRE: S/ ${r.igv.toFixed(2)}`);
  };

  const input = 'w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold';
  return (
    <ModalShell size="max-w-3xl" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">Registrar compra a proveedor</h3>
          <p className="text-[11px] text-tinta-suave">Una factura puede traer varios productos: cada línea suma stock en el Kardex con su costo.</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="font-bold block mb-1">RUC Proveedor</label>
          <div className="flex gap-1.5">
            <input type="text" inputMode="numeric" aria-label="RUC del proveedor" value={ruc} onChange={(e) => setRuc(e.target.value.trim())} placeholder="11 dígitos" className={`${input} flex-1 min-w-0 font-mono`} />
            <button type="button" disabled={busy} onClick={() => consultar(ruc, setProveedor)} className="shrink-0 px-3 rounded-xl bg-bosque-950 text-oro font-bold text-[10px] flex items-center gap-1 disabled:opacity-50">
              <ScanLine className="w-3.5 h-3.5" /> {busy ? '...' : 'Consultar'}
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold block mb-1">Razón Social del Proveedor</label>
          <input type="text" aria-label="Razón social del proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={input} />
        </div>
        <div>
          <label className="font-bold block mb-1">N° Factura</label>
          <input type="text" aria-label="Número de factura" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value.toUpperCase())} placeholder="F001-000123" className={`${input} font-mono`} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_90px_110px_100px_36px] gap-2 text-[10px] uppercase font-bold text-tinta-suave px-1"><span>Producto</span><span>Cantidad</span><span>Costo unit. (sin IGV)</span><span className="text-right">Subtotal</span><span /></div>
        {lineas.map((l, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_110px_100px_36px] gap-2 items-center">
            <select aria-label={`Producto de la línea ${i + 1}`} value={l.sku} onChange={e => { const pr = products.find(x => x.sku === e.target.value); cambiar(i, { sku: e.target.value, costoUnitario: pr?.cost || l.costoUnitario }); }} className={`${input} col-span-2 sm:col-span-1 font-semibold`}>
              {products.map(p => <option key={p.sku} value={p.sku} disabled={p.sku !== l.sku && lineas.some(x => x.sku === p.sku)}>{p.name} (stock {p.stock})</option>)}
            </select>
            <input type="number" min={1} aria-label={`Cantidad de la línea ${i + 1}`} value={l.qty || ''} onChange={e => cambiar(i, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={input} />
            <input type="number" min={0} step="0.01" aria-label={`Costo unitario de la línea ${i + 1}`} value={l.costoUnitario || ''} onChange={e => cambiar(i, { costoUnitario: Number(e.target.value) || 0 })} className={input} />
            <span className="text-right font-bold">S/ {(l.qty * l.costoUnitario).toFixed(2)}</span>
            <button onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} aria-label={`Quitar la línea ${i + 1}`} className="p-2 rounded-xl bg-error-fondo text-error justify-self-end"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button onClick={agregarLinea} disabled={lineas.length >= products.length} className="text-xs font-bold text-bosque-700 hover:underline disabled:opacity-40">+ Agregar otro producto</button>
      </div>

      <div className="flex justify-end">
        <dl className="w-56 text-xs space-y-1">
          <div className="flex justify-between"><dt>Valor de compra</dt><dd className="font-bold">S/ {gravada.toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt>IGV 18% (crédito fiscal)</dt><dd className="font-bold">S/ {igv.toFixed(2)}</dd></div>
          <div className="flex justify-between text-sm border-t border-crema-300 pt-1"><dt className="font-bold">Total factura</dt><dd className="font-extrabold">S/ {(gravada + igv).toFixed(2)}</dd></div>
        </dl>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={registrar} disabled={enviando || !lineas.length} className="flex-1 py-3 rounded-2xl bg-bosque-950 text-oro font-bold shadow-lg disabled:opacity-60">Registrar e Incrementar Stock</button>
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
        <h3 className="font-serif font-bold text-lg text-tinta">Registrar Baja Biológica / Cuarentena</h3>
        <button onClick={close}><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1 text-tinta">Especie Afectada</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-semibold">
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} (Stock: {p.stock} u.)</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1 text-tinta">Tipo de Evento Fitosanitario</label>
            <select value={type} onChange={(e) => setType(e.target.value as BiologicalLoss['type'])} className="w-full p-2.5 bg-crema border rounded-xl font-bold">
              <option value="MERMA_NATURAL">🍂 Merma Natural (Deshidratación)</option>
              <option value="DESMEDRO_PLAGA">🐛 Desmedro (Plaga / Inutilizable)</option>
              <option value="CUARENTENA_FITOSANITARIA">🧪 Cuarentena (Aislamiento)</option>
              <option value="ROTURA_MECANICA">💥 Daño Mecánico / Caída</option>
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1 text-tinta">Cantidad de Plantas</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full p-2.5 bg-crema border rounded-xl font-bold" />
          </div>
        </div>
        <div>
          <label className="font-bold block mb-1 text-tinta">Informe / Causa Detallada</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl" />
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={registrar} disabled={enviando} className="flex-1 py-3 rounded-2xl bg-error text-white font-bold shadow-lg disabled:opacity-60">Confirmar y Descontar Kardex</button>
      </div>
    </ModalShell>
  );
}
