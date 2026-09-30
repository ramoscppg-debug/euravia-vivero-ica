// ==========================================
// OPINIONES DE CLIENTES (panel)
// Llegan desde la tienda "por aprobar". El dueño las publica, les pone la foto que envió el cliente o las elimina.
// ==========================================
import { Check, EyeOff, Star, Trash2 } from 'lucide-react';
import { SubirFoto } from '../../components/SubirFoto';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import type { Resena } from '../../domain/types';
import { useErp } from '../../store/ErpStore';

export default function ResenasPanel() {
  const { state, actions } = useErp();
  const pendientes = state.resenas.filter(r => !r.aprobada);
  const publicadas = state.resenas.filter(r => r.aprobada);
  const cambiar = async (r: Resena) => {
    const res = await actions.guardarResena(r);
    if (!res.ok) alert(res.error);
  };
  const eliminar = async (r: Resena) => {
    if (!window.confirm(`¿Eliminar la opinión de ${r.nombre}?`)) return;
    const res = await actions.eliminarResena(r.id);
    if (!res.ok) alert(res.error);
  };

  const Fila = ({ r }: { r: Resena }) => (
    <Tarjeta as="article" className="p-4 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span>
          <b className="text-tinta">{r.nombre}</b>
          <span className="block text-xs text-tinta-suave">{r.fecha}{r.telefono ? ` · ${r.telefono}` : ''}{r.productoSku ? ` · ${state.products.find(p => p.sku === r.productoSku)?.name ?? r.productoSku}` : ''}</span>
        </span>
        <span className="inline-flex text-amber-500" aria-label={`${r.estrellas} de 5 estrellas`}>{[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.estrellas ? 'fill-amber-400' : 'text-crema-300'}`} aria-hidden />)}</span>
      </div>
      <p className="text-tinta">“{r.texto}”</p>
      <SubirFoto valor={r.foto} cambiar={url => void cambiar({ ...r, foto: url || undefined })} carpeta="resenas" nombre={`resena-${r.id}`} />
      <div className="flex flex-wrap gap-2">
        {r.aprobada
          ? <Boton tamano="sm" variante="secundario" onClick={() => void cambiar({ ...r, aprobada: false })}><EyeOff className="w-4 h-4" aria-hidden /> Ocultar</Boton>
          : <Boton tamano="sm" onClick={() => void cambiar({ ...r, aprobada: true })}><Check className="w-4 h-4" aria-hidden /> Publicar</Boton>}
        <Boton tamano="sm" variante="fantasma" onClick={() => void eliminar(r)}><Trash2 className="w-4 h-4" aria-hidden /> Eliminar</Boton>
      </div>
    </Tarjeta>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-tinta-suave max-w-3xl">Las opiniones que dejan los clientes en la tienda llegan aquí y <b>no se publican solas</b>. Publica las reales; si un cliente te mandó una foto de su planta por WhatsApp, súbela a su opinión.</p>
      <section aria-label="Opiniones por aprobar" className="space-y-3">
        <h3 className="font-extrabold text-tinta flex items-center gap-2">Por aprobar <Insignia tono={pendientes.length ? 'aviso' : 'neutro'}>{pendientes.length}</Insignia></h3>
        {pendientes.length ? <div className="grid gap-3 lg:grid-cols-2">{pendientes.map(r => <Fila key={r.id} r={r} />)}</div> : <p className="text-sm text-tinta-suave">No hay opiniones nuevas.</p>}
      </section>
      <section aria-label="Opiniones publicadas" className="space-y-3">
        <h3 className="font-extrabold text-tinta">Publicadas ({publicadas.length})</h3>
        {publicadas.length ? <div className="grid gap-3 lg:grid-cols-2">{publicadas.map(r => <Fila key={r.id} r={r} />)}</div>
          : <Tarjeta><EstadoVacio titulo="Aún no hay opiniones publicadas" detalle="Pide a tus clientes que dejen su opinión en la tienda (el recordatorio de cuidado post-venta ya incluye el enlace)." /></Tarjeta>}
      </section>
    </div>
  );
}
