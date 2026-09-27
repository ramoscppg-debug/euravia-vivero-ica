import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Boton } from '../../components/ui';
import { ModalShell } from '../../components/shared';
import { SubirFoto } from '../../components/SubirFoto';
import type { CatalogProduct, Category } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const CATEGORIAS: { id: Category; nombre: string; viva: boolean }[] = [
  { id: 'interior', nombre: 'Planta de interior', viva: true },
  { id: 'exterior', nombre: 'Planta de exterior', viva: true },
  { id: 'suculentas', nombre: 'Suculentas y cactus', viva: true },
  { id: 'macetas', nombre: 'Macetas', viva: false },
  { id: 'sustratos', nombre: 'Sustratos', viva: false },
  { id: 'fertilizantes', nombre: 'Fertilizantes', viva: false },
  { id: 'accesorios', nombre: 'Accesorios', viva: false }
];

const VACIO: CatalogProduct = {
  sku: '', name: '', category: 'interior', price: 0, cost: 0, stock: 0, minStock: 5, location: '', isLivePlant: true,
  fullImage: '', description: '', botanicalFamily: '', categoryName: 'Planta de interior', visibleTienda: true, destacado: false
};

/** Campo con etiqueta (fuera del componente para que los inputs no pierdan el foco al escribir). */
function F({ label, children, span = '' }: { label: string; children: React.ReactNode; span?: string }) {
  return <label className={`block text-xs font-bold text-tinta ${span}`}>{label}<div className="mt-1">{children}</div></label>;
}

/** Ficha comercial del producto (dueño). El stock no se edita aquí: entra por compras y sale por el Kardex. */
export function FichaProductoModal({ sku }: { sku?: string }) {
  const { state, actions } = useErp();
  const { close } = useUi();
  const existente = sku ? state.products.find(p => p.sku === sku) : undefined;
  const [p, setP] = useState<CatalogProduct>(existente ?? VACIO);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<CatalogProduct>) => setP(prev => ({ ...prev, ...c }));
  const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold disabled:opacity-60';

  const guardar = async () => {
    setGuardando(true);
    const r = await actions.guardarProducto(p, !existente);
    setGuardando(false);
    if (!r.ok) alert(r.error);
    else close();
  };

  return (
    <ModalShell size="max-w-3xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">{existente ? `Editar ${existente.name}` : 'Nuevo producto'}</h3>
          <p className="text-[11px] text-tinta-suave">{existente ? `Stock actual: ${existente.stock} u. (se mueve con compras, ventas y mermas).` : 'Entra con stock 0; súmalo con una compra en Kardex.'}</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <F label="SKU"><input aria-label="SKU" disabled={!!existente} value={p.sku} onChange={e => set({ sku: e.target.value.toUpperCase() })} className={`${campo} font-mono`} placeholder="AUR-010" /></F>
        <F label="Nombre" span="sm:col-span-2"><input aria-label="Nombre del producto" value={p.name} onChange={e => set({ name: e.target.value })} className={campo} /></F>
        <F label="Categoría">
          <select aria-label="Categoría" value={p.category} onChange={e => {
            const c = CATEGORIAS.find(x => x.id === e.target.value)!;
            set({ category: c.id, isLivePlant: c.viva, categoryName: existente?.category === c.id ? p.categoryName : c.nombre });
          }} className={campo}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </F>
        <F label="Etiqueta visible"><input aria-label="Etiqueta de categoría" value={p.categoryName} onChange={e => set({ categoryName: e.target.value })} className={campo} /></F>
        <F label="Nombre científico"><input aria-label="Nombre científico" value={p.scientificName ?? ''} onChange={e => set({ scientificName: e.target.value })} className={campo} /></F>
        <F label="Precio de venta (S/, inc. IGV)"><input aria-label="Precio de venta" type="number" min={0} step="0.1" value={p.price} onChange={e => set({ price: Number(e.target.value) || 0 })} className={campo} /></F>
        <F label="Costo unitario (S/, privado)"><input aria-label="Costo unitario" type="number" min={0} step="0.1" value={p.cost} onChange={e => set({ cost: Number(e.target.value) || 0 })} className={campo} /></F>
        <F label="Stock mínimo"><input aria-label="Stock mínimo" type="number" min={0} value={p.minStock} onChange={e => set({ minStock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={campo} /></F>
        <F label="Ubicación en almacén"><input aria-label="Ubicación" value={p.location} onChange={e => set({ location: e.target.value })} className={campo} /></F>
        <div className="sm:col-span-3"><p className="text-xs font-bold text-tinta mb-1">Foto del producto</p><SubirFoto valor={p.fullImage} cambiar={url => set({ fullImage: url })} carpeta="productos" nombre={p.sku || p.name} /></div>
        <F label="Descripción para la tienda" span="sm:col-span-3"><textarea aria-label="Descripción" value={p.description} onChange={e => set({ description: e.target.value })} className={`${campo} min-h-[72px] py-2`} /></F>
        {p.isLivePlant && (
          <>
            <F label="Luz"><input aria-label="Luz" value={p.careLight ?? ''} onChange={e => set({ careLight: e.target.value })} className={campo} /></F>
            <F label="Riego"><input aria-label="Riego" value={p.careWater ?? ''} onChange={e => set({ careWater: e.target.value })} className={campo} /></F>
            <F label="Familia botánica"><input aria-label="Familia botánica" value={p.botanicalFamily} onChange={e => set({ botanicalFamily: e.target.value })} className={campo} /></F>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-4 p-3 rounded-control bg-crema-200/60 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.visibleTienda !== false} onChange={e => set({ visibleTienda: e.target.checked })} /> Mostrar en la tienda pública</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.destacado} onChange={e => set({ destacado: e.target.checked })} /> Destacar en la portada</label>
        {existente && <a href={`/tienda/producto/${encodeURIComponent(existente.sku)}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-terracota font-bold">Ver en la tienda <ExternalLink className="w-4 h-4" aria-hidden /></a>}
      </div>

      <div className="flex gap-2 pt-2 border-t border-crema-300">
        <Boton variante="secundario" className="flex-1" onClick={close}>Cancelar</Boton>
        <Boton className="flex-1" cargando={guardando} onClick={guardar}>{existente ? 'Guardar cambios' : 'Crear producto'}</Boton>
      </div>
    </ModalShell>
  );
}
