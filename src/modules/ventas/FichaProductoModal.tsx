import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import { ModalShell } from '../../components/shared';
import { SubirFoto } from '../../components/SubirFoto';
import type { CatalogProduct } from '../../domain/types';
import { CATEGORIAS, categoriaDe, margenPct, siguienteSku } from '../../lib/catalogo';
import { soles } from '../../lib/formato';
import { tipoExistenciaDe } from '../../lib/contabilidad';
import { TABLA_5, TABLA_6 } from '../../lib/kardexValorado';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const VACIO: CatalogProduct = {
  sku: '', name: '', category: 'interior', price: 0, cost: 0, stock: 0, minStock: 5, location: '', isLivePlant: true,
  fullImage: '', description: '', botanicalFamily: '', categoryName: 'Planta de interior', visibleTienda: true, destacado: false
};

/** Campo con etiqueta (fuera del componente para que los inputs no pierdan el foco al escribir). */
function F({ label, children, span = '', ayuda }: { label: string; children: React.ReactNode; span?: string; ayuda?: string }) {
  return (
    <label className={`block text-xs font-bold text-tinta ${span}`}>{label}
      <div className="mt-1">{children}</div>
      {ayuda && <span className="block mt-0.5 font-normal text-[11px] text-tinta-suave">{ayuda}</span>}
    </label>
  );
}

/**
 * Ficha del producto (dueño). Al crear: SKU automático por categoría y stock inicial en el mismo paso
 * (entra al Kardex como inventario inicial). Al editar, el stock sólo cambia con compras, ventas y mermas.
 */
