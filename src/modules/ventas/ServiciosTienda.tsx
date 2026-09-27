import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Shovel, Trash2 } from 'lucide-react';
import { SubirFoto } from '../../components/SubirFoto';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import type { ServicioPublico } from '../../domain/types';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';

const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';
export const aSlug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Servicios que se ofrecen en la tienda: se crean, ordenan, ocultan y cotizan desde aquí. */
export default function ServiciosTienda() {
  const { state, actions } = useErp();
  const servicios = [...state.serviciosPublicos].sort((a, b) => a.orden - b.orden);
  const [nuevo, setNuevo] = useState(false);

  const guardar = async (sv: ServicioPublico) => {
    const r = await actions.guardarServicioPublico(sv);
    if (!r.ok) alert(r.error);
    return r.ok;
  };

  // Intercambia el orden con el vecino
  const mover = async (i: number, d: -1 | 1) => {
    const a = servicios[i];
    const b = servicios[i + d];
    if (!a || !b) return;
    await guardar({ ...a, orden: b.orden });
    await guardar({ ...b, orden: a.orden });
  };

  const eliminar = async (sv: ServicioPublico) => {
    if (!confirm(`¿Eliminar "${sv.nombre}" de la tienda? Si sólo quieres pausarlo, desmarca "Visible".`)) return;
    const r = await actions.eliminarServicioPublico(sv.slug);
    if (!r.ok) alert(r.error);
  };

  const pedidos = (slug: string) => state.solicitudes.filter(s => s.servicioSlug === slug).length;

  return (
    <div className="space-y-5 text-sm">
      <Tarjeta className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-tinta flex items-center gap-2"><Shovel className="w-5 h-5 text-bosque-700" aria-hidden /> Servicios de la tienda</h3>
          <p className="text-xs text-tinta-suave">Lo que ven los clientes en /tienda/servicios. El precio "desde" es opcional: si lo dejas vacío, el servicio sólo se cotiza.</p>
        </div>
        <div className="flex gap-2">
          <a href="/tienda/servicios" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-control border border-crema-300 font-bold text-xs">Ver en la tienda <ExternalLink className="w-4 h-4" aria-hidden /></a>
          <Boton onClick={() => setNuevo(true)}><Plus className="w-4 h-4" aria-hidden /> Nuevo servicio</Boton>
        </div>
      </Tarjeta>

      {nuevo && (
        <Tarjeta className="p-5 border-bosque-700">
          <p className="font-extrabold text-tinta mb-3">Nuevo servicio</p>
          <EditorServicio
            sv={{ slug: '', nombre: '', resumen: '', orden: (servicios[servicios.length - 1]?.orden ?? 0) + 1, visible: true }}
            nuevo
            alGuardar={async sv => {
              const slug = aSlug(sv.nombre);
              if (!slug) { alert('Escribe el nombre del servicio.'); return false; }
              if (state.serviciosPublicos.some(s => s.slug === slug)) { alert('Ya existe un servicio con ese nombre.'); return false; }
              const ok = await guardar({ ...sv, slug });
              if (ok) setNuevo(false);
              return ok;
            }}
            cancelar={() => setNuevo(false)}
          />
        </Tarjeta>
      )}

      {!servicios.length && !nuevo ? (
        <Tarjeta><EstadoVacio titulo="Aún no publicas servicios" detalle="Agrega tus servicios de jardinería (diseño, mantenimiento, riego…) para que los clientes los coticen." accion={<Boton onClick={() => setNuevo(true)}><Plus className="w-4 h-4" aria-hidden /> Agregar el primero</Boton>} /></Tarjeta>
      ) : (
        <ul className="space-y-3">
          {servicios.map((sv, i) => (
            <li key={sv.slug}>
              <details className="bg-white rounded-3xl border border-crema-300 px-5 py-3 group">
                <summary className="cursor-pointer flex flex-wrap items-center gap-2 list-none">
                  <span className="font-bold text-tinta">{sv.nombre}</span>
                  <Insignia tono={sv.visible ? 'exito' : 'neutro'}>{sv.visible ? 'Visible' : 'Oculto'}</Insignia>
                  <Insignia>{sv.precioDesde !== undefined ? `desde ${soles(sv.precioDesde)}` : 'a cotizar'}</Insignia>
                  {!sv.imagen && <Insignia tono="aviso">sin foto</Insignia>}
                  <span className="text-[11px] text-tinta-suave">{pedidos(sv.slug)} solicitud(es)</span>
                  <span className="ml-auto flex gap-1" onClick={e => e.preventDefault()}>
                    <button onClick={() => void mover(i, -1)} disabled={i === 0} aria-label={`Subir ${sv.nombre}`} className="p-1.5 rounded-lg bg-crema-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => void mover(i, 1)} disabled={i === servicios.length - 1} aria-label={`Bajar ${sv.nombre}`} className="p-1.5 rounded-lg bg-crema-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => void eliminar(sv)} aria-label={`Eliminar ${sv.nombre}`} className="p-1.5 rounded-lg bg-error-fondo text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                </summary>
                <div className="pt-3"><EditorServicio sv={sv} alGuardar={guardar} /></div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorServicio({ sv, alGuardar, nuevo = false, cancelar }: { sv: ServicioPublico; alGuardar: (s: ServicioPublico) => Promise<boolean>; nuevo?: boolean; cancelar?: () => void }) {
  const [s, setS] = useState(sv);
  const [guardado, setGuardado] = useState(false);
  const guardar = async () => {
    if (await alGuardar({ ...s, nombre: s.nombre.trim(), resumen: s.resumen.trim() }) && !nuevo) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-bold">Nombre<input aria-label={nuevo ? 'Nombre del nuevo servicio' : `Nombre de ${sv.nombre}`} value={s.nombre} onChange={e => setS({ ...s, nombre: e.target.value })} className={`${campo} mt-1`} placeholder="Ej.: Mantenimiento de jardines" /></label>
      <label className="block text-xs font-bold">Precio referencial "desde" (S/, opcional)
        <input aria-label={nuevo ? 'Precio desde del nuevo servicio' : `Precio desde de ${sv.nombre}`} type="number" min={0} step="1" value={s.precioDesde ?? ''} onChange={e => setS({ ...s, precioDesde: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })} className={`${campo} mt-1`} placeholder="Vacío = a cotizar" />
      </label>
      <label className="block text-xs font-bold sm:col-span-2">Resumen (una línea)<input aria-label={nuevo ? 'Resumen del nuevo servicio' : `Resumen de ${sv.nombre}`} value={s.resumen} onChange={e => setS({ ...s, resumen: e.target.value })} maxLength={240} className={`${campo} mt-1`} /></label>
      <label className="block text-xs font-bold sm:col-span-2">Descripción<textarea aria-label={nuevo ? 'Descripción del nuevo servicio' : `Descripción de ${sv.nombre}`} value={s.descripcion ?? ''} onChange={e => setS({ ...s, descripcion: e.target.value })} className={`${campo} mt-1 min-h-[72px] py-2`} placeholder="Qué incluye, cómo trabajas, qué datos necesitas para cotizar…" /></label>
      <div className="sm:col-span-2"><p className="text-xs font-bold mb-1">Foto (opcional)</p><SubirFoto valor={s.imagen} cambiar={url => setS({ ...s, imagen: url || undefined })} carpeta="servicios" nombre={s.slug || aSlug(s.nombre) || 'servicio'} /></div>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={s.visible} onChange={e => setS({ ...s, visible: e.target.checked })} /> Visible en la tienda</label>
      <div className="flex justify-end items-center gap-2">
        {guardado && <span role="status" className="text-exito font-bold text-xs">Guardado ✓</span>}
        {cancelar && <Boton tamano="sm" variante="secundario" onClick={cancelar}>Cancelar</Boton>}
        <Boton tamano="sm" onClick={() => void guardar()}>{nuevo ? 'Crear servicio' : 'Guardar servicio'}</Boton>
      </div>
    </div>
  );
}
