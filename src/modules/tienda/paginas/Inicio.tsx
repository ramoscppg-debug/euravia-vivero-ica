import { useEffect } from 'react';
import { ArrowRight, Flower2, Package, Shovel } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { claseBoton, Esqueleto } from '../../../components/ui';
import { esPlanta } from '../datos';
import { Imagen, TarjetaProducto } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Inicio() {
  const { datos } = useTienda();
  useEffect(() => fijarMetadatos({
    titulo: 'AUREVIA',
    descripcion: 'Plantas de interior y exterior, macetas, sustratos e insumos, y servicios de jardinería. Consulta disponibilidad y pide en línea.'
  }), []);

  const productos = datos?.productos ?? [];
  // Destacados que marcó el dueño; si no marcó ninguno, las plantas disponibles del catálogo
  const destacados = (productos.some(p => p.destacado) ? productos.filter(p => p.destacado) : productos.filter(p => esPlanta(p) && p.disponibilidad !== 'AGOTADO')).slice(0, 4);
  const portada = destacados.find(p => p.imagen) ?? productos.find(p => p.imagen);
  const plantas = productos.filter(esPlanta);
  const insumos = productos.filter(p => !esPlanta(p));

  return (
    <>
      {/* Portada */}
      <section className="bg-bosque-950 text-crema-50 overflow-hidden">
        <Pagina className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-12 lg:py-20">
          <div className="space-y-6 order-2 lg:order-1">
            <p className="text-oro font-bold tracking-[0.2em] uppercase text-xs">Vivero • Insumos • Jardinería</p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]">
              Plantas, insumos y jardinería en un solo lugar
            </h1>
            <p className="text-lg text-bosque-200 max-w-xl">
              {datos?.config.mensajePortada || 'Elige tus plantas, suma macetas y sustratos, o pide una cotización para tu jardín. Te confirmamos disponibilidad antes de coordinar.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Enlace href="/plantas" className={claseBoton('acento', 'lg')}>Ver plantas <ArrowRight className="w-5 h-5" aria-hidden /></Enlace>
              <Enlace href="/servicios" className={claseBoton('secundario', 'lg', '!bg-transparent !text-crema-50 !border-bosque-200/40 hover:!bg-white/10')}>Servicios de jardinería</Enlace>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            {datos ? (
              <Imagen src={portada?.imagen} alt={portada ? portada.nombre : 'Vivero AUREVIA'} className="w-full aspect-[4/3] lg:aspect-square rounded-tarjeta shadow-elevada" />
            ) : (
              <Esqueleto className="w-full aspect-[4/3] lg:aspect-square !rounded-tarjeta !bg-bosque-900" />
            )}
          </div>
        </Pagina>
      </section>

      {/* Qué buscas */}
      <Pagina className="py-14">
        <h2 className="font-serif text-3xl font-bold text-bosque-950 mb-6">¿Qué estás buscando?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { href: '/plantas', titulo: 'Plantas', detalle: datos ? `${plantas.length} especies en catálogo` : 'Interior, exterior y suculentas', Icono: Flower2 },
            { href: '/productos', titulo: 'Productos e insumos', detalle: datos ? `${insumos.length} productos en catálogo` : 'Macetas, sustratos y más', Icono: Package },
            { href: '/servicios', titulo: 'Servicios', detalle: datos ? `${datos.servicios.length} servicios de jardinería` : 'Diseño y mantenimiento', Icono: Shovel }
          ].map(({ href, titulo, detalle, Icono }) => (
            <Enlace key={href} href={href} className="group p-6 rounded-tarjeta bg-white border border-crema-300 shadow-suave hover:border-bosque-600 transition-colors flex items-center gap-4">
              <span className="w-12 h-12 rounded-control bg-bosque-100 text-bosque-700 flex items-center justify-center shrink-0"><Icono className="w-6 h-6" aria-hidden /></span>
              <span className="flex-1">
                <span className="block font-serif text-xl font-bold text-bosque-950">{titulo}</span>
                <span className="block text-sm text-tinta-suave">{detalle}</span>
              </span>
              <ArrowRight className="w-5 h-5 text-tinta-suave group-hover:text-bosque-700 group-hover:translate-x-1 transition-transform" aria-hidden />
            </Enlace>
          ))}
        </div>
      </Pagina>

      {/* Destacados */}
      <Pagina className="pb-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="font-serif text-3xl font-bold text-bosque-950">Destacados del vivero</h2>
          <Enlace href="/plantas" className="text-sm font-bold text-terracota hover:underline shrink-0">Ver todo</Enlace>
        </div>
        {datos ? (
          destacados.length ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{destacados.map(p => <TarjetaProducto key={p.sku} p={p} />)}</div>
          ) : (
            <p className="text-tinta-suave">Pronto publicaremos nuestro catálogo.</p>
          )
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="aspect-[4/6] !rounded-tarjeta" />)}</div>
        )}
      </Pagina>

      {/* Servicios */}
      {!!datos?.servicios.length && (
        <section className="mt-14 bg-crema-200/60">
          <Pagina className="py-14">
            <h2 className="font-serif text-3xl font-bold text-bosque-950 mb-2">Jardinería y paisajismo</h2>
            <p className="text-tinta-suave mb-6 max-w-2xl">Cuéntanos qué necesitas y te enviamos una cotización.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {datos.servicios.map(s => (
                <Enlace key={s.slug} href={`/servicios/${s.slug}`} className="p-5 rounded-tarjeta bg-white border border-crema-300 hover:border-bosque-600 transition-colors">
                  <span className="block font-serif text-lg font-bold text-bosque-950">{s.nombre}</span>
                  <span className="block text-sm text-tinta-suave mt-1">{s.resumen}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-terracota mt-3">Solicitar cotización <ArrowRight className="w-4 h-4" aria-hidden /></span>
                </Enlace>
              ))}
            </div>
          </Pagina>
        </section>
      )}
    </>
  );
}