export function FichaProductoModal({ sku, duplicarDe }: { sku?: string; duplicarDe?: string }) {
  const { state, actions } = useErp();
  const { close } = useUi();
  const existente = sku ? state.products.find(p => p.sku === sku) : undefined;
  const base = duplicarDe ? state.products.find(p => p.sku === duplicarDe) : undefined;
  const nuevaFicha = (plantilla?: CatalogProduct): CatalogProduct => {
    const cat = plantilla?.category ?? VACIO.category;
    return { ...(plantilla ?? VACIO), sku: siguienteSku(cat, state.products.map(p => p.sku)), name: plantilla ? `${plantilla.name} (copia)` : '', stock: 0, fullImage: plantilla?.fullImage ?? '', destacado: false };
  };
  const [p, setP] = useState<CatalogProduct>(existente ?? nuevaFicha(base));
  const [skuManual, setSkuManual] = useState(false);
  const [stockInicial, setStockInicial] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const set = (c: Partial<CatalogProduct>) => setP(prev => ({ ...prev, ...c }));
  const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold disabled:opacity-60';
  const margen = margenPct(p.price, p.cost);

  const cambiarCategoria = (id: CatalogProduct['category']) => {
    const c = categoriaDe(id);
    set({ category: c.id, isLivePlant: c.viva, categoryName: existente?.category === c.id ? p.categoryName : c.nombre, ...(!existente && !skuManual ? { sku: siguienteSku(c.id, state.products.map(x => x.sku)) } : {}) });
  };

  const guardar = async (otro: boolean) => {
    setGuardando(true);
    const r = await actions.guardarProducto(p, !existente, stockInicial);
    setGuardando(false);
    if (!r.ok) return alert(r.error);
    if (!otro) return close();
    // Crear otro: misma categoría, SKU siguiente, campos en blanco
    setAviso(`✓ ${p.name} creado${stockInicial ? ` con ${stockInicial} u.` : ''}`);
    const skus = [...state.products.map(x => x.sku), p.sku];
    setP({ ...VACIO, category: p.category, categoryName: p.categoryName, isLivePlant: p.isLivePlant, minStock: p.minStock, sku: siguienteSku(p.category, skus) });
    setStockInicial(0);
    setSkuManual(false);
  };

  return (
    <ModalShell size="max-w-3xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">{existente ? `Editar ${existente.name}` : base ? `Duplicar ${base.name}` : 'Nuevo producto'}</h3>
          <p className="text-[11px] text-tinta-suave">{existente ? `Stock actual: ${existente.stock} u. (se mueve con compras, ventas y mermas).` : 'Completa lo básico; foto y descripción puedes agregarlas después.'}</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      {aviso && <p role="status" className="p-2.5 rounded-control bg-exito-fondo text-exito text-xs font-bold">{aviso}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <F label="Nombre" span="sm:col-span-2"><input aria-label="Nombre del producto" autoFocus value={p.name} onChange={e => set({ name: e.target.value })} className={campo} placeholder="Ej.: Monstera deliciosa 60 cm" /></F>
        <F label="Categoría">
          <select aria-label="Categoría" value={p.category} onChange={e => cambiarCategoria(e.target.value as CatalogProduct['category'])} className={campo}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </F>
        <F label="Precio de venta (S/, con IGV)"><input aria-label="Precio de venta" type="number" min={0} step="0.1" value={p.price || ''} onChange={e => set({ price: Number(e.target.value) || 0 })} className={campo} /></F>
        <F label="Precio de oferta (S/, con IGV)" ayuda="Opcional. La tienda lo muestra primero, con el precio anterior tachado."><input aria-label="Precio de oferta" type="number" min={0} step="0.1" value={p.precioOferta ?? ''} onChange={e => set({ precioOferta: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} className={campo} /></F>
        <F label="Oferta hasta" ayuda="Vacío = hasta que la quites."><input aria-label="Oferta hasta" type="date" value={p.ofertaHasta ?? ''} disabled={!p.precioOferta} onChange={e => set({ ofertaHasta: e.target.value || undefined })} className={campo} /></F>
        <F label="Costo unitario (S/, sin IGV)" ayuda="Privado: no se muestra en la tienda."><input aria-label="Costo unitario" type="number" min={0} step="0.1" value={p.cost || ''} onChange={e => set({ cost: Number(e.target.value) || 0 })} className={campo} /></F>
        <div className="text-xs font-bold text-tinta">Margen
          <div className="mt-1 min-h-[40px] flex items-center gap-2">
            {margen === null ? <span className="text-tinta-suave font-normal">Indica precio y costo</span>
              : <Insignia tono={margen < 20 ? 'error' : margen < 35 ? 'aviso' : 'exito'}>{margen}% · gana {soles(p.price / 1.18 - p.cost)} por unidad</Insignia>}
          </div>
        </div>
        {!existente && (
          <F label="Stock inicial (unidades)" ayuda="Entra al Kardex como inventario inicial, valorizado al costo."><input aria-label="Stock inicial" type="number" min={0} value={stockInicial || ''} onChange={e => setStockInicial(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={campo} /></F>
        )}
        <F label="Stock mínimo" ayuda="Debajo de esto avisa para reponer."><input aria-label="Stock mínimo" type="number" min={0} value={p.minStock} onChange={e => set({ minStock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={campo} /></F>
        <F label="SKU" ayuda={existente ? 'No se cambia una vez creado.' : skuManual ? 'SKU escrito a mano.' : 'Automático por categoría.'}>
          <input aria-label="SKU" disabled={!!existente} value={p.sku} onChange={e => { setSkuManual(true); set({ sku: e.target.value.toUpperCase() }); }} className={`${campo} font-mono`} />
        </F>
        <div className="sm:col-span-3"><p className="text-xs font-bold text-tinta mb-1">Foto del producto</p><SubirFoto valor={p.fullImage} cambiar={url => set({ fullImage: url })} carpeta="productos" nombre={p.sku || p.name} /></div>
        <F label="Descripción para la tienda" span="sm:col-span-3"><textarea aria-label="Descripción" value={p.description} onChange={e => set({ description: e.target.value })} className={`${campo} min-h-[72px] py-2`} placeholder="Tamaño, maceta incluida, para qué espacio es ideal…" /></F>
        <details className="sm:col-span-3 rounded-control border border-crema-300 px-3 py-2" open={!!existente}>
          <summary className="cursor-pointer text-xs font-bold text-tinta">Más datos (etiqueta, ubicación y cuidados)</summary>
          <div className="grid gap-3 sm:grid-cols-3 pt-3">
            <F label="Etiqueta visible"><input aria-label="Etiqueta de categoría" value={p.categoryName} onChange={e => set({ categoryName: e.target.value })} className={campo} /></F>
            <F label="Ubicación en almacén"><input aria-label="Ubicación" value={p.location} onChange={e => set({ location: e.target.value })} className={campo} placeholder="Zona B · estante 3" /></F>
            <F label="Nombre científico"><input aria-label="Nombre científico" value={p.scientificName ?? ''} onChange={e => set({ scientificName: e.target.value })} className={campo} /></F>
            <F label="Tipo de existencia (contable)" span="sm:col-span-2" ayuda="Define sus cuentas del PCGE 2026 (20 mercaderías, 21 producción propia, 24 materia prima…) y el Formato 13.1.">
              <select aria-label="Tipo de existencia" value={tipoExistenciaDe(p)} onChange={e => set({ tipoExistencia: e.target.value })} className={campo}>
                {Object.entries(TABLA_5).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
              </select>
            </F>
            <F label="Unidad de medida" ayuda="SUNAT Tabla 6">
              <select aria-label="Unidad de medida" value={p.unidadMedida ?? 'NIU'} onChange={e => set({ unidadMedida: e.target.value })} className={campo}>
                {Object.entries(TABLA_6).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
              </select>
            </F>
            {p.isLivePlant && (
              <>
                <F label="Luz"><input aria-label="Luz" value={p.careLight ?? ''} onChange={e => set({ careLight: e.target.value })} className={campo} placeholder="Luz indirecta" /></F>
                <F label="Riego"><input aria-label="Riego" value={p.careWater ?? ''} onChange={e => set({ careWater: e.target.value })} className={campo} placeholder="1 vez por semana" /></F>
                <F label="Familia botánica"><input aria-label="Familia botánica" value={p.botanicalFamily} onChange={e => set({ botanicalFamily: e.target.value })} className={campo} /></F>
              </>
            )}
          </div>
        </details>
      </div>

      <div className="flex flex-wrap gap-4 p-3 rounded-control bg-crema-200/60 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.visibleTienda !== false} onChange={e => set({ visibleTienda: e.target.checked })} /> Mostrar en la tienda</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.destacado} onChange={e => set({ destacado: e.target.checked })} /> Destacar en la portada</label>
        {existente && <a href={`/tienda/producto/${encodeURIComponent(existente.sku)}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-terracota font-bold">Ver en la tienda <ExternalLink className="w-4 h-4" aria-hidden /></a>}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-crema-300">
        <Boton variante="secundario" className="flex-1" onClick={close}>{aviso ? 'Listo' : 'Cancelar'}</Boton>
        {!existente && <Boton variante="secundario" className="flex-1" cargando={guardando} onClick={() => void guardar(true)}>Guardar y crear otro</Boton>}
        <Boton className="flex-1" cargando={guardando} onClick={() => void guardar(false)}>{existente ? 'Guardar cambios' : 'Crear producto'}</Boton>
      </div>
    </ModalShell>
  );
}
