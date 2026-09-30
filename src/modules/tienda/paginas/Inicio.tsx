import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ClipboardCheck, Flower2, MessageCircle, Package, Search, Shovel, ShoppingBag } from 'lucide-react';
import { Enlace, navegar } from '../../../app/router';
import { Esqueleto } from '../../../components/ui';
import { esPlanta, url } from '../datos';
import { Imagen, TarjetaProducto, Titulo } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';
import { FormResena, ListaResenas } from '../Resenas';

const PASOS = [
  { Icono: ShoppingBag, titulo: 'Elige', detalle: 'Arma tu cotización con plantas, insumos o un servicio. Ves el stock real de cada producto.' },
  { Icono: ClipboardCheck, titulo: 'Confirma', detalle: 'Indica si quieres boleta o factura y cómo recibirlo. Tu pedido queda registrado con un número.' },
  { Icono: MessageCircle, titulo: 'Envía por WhatsApp', detalle: 'Mandas el pedido listo por WhatsApp y un asesor coordina contigo el pago y la entrega.' }
];

export default function Inicio() {
  const { datos } = useTienda();
  const [q, setQ] = useState('');
  useEffect(() => fijarMetadatos({
    titulo: 'AUREVIA',
    descripcion: 'Plantas de interior y exterior, macetas, sustratos e insumos, y servicios de jardinería. Mira el stock y cotiza en línea.'
  }), []);

  const productos = (datos?.productos ?? []).filter(p => !p.combo);
  const combos = (datos?.productos ?? []).filter(p => p.combo);
  // Destacados que marcó el dueño; si no marcó ninguno, lo que tiene stock
  const destacados = (productos.some(p => p.destacado) ? productos.filter(p => p.destacado) : productos.filter(p => p.stock > 0)).slice(0, 8);
  const portada = destacados.find(p => p.imagen) ?? productos.find(p => p.imagen);
  const plantas = productos.filter(esPlanta);
  const insumos = productos.filter(p => !esPlanta(p));

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    navegar(url(`/plantas${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`));
  };

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden bg-gradient-to-b from-hoja-50 to-white">
        <Pagina className="grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center py-12 lg:py-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-hoja-200 text-hoja-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-hoja-500" aria-hidden /> Vivero · Insumos · Jardinería
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900">
              Cotiza tus plantas <span className="text-hoja-700">en minutos</span> y recíbelas en casa
            </h1>
            <p className="text-lg text-slate-600 max-w-xl">
              {datos?.config.mensajePortada || 'Mira el stock real, arma tu pedido y envíalo listo por WhatsApp. Un asesor confirma el pago y la entrega contigo.'}
            </p>
            <form onSubmit={buscar} role="search" className="flex items-center gap-2 p-1.5 pl-4 rounded-full bg-white border border-slate-200 shadow-lg shadow-hoja-900/5 max-w-xl">
              <Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden />
              <label htmlFor="buscar-portada" className="sr-only">Buscar plantas</label>
              <input id="buscar-portada" value={q} onChange={e => setQ(e.target.value)} placeholder="¿Qué planta buscas?" className="flex-1 min-w-0 bg-transparent outline-none text-base py-2" />
              <button className="min-h-[44px] px-5 rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold text-sm shrink-0">Buscar</button>
            </form>
          </div>
          <div className="relative">
            {datos ? (
              <Imagen src={portada?.imagen} alt={portada ? portada.nombre : 'Vivero AUREVIA'} className="w-full aspect-[4/3] lg:aspect-[4/5] rounded-[2rem] shadow-2xl shadow-hoja-900/10" />
            ) : (
              <Esqueleto className="w-full aspect-[4/3] lg:aspect-[4/5] !rounded-[2rem]" />
            )}
          </div>
        </Pagina>
      </section>

      {/* Cómo funciona: el flujo de compra a la vista */}
      <Pagina className="py-14">
        <Titulo antetitulo="Así de simple" titulo="Tu pedido en 3 pasos" />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {PASOS.map(({ Icono, titulo, detalle }, i) => (
            <li key={titulo} className="relative p-6 rounded-3xl border border-slate-200 bg-white">
              <span className="absolute top-5 right-5 text-5xl font-extrabold text-hoja-100 select-none" aria-hidden>{i + 1}</span>
              <span className="w-12 h-12 rounded-2xl bg-hoja-700 text-white flex items-center justify-center"><Icono className="w-6 h-6" aria-hidden /></span>
              <p className="mt-4 text-lg font-extrabold text-slate-900">{i + 1}. {titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{detalle}</p>
            </li>
          ))}
        </ol>
      </Pagina>

      {/* Qué buscas */}
      <Pagina className="pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { href: url('/plantas'), titulo: 'Plantas', detalle: datos ? `${plantas.length} especie(s) en catálogo` : 'Interior, exterior y suculentas', Icono: Flower2 },
            { href: url('/productos'), titulo: 'Productos e insumos', detalle: datos ? `${insumos.length} producto(s) en catálogo` : 'Macetas, sustratos y más', Icono: Package },
            { href: url('/servicios'), titulo: 'Servicios', detalle: datos ? `${datos.servicios.length} servicio(s) de jardinería` : 'Diseño y mantenimiento', Icono: Shovel }
          ].map(({ href, titulo, detalle, Icono }) => (
            <Enlace key={href} href={href} className="group p-6 rounded-3xl bg-slate-50 hover:bg-hoja-50 border border-transparent hover:border-hoja-200 transition-colors flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl bg-white text-hoja-700 flex items-center justify-center shrink-0 shadow-sm"><Icono className="w-6 h-6" aria-hidden /></span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold text-slate-900">{titulo}</span>
                <span className="block text-sm text-slate-600">{detalle}</span>
              </span>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-hoja-700 group-hover:translate-x-1 transition-transform" aria-hidden />
            </Enlace>
          ))}
        </div>
      </Pagina>

      {/* Destacados */}
      <Pagina className="pb-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <Titulo antetitulo="Catálogo" titulo="Disponibles hoy" />
          <Enlace href={url('/plantas')} className="text-sm font-bold text-hoja-700 hover:underline shrink-0">Ver todo</Enlace>
        </div>
        {datos ? (
          destacados.length ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{destacados.map(p => <TarjetaProducto key={p.sku} p={p} />)}</div>
          ) : (
            <p className="p-8 rounded-3xl bg-slate-50 text-slate-600 text-center">Estamos preparando nuestro catálogo. Muy pronto verás aquí nuestras plantas.</p>
          )
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="aspect-[4/6] !rounded-3xl" />)}</div>
        )}
      </Pagina>

      {/* Combos */}
      {combos.length > 0 && (
        <Pagina className="pt-10 pb-6">
          <div className="mb-6"><Titulo antetitulo="Ahorra llevando todo" titulo="Combos" /></div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{combos.map(p => <TarjetaProducto key={p.sku} p={p} />)}</div>
        </Pagina>
      )}

      {/* Servicios */}
      {!!datos?.servicios.length && (
        <section className="mt-14 bg-hoja-950 text-white">
          <Pagina className="py-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-hoja-300">Jardinería y paisajismo</p>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight">Cotiza un servicio para tu espacio</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {datos.servicios.map(s => (
                <Enlace key={s.slug} href={url(`/servicios/${s.slug}`)} className="group p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="block text-lg font-extrabold">{s.nombre}</span>
                  <span className="block text-sm text-hoja-100/80 mt-1">{s.resumen}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-hoja-300 mt-4">Cotizar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden /></span>
                </Enlace>
              ))}
            </div>
          </Pagina>
        </section>
      )}

      {/* Opiniones */}
      {datos && (
        <Pagina className="py-14 space-y-6">
          <Titulo antetitulo="Clientes felices" titulo="Lo que dicen de nosotros" />
          <ListaResenas resenas={datos.resenas.slice(0, 9)} />
          <FormResena />
        </Pagina>
      )}
    </>
  );
}
