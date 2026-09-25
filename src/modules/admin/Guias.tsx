import { useState } from 'react';
import { Check, PlusCircle, Printer, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Guias() {
  const { state } = useErp();
  const { open } = useUi();
  const { company } = state;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017]">Guías de Remisión Electrónica (GRE Remitente {company.serieGre})</h3>
          <p className="text-xs text-[#5c7367]">Documento de sustento de traslado de plantas y macetas en camioneta o servicio de reparto</p>
        </div>
        <button onClick={() => open({ type: 'gre' })} className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md">
          <PlusCircle className="w-4 h-4" /> Generar Nueva Guía GRE
        </button>
      </div>

      <div className="space-y-4">
        {state.guiasRemision.map(gre => (
          <div key={gre.id} className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-base text-[#082017]">{gre.id}</span>
                <span className="bg-[#134e2e] text-[#d4af37] font-bold text-[10px] px-2.5 py-0.5 rounded-full">GRE Remitente</span>
              </div>
              <span className="text-xs text-[#134e2e] font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> QR SUNAT Activo</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Punto de Partida</span>
                <p className="font-semibold text-[#082017]">{gre.puntoPartida.direccion}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Punto de Llegada (Destinatario)</span>
                <p className="font-semibold text-[#082017]">{gre.puntoLlegada.direccion}</p>
                <p className="text-[11px] text-[#5c7367]">{gre.destinatario.nombreRazonSocial} ({gre.destinatario.tipoDoc === '6' ? 'RUC' : 'DNI'} {gre.destinatario.numDoc})</p>
              </div>
              <div>
                <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Vehículo & Chofer</span>
                <p className="font-semibold text-[#082017]">Placa: {gre.datosEnvio?.placaVehiculo || 'BZF-412'}</p>
                <p className="text-[11px] text-[#5c7367]">{gre.datosEnvio?.conductorNombre || 'Raúl Morales'} (DNI {gre.datosEnvio?.conductorDni || '71234567'})</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[#5c7367]">Bultos: {(gre.items || []).map(it => `${it.cantidad}x ${it.descripcion}`).join(', ')} | Peso: {gre.datosEnvio?.pesoBrutoTotal || 25} kg</span>
              <button onClick={() => alert(`Imprimiendo Guía de Remisión ${gre.id} con Código QR para control en ruta`)} className="px-3 py-1.5 bg-[#082017] text-[#d4af37] rounded-xl font-bold text-[10px] flex items-center gap-1">
                <Printer className="w-3 h-3" /> Imprimir GRE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MODAL: GUÍA DE REMISIÓN ELECTRÓNICA GRE
// ============================================================
export function GreModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const { company, products } = state;

  const [destinatario, setDestinatario] = useState('Valeria Benavides');
  const [docDestinatario, setDocDestinatario] = useState('47891234');
  const [placa, setPlaca] = useState('BZF-412');
  const [direccionLlegada, setDireccionLlegada] = useState('Calle Las Orquídeas 340, Miraflores');
  const [sku, setSku] = useState(products[0]?.sku ?? '');
  const [qty, setQty] = useState(1);
  const [sending, setSending] = useState(false);

  const emitir = async () => {
    setSending(true);
    const r = await actions.emitirGuia({ destinatario, docDestinatario, placa, direccionLlegada, sku, qty });
    setSending(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`Guía de Remisión Electrónica ${r.gre.id} emitida y enviada a SUNAT`);
  };

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <h3 className="font-serif font-bold text-lg text-[#082017]">Emitir Guía de Remisión GRE ({company.serieGre})</h3>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1">Destinatario (Cliente)</label>
          <input type="text" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1">DNI / RUC Destinatario</label>
            <input type="text" value={docDestinatario} onChange={(e) => setDocDestinatario(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-mono font-bold" />
          </div>
          <div>
            <label className="font-bold block mb-1">Placa Camioneta</label>
            <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-mono font-bold" />
          </div>
        </div>
        <div>
          <label className="font-bold block mb-1">Dirección de Destino (Llegada)</label>
          <input type="text" value={direccionLlegada} onChange={(e) => setDireccionLlegada(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <label className="font-bold block mb-1">Bienes Trasladados</label>
            <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-semibold">
              {products.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1">Cantidad</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="w-full p-2.5 bg-[#faf8f5] border rounded-xl font-bold" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={emitir} disabled={sending} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold disabled:opacity-60">
          {sending ? 'Enviando a SUNAT...' : 'Emitir GRE Remitente'}
        </button>
      </div>
    </ModalShell>
  );
}
