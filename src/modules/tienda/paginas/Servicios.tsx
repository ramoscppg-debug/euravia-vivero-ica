import { useEffect } from 'react';
import { ArrowRight, ChevronLeft, Shovel } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import { BotonCompartir, BotonConsulta, FormularioSolicitud, Imagen } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export function Servicios() {
  const { datos } = useTienda();
  useEffect(() => fijarMetadatos({ titulo: 'Servicios de jardinería', descripcion: 'Diseño paisajista, mantenimiento de jardines, jardines verticales y riego. Solicita una cotización.' }), []);

  return (
    <Pagina className="py-10">
      <h1 className="font-serif text-4xl font-bold text-bosque-950">Servicios de jardinería</h1>
      <p className="text-tinta-suave mt-1 mb-8 max-w-2xl">Cuéntanos qué necesitas y te preparamos una cotización a medida.</p>
      {!datos ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(i => <Esqueleto key={i} className="h-44 !rounded-tarjeta" />)}</div>
      ) : datos.servicios.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {datos.servicios.map(s => (
            <Enlace key={s.slug} href={`/servicios/${s.slug}`} className="group flex flex-col rounded-tarjeta bg-white border border-crema-300 shadow-suave overflow-hidden hover:border-bosque-600 transition-colors">
              {s.imagen && <Imagen src={s.imagen} alt={s.nombre} className="w-full aspect-[16/9]" />}
              <span className="p-6 flex flex-col gap-2 flex-1">
                {!s.imagen && <Shovel className="w-7 h-7 text-bosque-600" aria-hidden />}
                <span className="font-serif text-2xl font-bold text-bosque-950">{s.nombre}</span>
                <span className="text-tinta-suave">{s.resumen}</span>
                <span className="mt-auto pt-2 inline-flex items-center gap-1 font-bold text-terracota">Solicitar cotización <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden /></span>
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

  if (!datos) return <Pagina className="py-10"><Esqueleto className="h-72 !rounded-tarjeta" /></Pagina>;
  if (!s) return <Pagina className="py-16"><EstadoVacio titulo="Servicio no disponible" accion={<Enlace href="/servicios" className="text-terracota font-bold underline">Ver servicios</Enlace>} /></Pagina>;

  return (
    <Pagina className="py-8">
      <Enlace href="/servicios" className="inline-flex items-center gap-1 text-sm font-semibold text-tinta-suave hover:text-bosque-950 mb-6">
        <ChevronLeft className="w-4 h-4" aria-hidden /> Servicios
      </Enlace>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10">
        <div className="space-y-5">
          {s.imagen && <Imagen src={s.imagen} alt={s.nombre} className="w-full aspect-[16/10] rounded-tarjeta" />}
          <h1 className="font-serif text-4xl font-bold text-bosque-950">{s.nombre}</h1>
          <p className="text-lg text-tinta">{s.resumen}</p>
          {s.descripcion && <p className="text-tinta-suave leading-relaxed">{s.descripcion}</p>}
          <div className="flex flex-wrap gap-3">
            <BotonConsulta texto={`Hola, quisiera una cotización de ${s.nombre}: ${window.location.href}`} etiqueta="Cotizar por WhatsApp" alternativa="#cotizar" />
            <BotonCompartir titulo={s.nombre} />
          </div>
        </div>
        <div id="cotizar" className="p-6 rounded-tarjeta bg-white border border-crema-300 shadow-suave self-start">
          <FormularioSolicitud
            base={{ tipo: 'SERVICIO', servicio: s.slug, mensaje: '' }}
            titulo="Solicitar cotización"
            boton="Enviar solicitud"
          />
        </div>
      </div>
    </Pagina>
  );
}
