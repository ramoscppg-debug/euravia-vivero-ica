import { useState } from 'react';
import { Copy, Eye, EyeOff, FileSpreadsheet, ImageOff, PackagePlus, Pencil, PlusCircle, QrCode, Receipt, Search, Star } from 'lucide-react';
import { Boton, EstadoVacio, Insignia } from '../../components/ui';
import type { CatalogProduct } from '../../domain/types';
import { CATEGORIAS, margenPct, pendientesDe } from '../../lib/catalogo';
import { soles } from '../../lib/formato';
import { hoyLocal } from '../../lib/fechas';
import { useAuth } from '../../store/AuthStore';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

type Filtro = 'todos' | 'incompletos' | 'sin-foto' | 'stock-bajo' | 'ocultos';

/** Catálogo del panel: encontrar, completar y reponer productos rápido. */
export default function Catalogo() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const { products } = state;
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const esDueno = rol === 'dueno';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const incompletos = products.filter(p => pendientesDe(p).length > 0);
  const conteo: Record<Filtro, number> = {
    todos: products.length,
    incompletos: incompletos.length,
    'sin-foto': products.filter(p => !p.fullImage).length,
    'stock-bajo': products.filter(p => p.stock <= p.minStock).length,
    ocultos: products.filter(p => p.visibleTienda === false).length
  };
  const texto = q.trim().toLowerCase();
  const lista = products
    .filter(p => !texto || p.name.toLowerCase().includes(texto) || p.sku.toLowerCase().includes(texto))
    .filter(p => !cat || p.category === cat)
    .filter(p => filtro === 'todos' || (filtro === 'incompletos' ? pendientesDe(p).length > 0 : filtro === 'sin-foto' ? !p.fullImage : filtro === 'stock-bajo' ? p.stock <= p.minStock : p.visibleTienda === false));

  const alternarVisible = async (p: CatalogProduct) => {
    const r = await actions.guardarProducto({ ...p, visibleTienda: p.visibleTienda === false }, false);
    if (!r.ok) alert(r.error);
  };

  const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['incompletos', 'Por completar'], ['sin-foto', 'Sin foto'], ['stock-bajo', 'Stock bajo'], ['ocultos', 'Ocultos en tienda']];

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-3xl border border-crema-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-tinta">Catálogo de productos</h3>
          <p className="text-xs text-tinta-suave">
            {products.length} producto(s) · {products.reduce((a, p) => a + Math.max(0, p.stock), 0)} unidades en stock
            {incompletos.length > 0 && <> · <b className="text-aviso">{incompletos.length} por completar</b></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {esDueno && <Boton onClick={() => open({ type: 'producto' })}><PackagePlus className="w-4 h-4" aria-hidden /> Nuevo producto</Boton>}
          {esDueno && <Boton variante="secundario" onClick={() => open({ type: 'importar-productos' })}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Cargar desde Excel</Boton>}
          <Boton variante="secundario" disabled={!products.length} onClick={() => products[0] && open({ type: 'qr', sku: products[0].sku })}><QrCode className="w-4 h-4" aria-hidden /> Etiquetas QR</Boton>
          <Boton variante="secundario" onClick={() => open({ type: 'pos' })}><PlusCircle className="w-4 h-4" aria-hidden /> Venta rápida</Boton>
        </div>
      </div>

      {!products.length ? (
        <div className="bg-white rounded-3xl border border-crema-300">
          <EstadoVacio
            titulo="Tu catálogo está vacío"
            detalle={esDueno ? 'Crea tus productos uno por uno (con su stock inicial) o cárgalos todos desde una hoja de Excel.' : 'Pide al dueño que registre los productos.'}
            accion={esDueno && (
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Boton onClick={() => open({ type: 'producto' })}><PackagePlus className="w-4 h-4" aria-hidden /> Crear el primero</Boton>
                <Boton variante="secundario" onClick={() => open({ type: 'importar-productos' })}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Cargar desde Excel</Boton>
              </div>
            )}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-2">
            <label className="flex-1 flex items-center gap-2 min-h-[42px] px-3 rounded-control bg-white border border-crema-300">
              <Search className="w-4 h-4 text-tinta-suave" aria-hidden />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o SKU" aria-label="Buscar en el catálogo" className="flex-1 bg-transparent outline-none text-sm" />
            </label>
            <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Filtrar por categoría" className="min-h-[42px] px-3 rounded-control bg-white border border-crema-300 text-sm font-semibold">
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtros">
            {FILTROS.map(([id, t]) => (
              <button key={id} aria-pressed={filtro === id} onClick={() => setFiltro(id)}
                className={`px-3 py-1.5 rounded-full font-bold border ${filtro === id ? 'bg-bosque-950 text-white border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>
                {t} ({conteo[id]})
              </button>
            ))}
          </div>

          {lista.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map(p => {
                const falta = pendientesDe(p);
                const margen = margenPct(p.price, p.cost);
                return (
                  <article key={p.sku} className="bg-white rounded-3xl border border-crema-300 overflow-hidden flex flex-col">
                    <div className="flex gap-3 p-4">
                      <div className="w-20 h-20 rounded-2xl bg-crema overflow-hidden shrink-0 flex items-center justify-center">
                        {p.fullImage ? <img src={p.fullImage} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-6 h-6 text-tinta-suave" aria-label="Sin foto" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-tinta leading-tight">{p.name}</h4>
                          {p.destacado && <Star className="w-4 h-4 text-oro shrink-0 fill-oro" aria-label="Destacado" />}
                        </div>
                        <p className="text-[11px] font-mono text-tinta-suave">{p.sku} · {p.categoryName}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-tinta">{soles(p.price)}</span>
                          {!!p.precioOferta && (!p.ofertaHasta || p.ofertaHasta >= hoyLocal()) && <Insignia tono="acento">oferta {soles(p.precioOferta)}</Insignia>}
                          <Insignia tono={p.stock <= 0 ? 'error' : p.stock <= p.minStock ? 'aviso' : 'exito'}>{p.stock} u.</Insignia>
                          {margen !== null && <Insignia tono={margen < 20 ? 'error' : 'neutro'}>margen {margen}%</Insignia>}
                          {p.visibleTienda === false && <Insignia><EyeOff className="w-3 h-3" aria-hidden /> oculto</Insignia>}
                        </div>
                      </div>
                    </div>
                    {falta.length > 0 && (
                      <button onClick={() => esDueno && open({ type: 'producto', sku: p.sku })} className="mx-4 mb-3 text-left px-3 py-1.5 rounded-xl bg-aviso-fondo text-aviso text-[11px] font-bold">
                        Falta: {falta.join(', ')}{esDueno ? ' · completar' : ''}
                      </button>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 p-3 border-t border-crema-200 text-xs">
                      {esDueno && <button onClick={() => open({ type: 'producto', sku: p.sku })} className="px-2.5 py-1.5 rounded-xl bg-crema-200 font-bold flex items-center gap-1" aria-label={`Editar ${p.name}`}><Pencil className="w-3.5 h-3.5" aria-hidden /> Editar</button>}
                      <button onClick={() => open({ type: 'compra', sku: p.sku })} className="px-2.5 py-1.5 rounded-xl bg-crema-200 font-bold flex items-center gap-1" aria-label={`Sumar stock a ${p.name}`}><PackagePlus className="w-3.5 h-3.5" aria-hidden /> Stock</button>
                      <button onClick={() => open({ type: 'qr', sku: p.sku })} className="px-2.5 py-1.5 rounded-xl bg-crema-200 font-bold flex items-center gap-1" aria-label={`Etiquetas QR de ${p.name}`}><QrCode className="w-3.5 h-3.5" aria-hidden /> QR Tag</button>
                      {esDueno && <button onClick={() => open({ type: 'producto', duplicarDe: p.sku })} title="Duplicar" aria-label={`Duplicar ${p.name}`} className="px-2.5 py-1.5 rounded-xl bg-crema-200"><Copy className="w-3.5 h-3.5" /></button>}
                      {esDueno && <button onClick={() => void alternarVisible(p)} title={p.visibleTienda === false ? 'Mostrar en la tienda' : 'Ocultar de la tienda'} aria-label={p.visibleTienda === false ? `Mostrar ${p.name} en la tienda` : `Ocultar ${p.name} de la tienda`} className="px-2.5 py-1.5 rounded-xl bg-crema-200">{p.visibleTienda === false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>}
                      <button onClick={() => open({ type: 'pos', sku: p.sku })} className="ml-auto px-3 py-1.5 rounded-xl bg-bosque-950 text-white font-bold flex items-center gap-1"><Receipt className="w-3.5 h-3.5" aria-hidden /> Vender</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EstadoVacio titulo="Sin coincidencias" detalle="Prueba con otra búsqueda o quita los filtros." />}
        </>
      )}
    </div>
  );
}
