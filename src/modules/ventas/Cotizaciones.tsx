import { useState } from 'react';
import { FileText, MessageCircle, PlusCircle, Printer, ShoppingCart, Ticket, Trash2, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import type { Cotizacion, Cupon, DescuentoGlobal, LineaCarrito } from '../../domain/types';
import { calcularCarrito } from '../../lib/pos';
import { useAuth } from '../../store/AuthStore';
import { useErp } from '../../store/ErpStore';
import { imprimirDocumento } from '../../lib/documentos';
import { docDeCotizacion } from './documentosVenta';
import { useUi } from '../../store/UiStore';
import { hoyLocal, sumarDias } from '../../lib/fechas';
import { conPreciosVigentes } from '../../lib/ofertas';

const hoy = () => hoyLocal();
const ESTADO_COLOR: Record<Cotizacion['estado'], string> = {
  ENVIADA: 'bg-bosque-100 text-bosque-700',
  ACEPTADA: 'bg-oro text-tinta',
  CONVERTIDA: 'bg-bosque-950 text-oro',
  RECHAZADA: 'bg-error-fondo text-error'
};

export default function Cotizaciones() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const { cotizaciones, company } = state;
  const products = conPreciosVigentes(state.products, state.eventos, hoyLocal()); // ofertas y eventos vigentes

  const texto = (c: Cotizacion) => {
    const carrito = calcularCarrito(c.lineas, products, c.descuentoGlobal);
    const lineas = carrito.lineas.map(l => `• ${l.qty}× ${l.name}: S/ ${l.neto.toFixed(2)}`).join('\n');
    return `Hola ${c.cliente.nombre.split(' ')[0]}, te compartimos la cotización ${c.id} de ${company.nombreComercial.split(' - ')[0]} 🌿\n${lineas}\n${carrito.descuentoTotal > 0 ? `Descuento: − S/ ${carrito.descuentoTotal.toFixed(2)}\n` : ''}Total: S/ ${carrito.total.toFixed(2)} (IGV incluido)\nVálida hasta el ${c.vence}.`;
  };

  const imprimir = (c: Cotizacion) => imprimirDocumento(docDeCotizacion(state, c));

  const convertir = (c: Cotizacion) =>
    open({ type: 'pos', preset: { lineas: c.lineas, descuentoGlobal: c.descuentoGlobal, doc: c.cliente.doc, nombre: c.cliente.nombre, cotizacionId: c.id } });

  const marcar = async (id: string, estado: 'ACEPTADA' | 'RECHAZADA') => {
    const r = await actions.marcarCotizacion(id, estado);
    if (!r.ok) alert(r.error);
  };

  const abiertas = cotizaciones.filter(c => c.estado === 'ENVIADA' || c.estado === 'ACEPTADA');
  const convertidas = cotizaciones.filter(c => c.estado === 'CONVERTIDA').length;
  const cerradas = cotizaciones.filter(c => c.estado === 'CONVERTIDA' || c.estado === 'RECHAZADA').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-tinta flex items-center gap-2"><FileText className="w-5 h-5 text-bosque-700" /> Cotizaciones & Cupones</h3>
          <p className="text-xs text-tinta-suave">Cotiza, envía por WhatsApp o PDF y conviértela en venta con un clic. Cupones de descuento y puntos de fidelidad.</p>
        </div>
        <button onClick={() => open({ type: 'cotizacion' })} className="px-4 py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold text-xs flex items-center gap-1.5 shadow-md">
          <PlusCircle className="w-4 h-4" /> Nueva Cotización
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-crema-300"><span className="font-bold text-tinta-suave uppercase text-[10px]">Abiertas</span><p className="font-serif text-2xl font-bold text-tinta">{abiertas.length} · S/ {abiertas.reduce((a, c) => a + c.total, 0).toFixed(2)}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-crema-300"><span className="font-bold text-tinta-suave uppercase text-[10px]">Tasa de cierre</span><p className="font-serif text-2xl font-bold text-bosque-700">{cerradas ? Math.round((convertidas / cerradas) * 100) : 0}%</p></div>
        <div className="bg-white p-4 rounded-2xl border border-crema-300"><span className="font-bold text-tinta-suave uppercase text-[10px]">Por vencer (≤ 2 días)</span><p className="font-serif text-2xl font-bold text-[#e05780]">{abiertas.filter(c => c.vence <= sumarDias(hoyLocal(), 2)).length}</p></div>
      </div>

      <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-3 text-xs">
        {cotizaciones.map(c => {
          const vencida = (c.estado === 'ENVIADA' || c.estado === 'ACEPTADA') && c.vence < hoy();
          return (
            <article key={c.id} aria-label={`Cotización ${c.id}`} className="p-4 bg-crema rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-tinta">{c.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
                  {vencida && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-error-fondo text-error">VENCIDA</span>}
                </div>
                <p className="font-serif font-bold text-tinta text-sm mt-1">{c.cliente.nombre}</p>
                <p className="text-tinta-suave">{c.lineas.reduce((a, l) => a + l.qty, 0)} producto(s) · válida hasta {c.vence}{c.comprobanteId ? ` · venta ${c.comprobanteId}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="font-serif font-bold text-lg text-tinta mr-2">S/ {c.total.toFixed(2)}</span>
                <button onClick={() => imprimir(c)} title="Imprimir / PDF" className="p-2 rounded-xl bg-white border"><Printer className="w-4 h-4" /></button>
                {c.cliente.telefono && (
                  <a href={`https://api.whatsapp.com/send?phone=${c.cliente.telefono.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(texto(c))}`} target="_blank" rel="noreferrer" title="Enviar por WhatsApp" className="p-2 rounded-xl bg-exito-fondo text-bosque-700"><MessageCircle className="w-4 h-4" /></a>
                )}
                {(c.estado === 'ENVIADA' || c.estado === 'ACEPTADA') && (
                  <>
                    {c.estado === 'ENVIADA' && <button onClick={() => void marcar(c.id, 'ACEPTADA')} className="px-2.5 py-1.5 rounded-xl bg-white border font-bold">Aceptada</button>}
                    <button onClick={() => void marcar(c.id, 'RECHAZADA')} className="px-2.5 py-1.5 rounded-xl bg-error-fondo text-error font-bold">Rechazada</button>
                    <button onClick={() => convertir(c)} className="px-3 py-1.5 rounded-xl bg-bosque-950 text-oro font-bold flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5" /> Convertir en venta</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!cotizaciones.length && <p className="text-tinta-suave font-semibold">Todavía no hay cotizaciones.</p>}
      </div>

      <Cupones editable={rol === 'dueno'} />
    </div>
  );
}

function Cupones({ editable }: { editable: boolean }) {
  const { state, actions } = useErp();
  const [nuevo, setNuevo] = useState<Omit<Cupon, 'usos' | 'activo'>>({ codigo: '', descripcion: '', tipo: 'PCT', valor: 10, minimoCompra: 0 });
  const input = 'p-2 bg-white border border-crema-300 rounded-xl font-semibold';

  const crear = async () => {
    const r = await actions.crearCupon({ ...nuevo, vence: nuevo.vence || undefined, usosMax: nuevo.usosMax || undefined });
    if (!r.ok) alert(r.error);
    else setNuevo({ codigo: '', descripcion: '', tipo: 'PCT', valor: 10, minimoCompra: 0 });
  };

  return (
    <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-3 text-xs">
      <h4 className="font-serif font-bold text-base text-tinta flex items-center gap-2"><Ticket className="w-4 h-4 text-oro" /> Cupones de descuento</h4>
      <p className="text-tinta-suave">Se aplican en el POS. Además, cada cliente con DNI/RUC gana <b>1 punto por cada S/ 10</b> y cada punto vale <b>S/ 0.10</b> al canjearlo.</p>
      {editable && (
        <div className="grid grid-cols-2 md:grid-cols-[1fr_1.5fr_90px_90px_110px_120px_90px_auto] gap-2 p-3 bg-crema rounded-2xl border border-[#eae4dc]">
          <input aria-label="Código del cupón" value={nuevo.codigo} onChange={e => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} placeholder="CÓDIGO" className={`${input} font-mono`} />
          <input aria-label="Descripción del cupón" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Descripción" className={input} />
          <select aria-label="Tipo de cupón" value={nuevo.tipo} onChange={e => setNuevo({ ...nuevo, tipo: e.target.value as Cupon['tipo'] })} className={input}><option value="PCT">%</option><option value="MONTO">S/</option></select>
          <input aria-label="Valor del cupón" type="number" min={0} value={nuevo.valor} onChange={e => setNuevo({ ...nuevo, valor: Number(e.target.value) })} className={input} />
          <input aria-label="Compra mínima" type="number" min={0} value={nuevo.minimoCompra} onChange={e => setNuevo({ ...nuevo, minimoCompra: Number(e.target.value) })} placeholder="Mínimo S/" className={input} />
          <input aria-label="Vence" type="date" value={nuevo.vence ?? ''} onChange={e => setNuevo({ ...nuevo, vence: e.target.value })} className={input} />
          <input aria-label="Usos máximos" type="number" min={1} value={nuevo.usosMax ?? ''} onChange={e => setNuevo({ ...nuevo, usosMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Usos" className={input} />
          <button onClick={crear} className="px-3 rounded-xl bg-bosque-950 text-oro font-bold">Crear</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {state.cupones.map(c => (
          <div key={c.codigo} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${c.activo ? 'bg-bosque-50 border-exito-fondo' : 'bg-[#f3f4f6] border-[#e5e7eb] opacity-70'}`}>
            <span>
              <span className="font-mono font-bold text-tinta">{c.codigo}</span>
              <span className="font-bold text-bosque-700"> · {c.tipo === 'PCT' ? `${c.valor}%` : `S/ ${c.valor.toFixed(2)}`}</span>
              <span className="block text-[10px] text-tinta-suave">{c.descripcion}{c.minimoCompra ? ` · mín. S/ ${c.minimoCompra}` : ''}{c.vence ? ` · vence ${c.vence}` : ''} · usado {c.usos}{c.usosMax ? `/${c.usosMax}` : ''}</span>
            </span>
            {editable && (
              <button onClick={async () => { const r = await actions.activarCupon(c.codigo, !c.activo); if (!r.ok) alert(r.error); }} className="px-2.5 py-1 rounded-xl bg-white border font-bold">{c.activo ? 'Desactivar' : 'Activar'}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MODAL: NUEVA COTIZACIÓN DE PRODUCTOS
// ============================================================
export function NuevaCotizacionProductosModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const products = conPreciosVigentes(state.products, state.eventos, hoyLocal());
  const [nombre, setNombre] = useState('');
  const [doc, setDoc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [descGlobal, setDescGlobal] = useState<DescuentoGlobal>({ tipo: 'PCT', valor: 0 });
  const [dias, setDias] = useState(7);
  const [notas, setNotas] = useState('');
  const [sku, setSku] = useState(products[0]?.sku ?? '');
  const carrito = calcularCarrito(lineas, products, descGlobal);
  const input = 'w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-semibold';

  const guardar = async () => {
    const r = await actions.crearCotizacion({ cliente: { nombre, doc, telefono }, lineas, descuentoGlobal: descGlobal, diasVigencia: dias, notas });
    if (!r.ok) alert(r.error);
    else close();
  };

  return (
    <ModalShell size="max-w-2xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <h3 className="font-serif font-bold text-lg text-tinta">Nueva Cotización</h3>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input aria-label="Cliente" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Cliente" className={input} />
        <input aria-label="DNI o RUC" value={doc} onChange={e => setDoc(e.target.value.trim())} placeholder="DNI / RUC (opcional)" className={`${input} font-mono`} />
        <input aria-label="WhatsApp" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="WhatsApp" className={input} />
      </div>
      <div className="p-3 bg-crema rounded-2xl border border-[#eae4dc] space-y-2">
        <div className="flex gap-2">
          <select aria-label="Producto" value={sku} onChange={e => setSku(e.target.value)} className={`${input} bg-white`}>
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} — S/ {p.price.toFixed(2)}</option>)}
          </select>
          <button type="button" onClick={() => setLineas(ls => (ls.some(l => l.sku === sku) ? ls.map(l => (l.sku === sku ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { sku, qty: 1, descuentoPct: 0 }]))} className="shrink-0 px-3 rounded-xl bg-bosque-950 text-oro font-bold">+ Agregar</button>
        </div>
        {carrito.lineas.map(l => (
          <div key={l.sku} className="flex items-center gap-2">
            <span className="flex-1 font-semibold text-tinta">{l.name}</span>
            <input aria-label={`Cantidad ${l.sku}`} type="number" min={1} value={l.qty} onChange={e => setLineas(ls => ls.map(x => (x.sku === l.sku ? { ...x, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))} className="w-16 p-1.5 bg-white border rounded-lg text-center font-bold" />
            <input aria-label={`Descuento ${l.sku}`} type="number" min={0} max={100} value={l.descuentoPct} onChange={e => setLineas(ls => ls.map(x => (x.sku === l.sku ? { ...x, descuentoPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x)))} className="w-14 p-1.5 bg-white border rounded-lg text-center" />
            <span className="w-24 text-right font-mono">S/ {l.neto.toFixed(2)}</span>
            <button type="button" aria-label={`Quitar ${l.sku}`} onClick={() => setLineas(ls => ls.filter(x => x.sku !== l.sku))}><Trash2 className="w-4 h-4 text-error" /></button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="font-bold block mb-1">Descuento extra</span>
          <div className="flex gap-1"><select aria-label="Tipo de descuento" value={descGlobal.tipo} onChange={e => setDescGlobal({ ...descGlobal, tipo: e.target.value as DescuentoGlobal['tipo'] })} className={input}><option value="PCT">%</option><option value="MONTO">S/</option></select>
          <input aria-label="Valor del descuento" type="number" min={0} value={descGlobal.valor} onChange={e => setDescGlobal({ ...descGlobal, valor: Math.max(0, Number(e.target.value) || 0) })} className={input} /></div>
        </label>
        <label className="block"><span className="font-bold block mb-1">Vigencia (días)</span><input aria-label="Vigencia" type="number" min={1} value={dias} onChange={e => setDias(Math.max(1, Number(e.target.value) || 1))} className={input} /></label>
        <div className="text-right"><span className="text-[10px] text-tinta-suave uppercase font-bold block">Total</span><span className="font-serif text-2xl font-bold text-tinta" aria-label="Total cotizado">S/ {carrito.total.toFixed(2)}</span></div>
      </div>
      <input aria-label="Notas" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas para el cliente (opcional)" className={input} />
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={guardar} className="flex-1 py-3 rounded-2xl bg-bosque-950 text-oro font-bold">Guardar Cotización</button>
      </div>
    </ModalShell>
  );
}
