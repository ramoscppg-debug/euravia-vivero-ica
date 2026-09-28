import { useState } from 'react';
import { BellRing, ExternalLink, Trash2, Truck } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '../../components/ui';
import type { AvisosWhatsapp } from '../../domain/types';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';

const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';

/** Aviso automático al WhatsApp del dueño cuando entra un pedido web (CallMeBot, gratuito). */
export function AvisosPedidos() {
  const { state, actions, nube } = useErp();
  const [a, setA] = useState<AvisosWhatsapp>(state.avisos);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const guardar = async () => {
    const r = await actions.guardarAvisos(a);
    setMsg(r.ok ? { ok: true, texto: 'Guardado ✓' } : { ok: false, texto: r.error });
  };
  const probar = async () => {
    const r = await actions.probarAviso();
    setMsg(r.ok ? { ok: true, texto: 'Mensaje de prueba enviado: revisa tu WhatsApp en unos segundos.' } : { ok: false, texto: r.error });
  };

  return (
    <Tarjeta as="section" className="p-6 space-y-4 text-sm">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-crema-300">
        <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><BellRing className="w-5 h-5 text-bosque-700" aria-hidden /> Avisos de pedidos a tu WhatsApp</h4>
        <Insignia tono={state.avisos.activo ? 'exito' : 'neutro'}>{state.avisos.activo ? 'Activos' : 'Apagados'}</Insignia>
      </div>
      <p className="text-xs text-tinta-suave">Cada vez que un cliente confirme un pedido, una cotización o una consulta en la tienda, te llega un WhatsApp con el resumen y el enlace al panel. Usa el servicio gratuito CallMeBot (para avisos a tu propio número).</p>
      <ol className="text-xs text-tinta space-y-1 list-decimal pl-5 p-3 rounded-control bg-crema">
        <li>Abre la <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener noreferrer" className="font-bold text-bosque-700 underline inline-flex items-center gap-0.5">guía de CallMeBot <ExternalLink className="w-3 h-3" aria-hidden /></a> y guarda su número en tus contactos.</li>
        <li>Desde tu WhatsApp envíale el mensaje: <b>I allow callmebot to send me messages</b></li>
        <li>Te responde con tu <b>apikey</b>: cópiala aquí, activa los avisos y prueba.</li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold">Tu WhatsApp (con código de país)
          <input aria-label="WhatsApp para avisos" value={a.whatsapp ?? ''} onChange={e => setA({ ...a, whatsapp: e.target.value })} placeholder="+51 9XX XXX XXX" className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-bold">Clave (apikey) de CallMeBot
          <input aria-label="Apikey de CallMeBot" value={a.apikey ?? ''} onChange={e => setA({ ...a, apikey: e.target.value })} autoComplete="off" className={`${campo} mt-1 font-mono`} />
        </label>
      </div>
      <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={a.activo} onChange={e => setA({ ...a, activo: e.target.checked })} /> Enviarme un aviso por cada pedido web</label>
      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={() => void guardar()}>Guardar avisos</Boton>
        <Boton variante="secundario" disabled={!nube || !state.avisos.activo} onClick={() => void probar()}>Enviar prueba</Boton>
        {msg && <span role="status" className={`text-xs font-bold ${msg.ok ? 'text-exito' : 'text-error'}`}>{msg.texto}</span>}
      </div>
      {!nube && <p className="text-[11px] text-tinta-suave">En el modo demo los avisos no se envían.</p>}
      {state.avisos.ultimoEnvio && <p className="text-[11px] text-tinta-suave">Último aviso enviado: {new Date(state.avisos.ultimoEnvio).toLocaleString('es-PE')}</p>}
    </Tarjeta>
  );
}

/** Tarifas fijas de delivery por distrito: la tienda las muestra y el pedido llega con el costo ya puesto. */
export function TarifasDelivery() {
  const { state, actions } = useErp();
  const [nueva, setNueva] = useState({ distrito: '', costo: '' });

  const agregar = async () => {
    const r = await actions.guardarTarifa({ distrito: nueva.distrito, costo: Number(nueva.costo), activo: true });
    if (!r.ok) return alert(r.error);
    setNueva({ distrito: '', costo: '' });
  };

  return (
    <Tarjeta as="section" className="p-6 space-y-4 text-sm">
      <div className="pb-2 border-b border-crema-300">
        <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><Truck className="w-5 h-5 text-bosque-700" aria-hidden /> Delivery por distrito</h4>
      </div>
      <p className="text-xs text-tinta-suave">El cliente elige su distrito y ve el costo del delivery antes de confirmar. Si su distrito no está en la lista, queda "a coordinar".</p>
      {state.tarifasDelivery.length > 0 && (
        <ul className="divide-y divide-crema-200 rounded-control border border-crema-300">
          {state.tarifasDelivery.map(t => (
            <li key={t.distrito} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 font-semibold">{t.distrito}</span>
              <input type="number" min={0} step="0.5" aria-label={`Costo de delivery a ${t.distrito}`} defaultValue={t.costo}
                onBlur={e => { const costo = Number(e.target.value); if (costo !== t.costo) void actions.guardarTarifa({ ...t, costo }); }}
                className="w-24 min-h-[36px] px-2 rounded-control border border-crema-300 text-right font-bold" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={t.activo} onChange={e => void actions.guardarTarifa({ ...t, activo: e.target.checked })} /> activo</label>
              <button onClick={() => void actions.eliminarTarifa(t.distrito)} aria-label={`Quitar ${t.distrito}`} className="p-1.5 rounded-lg bg-error-fondo text-error"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 grid-cols-[1fr_120px_auto]">
        <input aria-label="Distrito nuevo" value={nueva.distrito} onChange={e => setNueva({ ...nueva, distrito: e.target.value })} placeholder="Distrito (ej. Ica)" className={campo} />
        <input aria-label="Costo del distrito nuevo" type="number" min={0} step="0.5" value={nueva.costo} onChange={e => setNueva({ ...nueva, costo: e.target.value })} placeholder="S/" className={campo} />
        <Boton variante="secundario" onClick={() => void agregar()}>Agregar</Boton>
      </div>
      {!state.tarifasDelivery.length && <p className="text-[11px] text-tinta-suave">Ejemplo: Ica {soles(10)}, Parcona {soles(12)}, La Tinguiña {soles(12)}. Tú defines los precios.</p>}
    </Tarjeta>
  );
}
