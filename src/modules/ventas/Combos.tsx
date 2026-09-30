// ==========================================
// COMBOS (planta + maceta + sustrato…)
// Se venden como uno en la tienda; al registrarse el pedido se separan en sus productos
// con el precio repartido, así el stock, el Kardex y la contabilidad siguen igual.
// ==========================================
import { useState } from 'react';
import { EyeOff, Plus, Save, Trash2 } from 'lucide-react';
import { SubirFoto } from '../../components/SubirFoto';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import type { Combo } from '../../domain/types';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';

const campo = 'w-full min-h-[40px] px-3 rounded-control border border-crema-300 bg-white text-sm';

export default function Combos() {
  const { state } = useErp();
  const [editando, setEditando] = useState<Combo | null>(null);
  const siguiente = () => {
    const n = Math.max(0, ...state.combos.map(c => Number(c.codigo.replace(/\D/g, '')) || 0)) + 1;
    return `CMB-${String(n).padStart(3, '0')}`;
  };
  const precioLista = (c: Combo) => c.items.reduce((a, i) => a + i.cantidad * (state.products.find(p => p.sku === i.sku)?.price ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave max-w-2xl">Arma combos con precio especial (IGV incluido). En la tienda salen en la sección <b>Combos</b> y, al registrarse el pedido, se separan en sus productos para el stock y la contabilidad.</p>
        <Boton onClick={() => setEditando({ codigo: siguiente(), nombre: '', precio: 0, items: [{ sku: '', cantidad: 1 }, { sku: '', cantidad: 1 }], visible: true, orden: state.combos.length + 1 })}>
          <Plus className="w-4 h-4" aria-hidden /> Nuevo combo
        </Boton>
      </div>

      {editando && <FormCombo inicial={editando} cerrar={() => setEditando(null)} nuevo={!state.combos.some(c => c.codigo === editando.codigo)} />}

      {state.combos.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.combos.map(c => {
            const lista = precioLista(c);
            return (
              <Tarjeta as="article" key={c.codigo} className="p-4 space-y-2 text-sm">
                <div className="flex gap-3">
                  {c.imagen ? <img src={c.imagen} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <span className="w-16 h-16 rounded-xl bg-crema-200" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-tinta">{c.nombre}</p>
                    <p className="text-[11px] font-mono text-tinta-suave">{c.codigo}</p>
                    <p className="font-extrabold">{soles(c.precio)} {lista > c.precio && <span className="text-xs font-semibold text-exito">ahorra {soles(lista - c.precio)}</span>}</p>
                  </div>
                  {!c.visible && <Insignia><EyeOff className="w-3 h-3" aria-hidden /> oculto</Insignia>}
                </div>
                <ul className="text-xs text-tinta-suave">{c.items.map(i => <li key={i.sku}>• {i.cantidad} × {state.products.find(p => p.sku === i.sku)?.name ?? i.sku}</li>)}</ul>
                <Boton tamano="sm" variante="secundario" onClick={() => setEditando(c)}>Editar</Boton>
              </Tarjeta>
            );
          })}
        </div>
      ) : !editando && <Tarjeta><EstadoVacio titulo="Aún no hay combos" detalle="Ejemplo: Monstera + maceta + sustrato con un precio especial." /></Tarjeta>}
    </div>
  );
}

function FormCombo({ inicial, cerrar, nuevo }: { inicial: Combo; cerrar: () => void; nuevo: boolean }) {
  const { state, actions } = useErp();
  const [c, setC] = useState<Combo>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (cambio: Partial<Combo>) => setC(prev => ({ ...prev, ...cambio }));
  const setItem = (i: number, cambio: Partial<Combo['items'][number]>) => set({ items: c.items.map((x, j) => (j === i ? { ...x, ...cambio } : x)) });
  const lista = c.items.reduce((a, i) => a + i.cantidad * (state.products.find(p => p.sku === i.sku)?.price ?? 0), 0);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const r = await actions.guardarCombo(c);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    cerrar();
  };

  return (
    <Tarjeta as="section" className="p-5 space-y-3 text-sm">
      <p className="font-extrabold text-tinta">{nuevo ? 'Nuevo combo' : `Editar ${c.codigo}`}</p>
      <div className="grid sm:grid-cols-[140px_1fr_140px] gap-2">
        <input aria-label="Código del combo" value={c.codigo} disabled={!nuevo} onChange={e => set({ codigo: e.target.value.toUpperCase() })} className={`${campo} font-mono`} />
        <input aria-label="Nombre del combo" placeholder="Ej. Kit Monstera lista para tu sala" value={c.nombre} onChange={e => set({ nombre: e.target.value })} maxLength={120} className={campo} />
        <input aria-label="Precio del combo" type="number" min={0} step="0.5" placeholder="Precio S/" value={c.precio || ''} onChange={e => set({ precio: Number(e.target.value) || 0 })} className={campo} />
      </div>
      <textarea aria-label="Descripción del combo" placeholder="Qué incluye y para quién es ideal" value={c.descripcion ?? ''} onChange={e => set({ descripcion: e.target.value })} className={`${campo} min-h-[70px] py-2`} />
      <div className="space-y-2">
        {c.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-2">
            <select aria-label={`Producto ${i + 1} del combo`} value={it.sku} onChange={e => setItem(i, { sku: e.target.value })} className={campo}>
              <option value="">Elige un producto</option>
              {state.products.map(p => <option key={p.sku} value={p.sku}>{p.name} — {soles(p.price)} (stock {p.stock})</option>)}
            </select>
            <input aria-label={`Cantidad del producto ${i + 1}`} type="number" min={1} step={1} value={it.cantidad} onChange={e => setItem(i, { cantidad: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={campo} />
            <button type="button" aria-label={`Quitar producto ${i + 1}`} onClick={() => set({ items: c.items.filter((_, j) => j !== i) })} className="px-2 rounded-control bg-error-fondo text-error"><Trash2 className="w-4 h-4" aria-hidden /></button>
          </div>
        ))}
        <Boton tamano="sm" variante="secundario" onClick={() => set({ items: [...c.items, { sku: '', cantidad: 1 }] })}><Plus className="w-4 h-4" aria-hidden /> Agregar producto</Boton>
      </div>
      <p className="text-xs text-tinta-suave">Precio por separado: <b>{soles(lista)}</b>{c.precio > 0 && lista > 0 && <> · descuento del combo: <b>{Math.round((1 - c.precio / lista) * 100)}%</b></>}</p>
      <SubirFoto valor={c.imagen} cambiar={url => set({ imagen: url || undefined })} carpeta="combos" nombre={c.codigo} />
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={c.visible} onChange={e => set({ visible: e.target.checked })} /> Visible en la tienda</label>
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      <div className="flex gap-2">
        <Boton cargando={guardando} onClick={() => void guardar()}><Save className="w-4 h-4" aria-hidden /> Guardar combo</Boton>
        <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
      </div>
    </Tarjeta>
  );
}
