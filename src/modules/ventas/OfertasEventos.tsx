// ==========================================
// OFERTAS Y EVENTOS
// Eventos con promoción (Día de la Madre, Navidad…): banner en la tienda y % de descuento por producto o categoría.
// Las ofertas de un producto se ponen en su ficha (Catálogo); aquí se ven todas juntas.
// ==========================================
import { useState } from 'react';
import { CalendarDays, Plus, Save, X } from 'lucide-react';
import { SubirFoto } from '../../components/SubirFoto';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import type { EventoPromocion } from '../../domain/types';
import { CATEGORIAS } from '../../lib/catalogo';
import { hoyLocal, sumarDias } from '../../lib/fechas';
import { soles } from '../../lib/formato';
import { eventoIncluye, precioVigente } from '../../lib/ofertas';
import { useErp } from '../../store/ErpStore';
import { Bloque } from '../admin/comunes';

const campo = 'w-full min-h-[40px] px-3 rounded-control border border-crema-300 bg-white text-sm';

export default function OfertasEventos() {
  const { state, actions } = useErp();
  const hoy = hoyLocal();
  const [editando, setEditando] = useState<EventoPromocion | null>(null);
  const conOferta = state.products.filter(p => p.precioOferta && (!p.ofertaHasta || p.ofertaHasta >= hoy));
  const estado = (e: EventoPromocion) => (!e.visible ? ['Oculto', 'neutro'] : e.hasta < hoy ? ['Terminado', 'neutro'] : e.desde > hoy ? ['Próximo', 'aviso'] : ['Activo', 'exito']) as [string, 'neutro' | 'aviso' | 'exito'];

  const quitarOferta = async (sku: string) => {
    const p = state.products.find(x => x.sku === sku);
    if (!p) return;
    const r = await actions.guardarProducto({ ...p, precioOferta: undefined, ofertaHasta: undefined }, false);
    if (!r.ok) alert(r.error);
  };

  return (
    <div className="space-y-5">
      <Bloque titulo="Eventos con promoción" accion={<Boton tamano="sm" onClick={() => setEditando({ id: `nuevo-${Date.now()}`, nombre: '', desde: hoy, hasta: sumarDias(hoy, 7), descuentoPct: 10, categorias: [], skus: [], visible: true })}><Plus className="w-4 h-4" aria-hidden /> Nuevo evento</Boton>}>
        <p className="text-xs text-tinta-suave">Aparecen en un banner al inicio de la tienda (los próximos, como anuncio). Mientras están activos, sus productos se cobran con el descuento en la tienda, la caja y los pedidos.</p>
        {editando && <FormEvento inicial={editando} cerrar={() => setEditando(null)} />}
        {state.eventos.length ? (
          <ul className="divide-y divide-crema-200">
            {state.eventos.map(e => {
              const [txt, tono] = estado(e);
              const n = state.products.filter(p => eventoIncluye(e, p)).length;
              return (
                <li key={e.id} className="py-2.5 flex flex-wrap items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-bosque-700" aria-hidden />
                  <span className="flex-1 min-w-[200px]"><b className="text-tinta">{e.nombre}</b><span className="block text-xs text-tinta-suave">{e.desde} al {e.hasta} · {e.descuentoPct > 0 ? `-${e.descuentoPct}%` : 'sin descuento'} · {n} producto(s)</span></span>
                  <Insignia tono={tono}>{txt}</Insignia>
                  <Boton tamano="sm" variante="secundario" onClick={() => setEditando(e)}>Editar</Boton>
                </li>
              );
            })}
          </ul>
        ) : !editando && <EstadoVacio titulo="Sin eventos" detalle="Ejemplo: Día de la Madre, del 1 al 10 de mayo, 15% en plantas de interior." />}
      </Bloque>

      <Bloque titulo="Productos en oferta">
        <p className="text-xs text-tinta-suave">La oferta de cada producto se pone en su ficha (Catálogo → Editar → Precio de oferta). En la tienda salen primero, con el precio anterior tachado.</p>
        {conOferta.length ? (
          <table className="w-full text-sm">
            <thead className="text-xs text-tinta-suave"><tr><th className="text-left">Producto</th><th className="text-right">Precio</th><th className="text-right">Oferta</th><th className="text-right">Hasta</th><th /></tr></thead>
            <tbody>
              {conOferta.map(p => (
                <tr key={p.sku} className="border-t border-crema-200">
                  <td className="py-1.5">{p.name}</td><td className="text-right line-through text-tinta-suave">{soles(p.price)}</td>
                  <td className="text-right font-bold">{soles(precioVigente(p, state.eventos, hoy).precio)}</td><td className="text-right text-xs">{p.ofertaHasta ?? '—'}</td>
                  <td className="text-right"><button onClick={() => void quitarOferta(p.sku)} aria-label={`Quitar oferta de ${p.name}`} className="p-1.5 text-error"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-tinta-suave">Ningún producto tiene oferta propia.</p>}
      </Bloque>
    </div>
  );
}

function FormEvento({ inicial, cerrar }: { inicial: EventoPromocion; cerrar: () => void }) {
  const { state, actions } = useErp();
  const [e, setE] = useState(inicial);
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<EventoPromocion>) => setE(prev => ({ ...prev, ...c }));
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);
  const q = buscar.trim().toLowerCase();

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const r = await actions.guardarEvento(e);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    cerrar();
  };

  return (
    <Tarjeta as="section" className="p-4 space-y-3 text-sm">
      <div className="grid sm:grid-cols-[1fr_150px_150px_110px] gap-2">
        <input aria-label="Nombre del evento" placeholder="Ej. Día de la Madre" value={e.nombre} onChange={x => set({ nombre: x.target.value })} maxLength={80} className={campo} />
        <input aria-label="Inicio del evento" type="date" value={e.desde} onChange={x => set({ desde: x.target.value })} className={campo} />
        <input aria-label="Fin del evento" type="date" value={e.hasta} onChange={x => set({ hasta: x.target.value })} className={campo} />
        <input aria-label="Descuento del evento" type="number" min={0} max={90} step={1} value={e.descuentoPct} onChange={x => set({ descuentoPct: Number(x.target.value) || 0 })} className={campo} />
      </div>
      <input aria-label="Descripción del evento" placeholder="Mensaje del banner (ej. Regala vida a mamá: 15% en plantas de interior)" value={e.descripcion ?? ''} onChange={x => set({ descripcion: x.target.value })} maxLength={300} className={campo} />
      <SubirFoto valor={e.imagen} cambiar={url => set({ imagen: url || undefined })} carpeta="eventos" nombre={e.nombre || 'evento'} />
      <fieldset className="space-y-1">
        <legend className="text-xs font-bold text-tinta">Categorías en promoción</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map(c => (
            <label key={c.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={e.categorias.includes(c.id)} onChange={() => set({ categorias: alternar(e.categorias, c.id) })} /> {c.nombre}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-xs font-bold text-tinta">Productos sueltos ({e.skus.length})</legend>
        <input aria-label="Buscar producto del evento" placeholder="Buscar producto…" value={buscar} onChange={x => setBuscar(x.target.value)} className={campo} />
        <div className="max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-1">
          {state.products.filter(p => !q || p.name.toLowerCase().includes(q) || e.skus.includes(p.sku)).map(p => (
            <label key={p.sku} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={e.skus.includes(p.sku)} onChange={() => set({ skus: alternar(e.skus, p.sku) })} /> {p.name}</label>
          ))}
        </div>
        {!e.categorias.length && !e.skus.length && <p className="text-[11px] text-aviso font-bold">Sin categorías ni productos elegidos, el descuento aplica a todo el catálogo.</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={e.visible} onChange={x => set({ visible: x.target.checked })} /> Visible en la tienda</label>
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      <div className="flex gap-2">
        <Boton cargando={guardando} onClick={() => void guardar()}><Save className="w-4 h-4" aria-hidden /> Guardar evento</Boton>
        <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
      </div>
    </Tarjeta>
  );
}
