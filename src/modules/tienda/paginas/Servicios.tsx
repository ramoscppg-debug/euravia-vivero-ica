import { useEffect } from 'react';
import { ArrowRight, ChevronLeft, ClipboardCheck, Shovel } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import { url } from '../datos';
import { BotonCompartir, Imagen, Titulo } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export function Servicios() {
  const { datos } = useTienda();
  useEffect(() => fijarMetadatos({ titulo: 'Servicios de jardinería', descripcion: 'Diseño paisajista, mantenimiento de jardines, jardines verticales y riego. Solicita una cotización.' }), []);

  return (
    <Pagina className="py-10">
      <div className="mb-8"><Titulo nivel="h1" antetitulo="Servicios" titulo="Servicios de jardinería" bajada="Cuéntanos qué necesitas y te preparamos una cotización a medida, con boleta o factura." /></div>
      {!datos ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(i => <Esqueleto key={i} className="h-44 !rounded-3xl" />)}</div>
      ) : datos.servicios.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {datos.servicios.map(s => (
            <Enlace key={s.slug} href={url(`/servicios/${s.slug}`)} className="group flex flex-col rounded-3xl bg-white border border-slate-200 overflow-hidden hover:border-hoja-300 hover:shadow-xl hover:shadow-hoja-900/5 transition">
              {s.imagen && <Imagen src={s.imagen} alt={s.nombre} className="w-full aspect-[16/9]" />}
              <span className="p-6 flex flex-col gap-2 flex-1">
                {!s.imagen && <span className="w-12 h-12 rounded-2xl bg-hoja-50 text-hoja-700 flex items-center justify-center"><Shovel className="w-6 h-6" aria-hidden /></span>}
                <span className="text-xl font-extrabold text-slate-900">{s.nombre}</span>
                <span className="text-slate-600">{s.resumen}</span>
                <span className="mt-auto pt-2 inline-flex items-center gap-1 font-bold text-hoja-700">Cotizar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden /></span>
              </span>
            </Enlace>
          ))}
        </div>
      ) : (
        <EstadoVacio titulo="Pronto publicaremos nuestros servicios" />
      )}
    </Pagina>
  );
}

export function ServicioDetalle({ slug }: { slug: string }) {
  const { datos } = useTienda();
  const s = datos?.servicios.find(x => x.slug === slug);
  useEffect(() => {
    if (s) fijarMetadatos({ titulo: s.nombre, descripcion: s.resumen, imagen: s.imagen });
  }, [s]);

  if (!datos) return <Pagina className="py-10"><Esqueleto className="h-72 !rounded-3xl" /></Pagina>;
  if (!s) return <Pagina className="py-16"><EstadoVacio titulo="Servicio no disponible" accion={<Enlace href={url('/servicios')} className="text-hoja-700 font-bold underline">Ver servicios</Enlace>} /></Pagina>;

  return (
    <Pagina className="py-8">
      <Enlace href={url('/servicios')} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-hoja-800 mb-6">
        <ChevronLeft className="w-4 h-4" aria-hidden /> Servicios
      </Enlace>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
        <div className="space-y-5">
          {s.imagen && <Imagen src={s.imagen} alt={s.nombre} className="w-full aspect-[16/10] rounded-[2rem]" />}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{s.nombre}</h1>
          <p className="text-lg text-slate-700">{s.resumen}</p>
          {s.descripcion && <p className="text-slate-600 leading-relaxed whitespace-pre-line">{s.descripcion}</p>}
          <BotonCompartir titulo={s.nombre} />
        </div>
        <div className="p-6 rounded-3xl bg-hoja-50 border border-hoja-100 space-y-4 lg:sticky lg:top-24">
          <ClipboardCheck className="w-8 h-8 text-hoja-700" aria-hidden />
          <p className="text-xl font-extrabold text-slate-900">Pide tu cotización</p>
          <ol className="text-sm text-slate-700 space-y-1.5 list-decimal pl-5">
            <li>Cuéntanos qué necesitas.</li>
            <li>Elige boleta o factura.</li>
            <li>Envíalo por WhatsApp y un asesor te responde.</li>
          </ol>
          <Enlace href={url(`/cotizar?servicio=${encodeURIComponent(s.slug)}`)} className="w-full min-h-[52px] rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold inline-flex items-center justify-center gap-2">
            Cotizar este servicio <ArrowRight className="w-5 h-5" aria-hidden />
          </Enlace>
        </div>
      </div>
    </Pagina>
  );
}
