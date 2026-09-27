import { useState } from 'react';
import { Check, Leaf, Minus, Plus, Share2, UserRound } from 'lucide-react';
import { Enlace } from '../../app/router';
import type { ProductoPublico } from '../../domain/types';
import { soles } from '../../lib/formato';
import { url } from './datos';
import { MAX_CANTIDAD, useTienda } from './TiendaApp';

export { soles };

/** Foto existente del producto; si no hay, un marco neutro (no se inventan imágenes). */
export function Imagen({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) {
    return (
      <div role="img" aria-label={alt} className={`bg-gradient-to-br from-hoja-50 to-slate-100 flex items-center justify-center ${className}`}>
        <Leaf className="w-10 h-10 text-hoja-600/40" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFallo(true)} className={`object-cover ${className}`} />;
}

/** Cantidad disponible real; si no hay stock, se ofrece el pedido con asesor. */
export function ChipStock({ p }: { p: Pick<ProductoPublico, 'stock' | 'disponibilidad'> }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap';
  if (p.stock <= 0) return <span className={`${base} bg-slate-100 text-slate-600`}><UserRound className="w-3.5 h-3.5" aria-hidden /> A pedido con asesor</span>;
  if (p.disponibilidad === 'POCAS') return <span className={`${base} bg-amber-50 text-amber-800`}><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden /> Últimas {p.stock} u.</span>;
  return <span className={`${base} bg-hoja-50 text-hoja-800`}><span className="w-2 h-2 rounded-full bg-hoja-500" aria-hidden /> {p.stock} disponibles</span>;
}

/** Aviso cuando se pide más de lo que hay: esa parte la atiende un asesor de ventas. */
export function NotaStock({ stock, cantidad, compacta = false }: { stock: number; cantidad: number; compacta?: boolean }) {
  if (cantidad <= stock) return null;
  const extra = cantidad - Math.max(0, stock);
  return (
    <p className={`rounded-xl bg-amber-50 text-amber-900 ${compacta ? 'text-[11px] px-2 py-1' : 'text-sm p-3'} font-semibold`}>
      {stock > 0
        ? `Tenemos ${stock} disponibles. ${extra} u. adicional(es) se atienden como pedido con un asesor de ventas.`
        : 'Sin stock por ahora: un asesor de ventas coordina este pedido contigo.'}
    </p>
  );
}

export function Contador({ valor, cambiar, etiqueta, permitirCero = false, grande = false }: { valor: number; cambiar: (n: number) => void; etiqueta: string; permitirCero?: boolean; grande?: boolean }) {
  const alto = grande ? 'min-h-[48px] min-w-[48px]' : 'min-h-[36px] min-w-[36px]';
  return (
    <div className="inline-flex items-center rounded-full border border-slate-300 bg-white" role="group" aria-label={`Cantidad de ${etiqueta}`}>
      <button type="button" className={`${alto} flex items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40`} onClick={() => cambiar(valor - 1)} disabled={!permitirCero && valor <= 1} aria-label="Menos"><Minus className="w-4 h-4" /></button>
      <input
        type="number" inputMode="numeric" min={permitirCero ? 0 : 1} max={MAX_CANTIDAD} value={valor}
        onChange={e => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n)) cambiar(Math.min(MAX_CANTIDAD, Math.max(permitirCero ? 0 : 1, n))); }}
        className={`${grande ? 'w-14 text-base' : 'w-11 text-sm'} text-center font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
        aria-label={`Cantidad de ${etiqueta}`}
      />
      <button type="button" className={`${alto} flex items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-40`} onClick={() => cambiar(valor + 1)} disabled={valor >= MAX_CANTIDAD} aria-label="Más"><Plus className="w-4 h-4" /></button>
    </div>
  );
}

export function TarjetaProducto({ p }: { p: ProductoPublico }) {
  const { agregar, carrito } = useTienda();
  const enSeleccion = carrito.find(l => l.sku === p.sku)?.cantidad ?? 0;
  const href = url(`/producto/${encodeURIComponent(p.sku)}`);
  return (
    <article className="group bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col hover:border-hoja-300 hover:shadow-xl hover:shadow-hoja-900/5 transition">
      <Enlace href={href} className="block relative" aria-label={`${p.nombre}, ver detalle`}>
        <Imagen src={p.imagen} alt={p.nombre} className="w-full aspect-[4/5] group-hover:scale-[1.02] transition-transform duration-500" />
        {p.destacado && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 text-hoja-800 text-[11px] font-bold shadow">Destacado</span>}
      </Enlace>
      <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{p.categoriaNombre}</p>
        <h3 className="text-base sm:text-lg font-bold leading-snug text-slate-900">
          <Enlace href={href} className="hover:text-hoja-800">{p.nombre}</Enlace>
        </h3>
        <ChipStock p={p} />
        <div className="mt-auto pt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg sm:text-xl font-extrabold text-slate-900 whitespace-nowrap">{soles(p.precio)}</span>
          <button
            onClick={() => agregar(p.sku)}
            className={`min-h-[40px] px-4 rounded-full text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${enSeleccion ? 'bg-hoja-50 text-hoja-800 border border-hoja-200' : 'bg-hoja-700 hover:bg-hoja-800 text-white'}`}
            aria-label={`Agregar ${p.nombre} a mi cotización`}
          >
            {enSeleccion ? <><Check className="w-4 h-4" aria-hidden /> {enSeleccion} en cotización</> : p.stock > 0 ? 'Agregar' : 'Pedir con asesor'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function BotonCompartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const compartir = async () => {
    const enlace = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: titulo, url: enlace });
      else {
        await navigator.clipboard.writeText(enlace);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch {
      // la persona canceló el diálogo de compartir
    }
  };
  return (
    <button onClick={compartir} aria-live="polite" className="min-h-[44px] px-4 rounded-full border border-slate-300 hover:border-hoja-600 text-slate-700 text-sm font-bold inline-flex items-center gap-2">
      <Share2 className="w-4 h-4" aria-hidden /> {copiado ? 'Enlace copiado' : 'Compartir'}
    </button>
  );
}

/** Encabezado de sección de la tienda. */
export function Titulo({ antetitulo, titulo, bajada, nivel = 'h2' }: { antetitulo?: string; titulo: string; bajada?: string; nivel?: 'h1' | 'h2' }) {
  const H = nivel;
  return (
    <div className="space-y-1.5">
      {antetitulo && <p className="text-xs font-bold uppercase tracking-[0.2em] text-hoja-700">{antetitulo}</p>}
      <H className={`${nivel === 'h1' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} font-extrabold tracking-tight text-slate-900`}>{titulo}</H>
      {bajada && <p className="text-slate-600 max-w-2xl">{bajada}</p>}
    </div>
  );
}
