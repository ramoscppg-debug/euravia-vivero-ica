import { useState } from 'react';
import { AlertTriangle, ExternalLink, Store } from 'lucide-react';
import { Boton, Tarjeta } from '../../components/ui';
import type { ConfigTienda } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';

/** Datos de contacto que muestra la tienda pública (sólo el dueño). */
export default function TiendaAjustes() {
  const { state, actions } = useErp();
  const [cfg, setCfg] = useState<ConfigTienda>(state.tiendaConfig);
  const [guardado, setGuardado] = useState(false);
  const { setTab } = useUi();

  const guardar = async () => {
    const r = await actions.guardarConfigTienda(cfg);
    if (!r.ok) alert(r.error);
    else {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    }
  };


  return (
    <Tarjeta as="section" className="p-6 space-y-5 text-sm">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-crema-300">
        <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><Store className="w-5 h-5 text-bosque-700" aria-hidden /> 5. Tienda pública</h4>
        <a href="/tienda" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-terracota font-bold">Ver la tienda <ExternalLink className="w-4 h-4" aria-hidden /></a>
      </div>

      {!state.tiendaConfig.whatsapp && (
        <p className="flex gap-2 p-3 rounded-control bg-aviso-fondo text-aviso font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          Sin WhatsApp configurado: la tienda ofrece el formulario de solicitud en lugar del botón de WhatsApp.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold">WhatsApp de ventas (con código de país)
          <input aria-label="WhatsApp de la tienda" value={cfg.whatsapp ?? ''} onChange={e => setCfg({ ...cfg, whatsapp: e.target.value })} placeholder="+51 9XX XXX XXX" className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-bold">Correo de contacto
          <input aria-label="Correo de la tienda" type="email" value={cfg.email ?? ''} onChange={e => setCfg({ ...cfg, email: e.target.value })} className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-bold">Dirección del vivero
          <input aria-label="Dirección de la tienda" value={cfg.direccion ?? ''} onChange={e => setCfg({ ...cfg, direccion: e.target.value })} className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-bold">Horario de atención
          <input aria-label="Horario" value={cfg.horario ?? ''} onChange={e => setCfg({ ...cfg, horario: e.target.value })} placeholder="Lun a sáb, 9:00 a 18:00" className={`${campo} mt-1`} />
        </label>
        <label className="block text-xs font-bold sm:col-span-2">Mensaje de portada (opcional)
          <input aria-label="Mensaje de portada" value={cfg.mensajePortada ?? ''} onChange={e => setCfg({ ...cfg, mensajePortada: e.target.value })} maxLength={300} className={`${campo} mt-1`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Boton onClick={guardar}>Guardar datos de la tienda</Boton>
        {guardado && <span role="status" className="text-exito font-bold">Guardado ✓</span>}
      </div>

      <p className="pt-2 border-t border-crema-300 text-xs text-tinta-suave">
        Los servicios, productos y fotos se editan en <button onClick={() => setTab('servicios-tienda')} className="font-bold text-bosque-700 underline">Catálogo y almacén → Servicios de la tienda</button>.
      </p>
    </Tarjeta>
  );
}

