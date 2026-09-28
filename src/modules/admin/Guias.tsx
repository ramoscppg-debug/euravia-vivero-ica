import { useState } from 'react';
import { Check, FileText, PlusCircle, X } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import type { GuiaRemisionSunat } from '../../domain/types';
import { imprimirModeloGuia } from '../../lib/modelos';
import { ModalShell } from '../../components/shared';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Guias() {
  const { state } = useErp();
  const { open } = useUi();
  const { company } = state;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-tinta">Guías de Remisión Electrónica (GRE Remitente {company.serieGre})</h3>
          <p className="text-xs text-tinta-suave">Documento de sustento de traslado de plantas y macetas en camioneta o servicio de reparto</p>
        </div>
        <button onClick={() => open({ type: 'gre' })} className="px-4 py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold text-xs flex items-center gap-1.5 shadow-md">
          <PlusCircle className="w-4 h-4" /> Generar Nueva Guía GRE
        </button>
      </div>

      <div className="space-y-4">
        {state.guiasRemision.map(gre => (
          <div key={gre.id} className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-base text-tinta">{gre.numeroSunat ?? gre.id}</span>
                <span className="bg-bosque-700 text-oro font-bold text-[10px] px-2.5 py-0.5 rounded-full">GRE Remitente</span>
              </div>
              {gre.estadoSunat === 'PENDIENTE' && !gre.numeroSunat ? <Insignia tono="aviso">Por emitir en SUNAT</Insignia> : <Insignia tono="exito">Emitida</Insignia>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-[10px] text-tinta-suave uppercase font-bold block">Punto de Partida</span>
                <p className="font-semibold text-tinta">{gre.puntoPartida.direccion}</p>
              </div>
              <div>
                <span className="text-[10px] text-tinta-suave uppercase font-bold block">Punto de Llegada (Destinatario)</span>
                <p className="font-semibold text-tinta">{gre.puntoLlegada.direccion}</p>
                <p className="text-[11px] text-tinta-suave">{gre.destinatario.nombreRazonSocial} ({gre.destinatario.tipoDoc === '6' ? 'RUC' : 'DNI'} {gre.destinatario.numDoc})</p>
              </div>
              <div>
                <span className="text-[10px] text-tinta-suave uppercase font-bold block">Vehículo & Chofer</span>
                <p className="font-semibold text-tinta">Placa: {gre.datosEnvio?.placaVehiculo || 'por indicar'}</p>
                <p className="text-[11px] text-tinta-suave">{gre.datosEnvio?.conductorNombre ? `${gre.datosEnvio.conductorNombre} (DNI ${gre.datosEnvio.conductorDni})` : 'Conductor: se indica al emitir'}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-tinta-suave">Bultos: {(gre.items || []).map(it => `${it.cantidad}x ${it.descripcion}`).join(', ')}{gre.datosEnvio?.pesoBrutoTotal ? ` | Peso aprox.: ${gre.datosEnvio.pesoBrutoTotal} kg` : ''}</span>
              <Boton tamano="sm" variante="secundario" onClick={() => imprimirModeloGuia(gre, company)}><FileText className="w-3.5 h-3.5" aria-hidden /> Ver modelo</Boton>
            </div>
            {gre.estadoSunat === 'PENDIENTE' && !gre.numeroSunat && <RegistrarGuia gre={gre} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Anota el número con el que se emitió la guía en SUNAT. */
function RegistrarGuia({ gre }: { gre: GuiaRemisionSunat }) {
  const { actions } = useErp();
  const [numero, setNumero] = useState(gre.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-aviso-fondo">
      <span className="font-bold text-aviso">Emítela en SUNAT con el modelo y anota el número:</span>
      <input aria-label={`N° emitido en SUNAT de la guía ${gre.id}`} value={numero} onChange={e => setNumero(e.target.value.toUpperCase())} className="w-36 min-h-[36px] px-2 rounded-control border border-crema-300 font-mono font-bold bg-white" />
      <Boton tamano="sm" onClick={async () => { const r = await actions.registrarGuiaExterna(gre.id, numero); setError(r.ok ? null : r.error); }}><Check className="w-3.5 h-3.5" aria-hidden /> Ya la emití</Boton>
      {error && <span role="alert" className="text-error font-bold">{error}</span>}
    </div>
  );
}

// ============================================================
// MODAL: GUÍA DE REMISIÓN ELECTRÓNICA GRE
// ============================================================
export function GreModal() {
  const { state, actions, nube } = useErp();
  const { close } = useUi();
  const { company, products } = state;

  const [destinatario, setDestinatario] = useState(nube ? '' : 'Valeria Benavides');
  const [docDestinatario, setDocDestinatario] = useState(nube ? '' : '47891234');
  const [placa, setPlaca] = useState(nube ? '' : 'BZF-412');
  const [direccionLlegada, setDireccionLlegada] = useState(nube ? '' : 'Calle Las Orquídeas 340, Miraflores');
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
        <h3 className="font-serif font-bold text-lg text-tinta">Emitir Guía de Remisión GRE ({company.serieGre})</h3>
        <button onClick={close}><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1">Destinatario (Cliente)</label>
          <input type="text" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-bold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold block mb-1">DNI / RUC Destinatario</label>
            <input type="text" value={docDestinatario} onChange={(e) => setDocDestinatario(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-mono font-bold" />
          </div>
          <div>
            <label className="font-bold block mb-1">Placa Camioneta</label>
            <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-mono font-bold" />
          </div>
        </div>
        <div>
          <label className="font-bold block mb-1">Dirección de Destino (Llegada)</label>
          <input type="text" value={direccionLlegada} onChange={(e) => setDireccionLlegada(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-bold" />
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <label className="font-bold block mb-1">Bienes Trasladados</label>
            <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2.5 bg-crema border rounded-xl font-semibold">
              {products.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div>
            <label className="font-bold block mb-1">Cantidad</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="w-full p-2.5 bg-crema border rounded-xl font-bold" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={emitir} disabled={sending} className="flex-1 py-3 rounded-2xl bg-bosque-950 text-oro font-bold disabled:opacity-60">
          {sending ? 'Enviando a SUNAT...' : 'Emitir GRE Remitente'}
        </button>
      </div>
    </ModalShell>
  );
}
