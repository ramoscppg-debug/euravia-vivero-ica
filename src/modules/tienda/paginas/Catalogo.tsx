import { useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { navegar, useUbicacion } from '../../../app/router';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import type { ProductoPublico } from '../../../domain/types';
import { esPlanta, ordenVitrina } from '../datos';
import { BannerEventos } from '../Eventos';
import { TarjetaProducto, Titulo } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

type Orden = 'relevancia' | 'precio-asc' | 'precio-desc' | 'nombre';

const TEXTO = {
  plantas: { titulo: 'Plantas', bajada: 'Especies de interior, exterior y suculentas con sus cuidados.' },
  insumos: { titulo: 'Productos e insumos', bajada: 'Macetas, sustratos, fertilizantes y accesorios para tus plantas.' }
};

// Nombre del filtro por categoría (la etiqueta de cada producto puede ser más específica)
const NOMBRE_CATEGORIA: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', suculentas: 'Suculentas', macetas: 'Macetas',
  sustratos: 'Sustratos', fertilizantes: 'Fertilizantes', accesorios: 'Accesorios'
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Catalogo({ grupo }: { grupo: 'plantas' | 'insumos' }) {
  const { datos } = useTienda();
  const { ruta, query } = useUbicacion();
  const q = query.get('q') ?? '';
  const cat = query.get('cat') ?? '';
  const soloDisponibles = query.get('disp') === '1';
  const soloOfertas = query.get('ofertas') === '1';
  const soloNuevos = query.get('nuevos') === '1';
  const orden = (query.get('orden') as Orden) || 'relevancia';
  const t = TEXTO[grupo];

  useEffect(() => fijarMetadatos({ titulo: t.titulo, descripcion: t.bajada }), [t]);

  // Los filtros viven en la URL: se pueden compartir y sobreviven a "atrás"
  const fijar = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(query);
    Object.entries(cambios).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    const qs = p.toString();
    navegar(`${ruta}${qs ? `?${qs}` : ''}`, { reemplazar: true });
  };

  const delGrupo = (datos?.productos ?? []).filter(p => !p.combo && (grupo === 'plantas' ? esPlanta(p) : !esPlanta(p)));
  const categorias = [...new Set(delGrupo.map(p => p.categoria))].map(id => [id, NOMBRE_CATEGORIA[id] ?? id] as const);
  const texto = sinTildes(q.trim());
  const lista = delGrupo
    .filter(p => !cat || p.categoria === cat)
    .filter(p => !soloDisponibles || p.stock > 0)
    .filter(p => !soloOfertas || (p.precioRegular ?? 0) > p.precio)
    .filter(p => !soloNuevos || p.esNuevo)
    .filter(p => !texto || sinTildes([p.nombre, p.nombreCientifico, p.categoriaNombre, p.descripcion].filter(Boolean).join(' ')).includes(texto))
    .sort((a: ProductoPublico, b: ProductoPublico) =>
      orden === 'precio-asc' ? a.precio - b.precio : orden === 'precio-desc' ? b.precio - a.precio : orden === 'nombre' ? a.nombre.localeCompare(b.nombre) : ordenVitrina(a, b));

  const chip = (activo: boolean) => `min-h-[40px] px-4 rounded-full text-sm font-semibold border transition-colors ${activo ? 'bg-hoja-700 text-white border-hoja-700' : 'bg-white text-slate-700 border-slate-300 hover:border-hoja-600'}`;

  return (
    <Pagina className="py-10">
      {!!datos?.eventos.length && <div className="mb-6"><BannerEventos eventos={datos.eventos} compacto /></div>}
      <div className="mb-6"><Titulo nivel="h1" antetitulo="Catálogo" titulo={t.titulo} bajada={`${t.bajada} Ves el stock real; si necesitas más, un asesor te atiende.`} /></div>

      <div className="space-y-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 flex items-center gap-2 min-h-[48px] px-4 rounded-full bg-white border border-slate-300 focus-within:border-hoja-600">
            <Search className="w-5 h-5 text-slate-500" aria-hidden />
            <span className="sr-only">Buscar en {t.titulo.toLowerCase()}</span>
            <input type="search" value={q} onChange={e => fijar({ q: e.target.value })} placeholder="Buscar por nombre…" className="flex-1 bg-transparent outline-none text-base" />
            {q && <button onClick={() => fijar({ q: '' })} aria-label="Borrar búsqueda" className="p-1"><X className="w-4 h-4" /></button>}
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="shrink-0">Ordenar</span>
            <select value={orden} onChange={e => fijar({ orden: e.target.value === 'relevancia' ? '' : e.target.value })} className="min-h-[48px] px-3 rounded-full bg-white border border-slate-300">
              <option value="relevancia">Ofertas y novedades</option>
              <option value="precio-asc">Precio: menor a mayor</option>
              <option value="precio-desc">Precio: mayor a menor</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" role="group" aria-label="Filtrar por categoría">
          <button className={chip(!cat)} aria-pressed={!cat} onClick={() => fijar({ cat: '' })}>Todas</button>
          {categorias.map(([id, nombre]) => (
            <button key={id} className={`${chip(cat === id)} shrink-0`} aria-pressed={cat === id} onClick={() => fijar({ cat: cat === id ? '' : id })}>{nombre}</button>
          ))}
          <button className={`${chip(soloOfertas)} shrink-0`} aria-pressed={soloOfertas} onClick={() => fijar({ ofertas: soloOfertas ? '' : '1' })}>Ofertas</button>
          <button className={`${chip(soloNuevos)} shrink-0`} aria-pressed={soloNuevos} onClick={() => fijar({ nuevos: soloNuevos ? '' : '1' })}>Nuevos</button>
          <button className={`${chip(soloDisponibles)} shrink-0`} aria-pressed={soloDisponibles} onClick={() => fijar({ disp: soloDisponibles ? '' : '1' })}>Sólo disponibles</button>
        </div>
      </div>

      {!datos ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="aspect-[4/6] !rounded-3xl" />)}</div>
      ) : lista.length ? (
        <>
          <p className="text-sm text-slate-500 mb-3" aria-live="polite">{lista.length} resultado(s)</p>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{lista.map(p => <TarjetaProducto key={p.sku} p={p} />)}</div>
        </>
      ) : (
        <EstadoVacio titulo="No encontramos coincidencias" detalle="Prueba con otra palabra o quita algún filtro." />
      )}
    </Pagina>
  );
}
