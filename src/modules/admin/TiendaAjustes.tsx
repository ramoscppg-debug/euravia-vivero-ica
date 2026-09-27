import { useState } from 'react';
import { AlertTriangle, ExternalLink, Store } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '../../components/ui';
import type { ConfigTienda, ServicioPublico } from '../../domain/types';
import { useErp } from '../../store/ErpStore';

const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';
const aSlug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Contacto y servicios que muestra la tienda pública (sólo el dueño). */
export default function TiendaAjustes() {
  const { state, actions } = useErp();
  const [cfg, setCfg] = useState<ConfigTienda>(state.tiendaConfig);
  const [guardado, setGuardado] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', resumen: '' });

  const guardar = async () => {
    const r = await actions.guardarConfigTienda(cfg);
    if (!r.ok) alert(r.error);
    else {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    }
  };

  const guardarServicio = async (sv: ServicioPublico) => {
    const r = await actions.guardarServicioPublico(sv);
    if (!r.ok) alert(r.error);
  };

  const agregarServicio = async () => {
    const slug = aSlug(nuevo.nombre);
    if (!slug) return alert('Escribe el nombre del servicio.');
    if (state.serviciosPublicos.some(s => s.slug === slug)) return alert('Ya existe un servicio con ese nombre.');
    await guardarServicio({ slug, nombre: nuevo.nombre.trim(), resumen: nuevo.resumen.trim(), orden: state.serviciosPublicos.length + 1, visible: true });
    setNuevo({ nombre: '', resumen: '' });
  };

  return (
    <Tarjeta as="section" className="p-6 space-y-5 text-sm">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-crema-300">
        <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><Store className="w-5 h-5 text-bosque-700" aria-hidden /> 5. Tienda pública</h4>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-terracota font-bold">Ver la tienda <ExternalLink className="w-4 h-4" aria-hidden /></a>
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

      <div className="space-y-2 pt-2 border-t border-crema-300">
        <p className="font-bold text-tinta">Servicios publicados</p>
        {state.serviciosPublicos.map(sv => (
          <details key={sv.slug} className="rounded-control border border-crema-300 bg-crema-50 px-3 py-2">
            <summary className="cursor-pointer flex items-center gap-2 font-semibold">
              {sv.nombre} <Insignia tono={sv.visible ? 'exito' : 'neutro'}>{sv.visible ? 'Visible' : 'Oculto'}</Insignia>
              <span className="text-[11px] font-mono text-tinta-suave">/servicios/{sv.slug}</span>
            </summary>
            <ServicioEditor sv={sv} alGuardar={guardarServicio} />
          </details>
        ))}
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] pt-2">
          <input aria-label="Nombre del nuevo servicio" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nuevo servicio" className={campo} />
          <input aria-label="Resumen del nuevo servicio" value={nuevo.resumen} onChange={e => setNuevo({ ...nuevo, resumen: e.target.value })} placeholder="Resumen de una línea" className={campo} />
          <Boton variante="secundario" onClick={agregarServicio}>Agregar</Boton>
        </div>
      </div>
    </Tarjeta>
  );
}

function ServicioEditor({ sv, alGuardar }: { sv: ServicioPublico; alGuardar: (s: ServicioPublico) => Promise<void> }) {
  const [s, setS] = useState(sv);
  return (
    <div className="grid gap-2 sm:grid-cols-2 pt-3">
      <label className="block text-xs font-bold">Nombre<input aria-label={`Nombre de ${sv.nombre}`} value={s.nombre} onChange={e => setS({ ...s, nombre: e.target.value })} className={`${campo} mt-1`} /></label>
      <label className="block text-xs font-bold">Foto (enlace https, opcional)<input aria-label={`Foto de ${sv.nombre}`} value={s.imagen ?? ''} onChange={e => setS({ ...s, imagen: e.target.value.trim() || undefined })} className={`${campo} mt-1`} /></label>
      <label className="block text-xs font-bold sm:col-span-2">Resumen<input aria-label={`Resumen de ${sv.nombre}`} value={s.resumen} onChange={e => setS({ ...s, resumen: e.target.value })} className={`${campo} mt-1`} /></label>
      <label className="block text-xs font-bold sm:col-span-2">Descripción<textarea aria-label={`Descripción de ${sv.nombre}`} value={s.descripcion ?? ''} onChange={e => setS({ ...s, descripcion: e.target.value })} className={`${campo} mt-1 min-h-[64px] py-2`} /></label>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={s.visible} onChange={e => setS({ ...s, visible: e.target.checked })} /> Visible en la tienda</label>
      <div className="flex justify-end"><Boton tamano="sm" onClick={() => void alGuardar(s)}>Guardar servicio</Boton></div>
    </div>
  );
}
