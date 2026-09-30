// ==========================================
// OFERTAS: todo lo que hoy tiene precio rebajado, por evento
// ==========================================
import { useEffect } from 'react';
import { navegar, useUbicacion } from '../../../app/router';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import { hoyLocal } from '../../../lib/fechas';
import { url } from '../datos';
import { TarjetaProducto, Titulo } from '../componentes';
import { BannerEventos } from '../Eventos';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Ofertas() {
  const { datos } = useTienda();
  const { query } = useUbicacion();
  const evento = query.get('evento') ?? '';
  useEffect(() => fijarMetadatos({ titulo: 'Ofertas', descripcion: 'Plantas e insumos con precio especial y promociones de temporada.' }), []);
  const hoy = hoyLocal();
  const activos = (datos?.eventos ?? []).filter(e => e.desde <= hoy && hoy <= e.hasta);
  const sel = activos.find(e => e.id === evento);
  const lista = (datos?.productos ?? [])
    .filter(p => (sel ? p.eventos?.includes(sel.id) : (p.precioRegular ?? 0) > p.precio || !!p.eventos?.length))
    .sort((a, b) => (b.precioRegular ?? b.precio) - b.precio - ((a.precioRegular ?? a.precio) - a.precio));
  const chip = (on: boolean) => `min-h-[40px] px-4 rounded-full text-sm font-semibold border shrink-0 ${on ? 'bg-hoja-700 text-white border-hoja-700' : 'bg-white text-slate-700 border-slate-300'}`;

  return (
    <Pagina className="py-10 space-y-6">
      <Titulo nivel="h1" antetitulo="Precios especiales" titulo="Ofertas" bajada="Todo lo que hoy tiene precio rebajado. Los precios incluyen IGV." />
      {datos && <BannerEventos eventos={sel ? [sel] : datos.eventos} compacto />}
      {activos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por evento">
          <button className={chip(!sel)} aria-pressed={!sel} onClick={() => navegar(url('/ofertas'), { reemplazar: true })}>Todas las ofertas</button>
          {activos.map(e => <button key={e.id} className={chip(sel?.id === e.id)} aria-pressed={sel?.id === e.id} onClick={() => navegar(url(`/ofertas?evento=${encodeURIComponent(e.id)}`), { reemplazar: true })}>{e.nombre}</button>)}
        </div>
      )}
      {!datos ? <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="aspect-[4/6] !rounded-3xl" />)}</div>
        : lista.length ? <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{lista.map(p => <TarjetaProducto key={p.sku} p={p} />)}</div>
          : <EstadoVacio titulo="Hoy no hay ofertas" detalle="Vuelve pronto: publicamos promociones en fechas especiales." />}
    </Pagina>
  );
}
