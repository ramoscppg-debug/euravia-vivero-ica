// ==========================================
// EVENTOS CON PROMOCIÓN (tienda)
// Banner interactivo al inicio: pasa solo, con flechas y puntos; lleva a los productos del evento.
// ==========================================
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Enlace } from '../../app/router';
import type { EventoPromocion } from '../../domain/types';
import { hoyLocal } from '../../lib/fechas';
import { url } from './datos';

const fecha = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });

export function BannerEventos({ eventos, compacto = false }: { eventos: EventoPromocion[]; compacto?: boolean }) {
  const hoy = hoyLocal();
  // Primero los activos; luego los que vienen (anuncio)
  const lista = [...eventos.filter(e => e.desde <= hoy && hoy <= e.hasta), ...eventos.filter(e => e.desde > hoy).sort((a, b) => a.desde.localeCompare(b.desde))];
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (lista.length < 2 || pausa) return;
    const t = setInterval(() => setI(x => (x + 1) % lista.length), 6000);
    return () => clearInterval(t);
  }, [lista.length, pausa]);
  if (!lista.length) return null;
  const e = lista[Math.min(i, lista.length - 1)];
  const activo = e.desde <= hoy;

  return (
    <section aria-label="Eventos y promociones" aria-roledescription="carrusel" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}
      className={`relative overflow-hidden rounded-[2rem] text-white ${compacto ? 'min-h-[140px]' : 'min-h-[260px] sm:min-h-[320px]'} bg-gradient-to-br from-hoja-800 via-hoja-700 to-emerald-500`}>
      {e.imagen && <img src={e.imagen} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
      <div className={`relative h-full flex flex-col justify-end gap-2 ${compacto ? 'p-5' : 'p-6 sm:p-10'} max-w-2xl`} aria-live="polite">
        <span className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur">
          <CalendarDays className="w-4 h-4" aria-hidden /> {activo ? `Hasta el ${fecha(e.hasta)}` : `Desde el ${fecha(e.desde)}`}
        </span>
        <h2 className={`${compacto ? 'text-2xl' : 'text-3xl sm:text-5xl'} font-extrabold tracking-tight`}>
          {e.nombre}{e.descuentoPct > 0 && <span className="ml-3 inline-block px-3 py-1 rounded-2xl bg-amber-400 text-slate-900 align-middle text-[0.6em]">-{e.descuentoPct}%</span>}
        </h2>
        {e.descripcion && !compacto && <p className="text-white/90 text-base sm:text-lg">{e.descripcion}</p>}
        {activo
          ? <Enlace href={url(`/ofertas?evento=${encodeURIComponent(e.id)}`)} className="self-start mt-2 inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full bg-white text-hoja-900 font-bold hover:bg-hoja-50">Ver promociones <ArrowRight className="w-5 h-5" aria-hidden /></Enlace>
          : <p className="text-sm font-bold text-white/90">¡Muy pronto! Guarda la fecha.</p>}
      </div>
      {lista.length > 1 && (
        <>
          <button onClick={() => setI((i - 1 + lista.length) % lista.length)} aria-label="Evento anterior" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={() => setI((i + 1) % lista.length)} aria-label="Evento siguiente" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
          <div className="absolute bottom-3 right-5 flex gap-1.5">
            {lista.map((x, j) => <button key={x.id} onClick={() => setI(j)} aria-label={`Ver ${x.nombre}`} aria-current={j === i || undefined} className={`h-2 rounded-full transition-all ${j === i ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />)}
          </div>
        </>
      )}
    </section>
  );
}
