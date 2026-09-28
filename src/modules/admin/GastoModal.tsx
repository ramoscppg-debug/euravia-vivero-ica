import { useState } from 'react';
import { ScanLine, X } from 'lucide-react';
import { Boton } from '../../components/ui';
import { ModalShell, useDocLookup } from '../../components/shared';
import type { Gasto } from '../../domain/types';
import { CATEGORIAS_GASTO } from '../../lib/contabilidad';
import { hoyLocal } from '../../lib/fechas';
import { round2 } from '../../lib/peru';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const TIPOS: [Gasto['tipoComprobante'], string][] = [['01', 'Factura (con IGV)'], ['14', 'Recibo de servicios públicos: luz, agua, teléfono (con IGV)'], ['03', 'Boleta'], ['12', 'Ticket'], ['00', 'Sin comprobante']];
const MEDIOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];

/** Gasto con comprobante: queda en el libro de egresos y genera su asiento PCGE (6x + 40111 a 4212; pago 4212 a caja/bancos). */
export function GastoModal() {
  const { actions } = useErp();
  const { close } = useUi();
  const { busy, consultar } = useDocLookup();
  const [f, setF] = useState({
    fecha: hoyLocal(), cuenta: '6361', descripcion: '', tipoComprobante: '01' as Gasto['tipoComprobante'], proveedorRuc: '', proveedor: '',
    serie: '', numero: '', total: '', igv: '', igvManual: false, medioPago: 'Transferencia', operacion: '', porPagar: false
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (c: Partial<typeof f>) => setF(prev => ({ ...prev, ...c }));
  const total = Number(f.total) || 0;
  const factura = f.tipoComprobante === '01' || f.tipoComprobante === '14'; // dan crédito fiscal
  const igv = factura ? (f.igvManual ? Number(f.igv) || 0 : round2(total - total / 1.18)) : 0;
  const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const r = await actions.registrarGasto({
      fecha: f.fecha, cuenta: f.cuenta, descripcion: f.descripcion || (CATEGORIAS_GASTO.find(c => c.cuenta === f.cuenta)?.nombre ?? ''),
      tipoComprobante: f.tipoComprobante, proveedorRuc: f.proveedorRuc || undefined, proveedor: f.proveedor || undefined,
      serie: f.serie || undefined, numero: f.numero || undefined, total, igv,
      medioPago: f.porPagar ? undefined : f.medioPago, operacion: f.porPagar || f.medioPago === 'Efectivo' ? undefined : f.operacion || undefined
    });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    close();
  };

  return (
    <ModalShell size="max-w-2xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar text-sm">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">Registrar gasto</h3>
          <p className="text-[11px] text-tinta-suave">Luz, agua, alquiler, contador, fletes… Queda en el libro de egresos y en el libro diario (PCGE 2026).</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold">Categoría
          <select aria-label="Categoría del gasto" value={f.cuenta} onChange={e => set({ cuenta: e.target.value })} className={`${campo} mt-1`}>
            {CATEGORIAS_GASTO.map(c => <option key={c.cuenta} value={c.cuenta}>{c.nombre} · {c.cuenta}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">Fecha<input type="date" aria-label="Fecha del gasto" value={f.fecha} onChange={e => set({ fecha: e.target.value })} className={`${campo} mt-1`} /></label>
        <label className="block text-xs font-bold sm:col-span-2">Descripción<input aria-label="Descripción del gasto" value={f.descripcion} onChange={e => set({ descripcion: e.target.value })} maxLength={200} placeholder="Ej.: Recibo de luz de setiembre" className={`${campo} mt-1`} /></label>
        <label className="block text-xs font-bold">Comprobante
          <select aria-label="Tipo de comprobante del gasto" value={f.tipoComprobante} onChange={e => set({ tipoComprobante: e.target.value as Gasto['tipoComprobante'] })} className={`${campo} mt-1`}>
            {TIPOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <label className="block text-xs font-bold">Serie<input aria-label="Serie del comprobante del gasto" value={f.serie} onChange={e => set({ serie: e.target.value.toUpperCase().slice(0, 4) })} className={`${campo} mt-1 font-mono`} /></label>
          <label className="block text-xs font-bold">Número<input aria-label="Número del comprobante del gasto" value={f.numero} onChange={e => set({ numero: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} className={`${campo} mt-1 font-mono`} /></label>
        </div>
        <label className="block text-xs font-bold">RUC del proveedor{factura ? ' *' : ''}
          <span className="flex gap-1.5 mt-1">
            <input aria-label="RUC del proveedor del gasto" inputMode="numeric" value={f.proveedorRuc} onChange={e => set({ proveedorRuc: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={`${campo} font-mono`} />
            <button type="button" disabled={busy} onClick={() => consultar(f.proveedorRuc, n => set({ proveedor: n }))} className="shrink-0 px-3 rounded-control bg-bosque-950 text-oro text-[10px] font-bold disabled:opacity-50"><ScanLine className="w-3.5 h-3.5" /></button>
          </span>
        </label>
        <label className="block text-xs font-bold">Proveedor<input aria-label="Nombre del proveedor del gasto" value={f.proveedor} onChange={e => set({ proveedor: e.target.value })} maxLength={150} className={`${campo} mt-1`} /></label>
        <label className="block text-xs font-bold">Total pagado (S/)<input aria-label="Total del gasto" type="number" min={0} step="0.01" value={f.total} onChange={e => set({ total: e.target.value })} className={`${campo} mt-1`} /></label>
        {factura && (
          <label className="block text-xs font-bold">IGV (crédito fiscal)
            <input aria-label="IGV del gasto" type="number" min={0} step="0.01" value={f.igvManual ? f.igv : igv.toFixed(2)} onChange={e => set({ igv: e.target.value, igvManual: true })} className={`${campo} mt-1`} />
            <span className="block font-normal text-[11px] text-tinta-suave">Calculado 18% del total; cámbialo si la factura dice otro monto.</span>
          </label>
        )}
      </div>

      <fieldset className="p-3 rounded-2xl bg-crema space-y-2">
        <legend className="text-xs font-bold px-1">Pago</legend>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={f.porPagar} onChange={e => set({ porPagar: e.target.checked })} /> Aún por pagar (queda en cuentas por pagar 4212)</label>
        {!f.porPagar && (
          <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label="Medio de pago del gasto" value={f.medioPago} onChange={e => set({ medioPago: e.target.value })} className={campo}>
              {MEDIOS.map(m => <option key={m} value={m}>{m === 'Efectivo' ? 'Efectivo de caja' : m}</option>)}
            </select>
            {f.medioPago !== 'Efectivo' && <input aria-label="N° de operación del pago del gasto" value={f.operacion} onChange={e => set({ operacion: e.target.value })} placeholder="N° de operación" className={campo} />}
          </div>
        )}
      </fieldset>

      <p className="text-xs text-tinta-suave">Asiento: <b>{f.cuenta}</b> {round2(total - igv).toFixed(2)}{igv ? <> + <b>40111</b> {igv.toFixed(2)}</> : null} a <b>4212</b> {total.toFixed(2)}{!f.porPagar && <> · pago <b>4212</b> a <b>{f.medioPago === 'Efectivo' ? '101' : '1041'}</b></>}</p>
      {error && <p role="alert" className="p-3 rounded-control bg-error-fondo text-error font-bold">{error}</p>}
      <div className="flex gap-2 pt-2 border-t border-crema-300">
        <Boton variante="secundario" className="flex-1" onClick={close}>Cancelar</Boton>
        <Boton className="flex-1" cargando={guardando} onClick={() => void guardar()}>Registrar gasto</Boton>
      </div>
    </ModalShell>
  );
}
