import { useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, ClipboardList, Image, MapPin, MessageCircle, PlusCircle, Receipt, Trash2, Truck, X, XCircle } from 'lucide-react';
import { ModalShell, useDocLookup } from '../../components/shared';
import { CANALES_VENTA, MEDIOS_PAGO, type CanalVenta, type EstadoPedido, type MedioPago, type Pago, type Pedido, type PedidoItem } from '../../domain/types';
import { round2 } from '../../lib/peru';
import { resumirPagos } from '../../lib/pos';
import { urlEvidencia } from '../../lib/repo';
import { reservadoEnPedidos, useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { hoyLocal } from '../../lib/fechas';

const COLUMNAS: { estado: EstadoPedido; titulo: string; color: string }[] = [
  { estado: 'pendiente', titulo: 'Por cobrar', color: 'border-t-[#e05780]' },
  { estado: 'pagado', titulo: 'Pagado', color: 'border-t-[#d4af37]' },
  { estado: 'preparando', titulo: 'Preparando', color: 'border-t-[#8fa89b]' },
  { estado: 'en-reparto', titulo: 'En ruta', color: 'border-t-[#134e2e]' },
  { estado: 'entregado', titulo: 'Entregado', color: 'border-t-[#082017]' }
];

const hoy = () => hoyLocal();

/** Mensaje de WhatsApp listo según el estado del pedido. */
function mensajeWhatsapp(p: Pedido): string {
  const saludo = `Hola ${p.cliente.nombre.split(' ')[0]}, te escribimos de AUREVIA 🌿.`;
  switch (p.estado) {
    case 'pendiente': return `${saludo} Tu pedido ${p.id} suma S/ ${p.total.toFixed(2)}. Puedes pagar por Yape o Plin y te enviamos el comprobante.`;
    case 'pagado':
    case 'preparando': return `${saludo} Recibimos tu pago del pedido ${p.id}. Lo estamos preparando para el ${p.fechaEntrega}${p.franja ? ` (${p.franja})` : ''}.`;
    case 'en-reparto': return `${saludo} Tu pedido ${p.id} ya está en camino${p.repartidor ? ` con ${p.repartidor.split(' ')[0]}` : ''}. ¡Pronto llega!`;
    default: return `${saludo} Tu pedido ${p.id} fue entregado. ¡Gracias por cultivar vida con nosotros!`;
  }
}

export default function Pedidos() {
  const { state, actions, nube } = useErp();
  const { open } = useUi();
  const [verCancelados, setVerCancelados] = useState(false);
  const { pedidos } = state;

  const mover = async (id: string, estado: EstadoPedido, extra: { repartidor?: string } = {}) => {
    const r = await actions.moverPedido(id, estado, extra);
    if (!r.ok) alert(r.error);
  };

  const asignarRuta = (p: Pedido) => {
    const repartidor = prompt(`¿Quién lleva el pedido ${p.id}?`, p.repartidor ?? 'Raúl Morales Alva');
    if (repartidor !== null) void mover(p.id, 'en-reparto', { repartidor });
  };

  const verFoto = async (p: Pedido) => {
    if (!p.fotoEvidencia) return;
    if (!nube) {
      alert(`📷 Evidencia registrada: ${p.fotoEvidencia}\n(En modo demo las fotos no se guardan.)`);
      return;
    }
    try {
      window.open(await urlEvidencia(p.fotoEvidencia), '_blank');
    } catch (e) {
      alert(`No se pudo abrir la foto: ${e instanceof Error ? e.message : e}`);
    }
  };

  const activos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
  const porCobrar = pedidos.filter(p => p.estado === 'pendiente').reduce((a, p) => a + p.total, 0);
  const paraHoy = activos.filter(p => p.fechaEntrega <= hoy()).length;
  const cancelados = pedidos.filter(p => p.estado === 'cancelado');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017] flex items-center gap-2"><ClipboardList className="w-5 h-5 text-[#134e2e]" /> Pedidos & Delivery</h3>
          <p className="text-xs text-[#5c7367]">Pedidos por WhatsApp, redes y web: cobro con comprobante → preparación → reparto → entrega con foto</p>
        </div>
        <button onClick={() => open({ type: 'pedido-nuevo' })} className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md">
          <PlusCircle className="w-4 h-4" /> Nuevo Pedido
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Pedidos activos</span><p className="font-serif text-2xl font-bold text-[#082017]">{activos.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Por cobrar</span><p className="font-serif text-2xl font-bold text-[#e05780]">S/ {porCobrar.toFixed(2)}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Entregas para hoy o atrasadas</span><p className="font-serif text-2xl font-bold text-[#134e2e]">{paraHoy}</p></div>
      </div>

      {/* Tablero */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {COLUMNAS.map(col => {
          const lista = pedidos.filter(p => p.estado === col.estado);
          return (
            <section key={col.estado} aria-label={`Columna ${col.titulo}`} className={`bg-[#f4ede4]/60 rounded-3xl p-3 space-y-3 border-t-4 ${col.color}`}>
              <h4 className="font-serif font-bold text-sm text-[#082017] flex justify-between px-1">
                {col.titulo} <span className="text-[#8fa89b] font-sans">{lista.length}</span>
              </h4>
              {lista.map(p => {
                const atrasado = p.estado !== 'entregado' && p.fechaEntrega < hoy();
                return (
                  <article key={p.id} aria-label={`Pedido ${p.id}`} className="bg-white rounded-2xl border border-[#e8e2d8] p-3 space-y-2 text-xs shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono font-bold text-[10px] text-[#8fa89b]">{p.id}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#e7f5ed] text-[#134e2e]">{p.canal}</span>
                    </div>
                    <p className="font-serif font-bold text-[#082017] text-sm leading-tight">{p.cliente.nombre}</p>
                    <p className="text-[#5c7367] flex gap-1"><MapPin className="w-3.5 h-3.5 shrink-0 text-[#d4af37]" /> {[p.direccion, p.distrito].filter(Boolean).join(', ')}</p>
                    <p className={`font-semibold ${atrasado ? 'text-[#b91c1c]' : 'text-[#5c7367]'}`}>
                      📅 {p.fechaEntrega}{p.franja ? ` · ${p.franja}` : ''}{atrasado ? ' · atrasado' : ''}
                    </p>
                    <ul className="text-[#082017]">
                      {p.items.map(it => <li key={it.sku}>• {it.qty}× {it.name}</li>)}
                      {p.costoDelivery > 0 && <li className="text-[#5c7367]">• Delivery S/ {p.costoDelivery.toFixed(2)}</li>}
                    </ul>
                    <p className="font-serif font-bold text-base text-[#082017]">S/ {p.total.toFixed(2)}</p>
                    {p.comprobanteId && <p className="font-mono text-[10px] text-[#134e2e]">✅ {p.comprobanteId}{p.metodoPago ? ` · ${p.metodoPago}` : ''}</p>}
                    {p.repartidor && <p className="text-[10px] text-[#5c7367]">🚚 {p.repartidor}</p>}
                    {p.notas && <p className="text-[10px] italic text-[#8c6239]">“{p.notas}”</p>}

                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#f0eae1]">
                      {p.estado === 'pendiente' && (
                        <>
                          <button onClick={() => open({ type: 'pedido-cobro', pedido: p })} className="flex-1 px-2 py-1.5 rounded-xl bg-[#082017] text-[#d4af37] font-bold flex items-center justify-center gap-1"><Receipt className="w-3.5 h-3.5" /> Cobrar</button>
                          <button onClick={() => { if (confirm(`¿Cancelar el pedido ${p.id}?`)) void mover(p.id, 'cancelado'); }} title="Cancelar pedido" className="px-2 py-1.5 rounded-xl bg-[#fee2e2] text-[#b91c1c]"><XCircle className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      {p.estado === 'pagado' && (
                        <button onClick={() => void mover(p.id, 'preparando')} className="flex-1 px-2 py-1.5 rounded-xl bg-[#082017] text-[#d4af37] font-bold">Preparar</button>
                      )}
                      {p.estado === 'preparando' && (
                        <>
                          <button onClick={() => void mover(p.id, 'pagado')} title="Volver a Pagado" className="px-2 py-1.5 rounded-xl bg-[#f4ede4]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                          <button onClick={() => asignarRuta(p)} className="flex-1 px-2 py-1.5 rounded-xl bg-[#082017] text-[#d4af37] font-bold flex items-center justify-center gap-1"><Truck className="w-3.5 h-3.5" /> Enviar</button>
                        </>
                      )}
                      {p.estado === 'en-reparto' && (
                        <>
                          <button onClick={() => void mover(p.id, 'preparando')} title="Volver a Preparando" className="px-2 py-1.5 rounded-xl bg-[#f4ede4]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                          <button onClick={() => open({ type: 'pedido-entrega', pedido: p })} className="flex-1 px-2 py-1.5 rounded-xl bg-[#134e2e] text-white font-bold flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Entregado</button>
                        </>
                      )}
                      {p.estado === 'entregado' && p.fotoEvidencia && (
                        <button onClick={() => void verFoto(p)} className="flex-1 px-2 py-1.5 rounded-xl bg-[#f4ede4] font-bold flex items-center justify-center gap-1"><Image className="w-3.5 h-3.5" /> Ver foto</button>
                      )}
                      {p.cliente.telefono && (
                        <a
                          href={`https://api.whatsapp.com/send?phone=${p.cliente.telefono.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(mensajeWhatsapp(p))}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Avisar por WhatsApp"
                          className="px-2 py-1.5 rounded-xl bg-[#dcfce7] text-[#134e2e]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
              {!lista.length && <p className="text-[10px] text-[#8fa89b] text-center py-3">Sin pedidos</p>}
            </section>
          );
        })}
      </div>

      {cancelados.length > 0 && (
        <div className="text-xs">
          <button onClick={() => setVerCancelados(v => !v)} className="font-bold text-[#8fa89b] underline">{verCancelados ? 'Ocultar' : 'Ver'} {cancelados.length} pedido(s) cancelado(s)</button>
          {verCancelados && (
            <ul className="mt-2 space-y-1 text-[#8fa89b]">
              {cancelados.map(p => <li key={p.id} className="font-mono">{p.id} · {p.cliente.nombre} · S/ {p.total.toFixed(2)}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODAL: NUEVO PEDIDO
// ============================================================
export function NuevoPedidoModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const { products, pedidos } = state;
  const reservado = reservadoEnPedidos(pedidos);

  const [canal, setCanal] = useState<CanalVenta>('WhatsApp');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [doc, setDoc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [distrito, setDistrito] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(hoy());
  const [franja, setFranja] = useState('09:00 - 13:00');
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [costoDelivery, setCostoDelivery] = useState(10);
  const [notas, setNotas] = useState('');
  const [skuNuevo, setSkuNuevo] = useState(products[0]?.sku ?? '');
  const [enviando, setEnviando] = useState(false);

  const total = round2(items.reduce((a, it) => a + it.qty * it.unitPrice, 0) + costoDelivery);
  const libre = (sku: string) => (products.find(p => p.sku === sku)?.stock ?? 0) - (reservado.get(sku) ?? 0);

  const agregar = () => {
    const p = products.find(x => x.sku === skuNuevo);
    if (!p) return;
    setItems(its => (its.some(i => i.sku === p.sku) ? its.map(i => (i.sku === p.sku ? { ...i, qty: i.qty + 1 } : i)) : [...its, { sku: p.sku, name: p.name, qty: 1, unitPrice: p.price }]));
  };

  const guardar = async () => {
    setEnviando(true);
    const r = await actions.crearPedido({
      canal, cliente: { nombre, telefono, doc }, direccion, distrito, referencia, fechaEntrega, franja, items, costoDelivery, notas
    });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
  };

  const input = 'w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold';
  const campo = (label: string, el: React.ReactNode, span = '') => (
    <label className={`block ${span}`}><span className="font-bold block mb-1 text-[#082017]">{label}</span>{el}</label>
  );

  return (
    <ModalShell size="max-w-3xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">Nuevo Pedido</h3>
          <p className="text-[11px] text-[#5c7367]">El stock se reserva ahora y se descuenta al cobrar.</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {campo('Canal', <select aria-label="Canal" value={canal} onChange={e => setCanal(e.target.value as CanalVenta)} className={input}>{CANALES_VENTA.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
        {campo('Cliente', <input aria-label="Nombre del cliente" value={nombre} onChange={e => setNombre(e.target.value)} className={input} />)}
        {campo('WhatsApp / Teléfono', <input aria-label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+51 9..." className={input} />)}
        {campo('Dirección de entrega', <input aria-label="Dirección de entrega" value={direccion} onChange={e => setDireccion(e.target.value)} className={input} />, 'sm:col-span-2')}
        {campo('Distrito', <input aria-label="Distrito" value={distrito} onChange={e => setDistrito(e.target.value)} className={input} />)}
        {campo('Referencia', <input aria-label="Referencia" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" className={input} />, 'sm:col-span-2')}
        {campo('DNI / RUC (opcional)', <input aria-label="Documento" value={doc} onChange={e => setDoc(e.target.value.trim())} className={`${input} font-mono`} />)}
        {campo('Fecha de entrega', <input aria-label="Fecha de entrega" type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className={input} />)}
        {campo('Horario', <select aria-label="Horario" value={franja} onChange={e => setFranja(e.target.value)} className={input}>{['09:00 - 13:00', '13:00 - 17:00', '15:00 - 19:00', 'Coordinar'].map(f => <option key={f}>{f}</option>)}</select>)}
        {campo('Costo de delivery (S/)', <input aria-label="Costo de delivery" type="number" min={0} step="0.5" value={costoDelivery} onChange={e => setCostoDelivery(Math.max(0, Number(e.target.value) || 0))} className={input} />)}
      </div>

      <div className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
        <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Productos</span>
        <div className="flex gap-2">
          <select aria-label="Producto" value={skuNuevo} onChange={e => setSkuNuevo(e.target.value)} className={`${input} bg-white`}>
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} — S/ {p.price.toFixed(2)} (libres {libre(p.sku)})</option>)}
          </select>
          <button type="button" onClick={agregar} className="shrink-0 px-3 rounded-xl bg-[#082017] text-[#d4af37] font-bold">+ Agregar</button>
        </div>
        {items.map(it => (
          <div key={it.sku} className="flex items-center gap-2 text-[#082017]">
            <span className="flex-1">{it.name}</span>
            <input aria-label={`Cantidad ${it.sku}`} type="number" min={1} value={it.qty} onChange={e => setItems(its => its.map(x => (x.sku === it.sku ? { ...x, qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : x)))} className="w-16 p-1.5 bg-white border rounded-lg font-bold text-center" />
            <span className="w-24 text-right font-mono">S/ {(it.qty * it.unitPrice).toFixed(2)}</span>
            <button type="button" aria-label={`Quitar ${it.sku}`} onClick={() => setItems(its => its.filter(x => x.sku !== it.sku))}><Trash2 className="w-4 h-4 text-[#b91c1c]" /></button>
          </div>
        ))}
      </div>

      {campo('Notas internas', <input aria-label="Notas" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: tarjeta de regalo, llamar antes de llegar" className={input} />)}

      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <span className="font-serif text-2xl font-bold text-[#082017]" aria-label="Total del pedido">S/ {total.toFixed(2)}</span>
        <div className="flex gap-2">
          <button onClick={close} className="px-5 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
          <button onClick={guardar} disabled={enviando} className="px-5 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-60">{enviando ? 'Guardando...' : 'Guardar Pedido'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: COBRAR PEDIDO (emite comprobante y descuenta stock)
// ============================================================
export function CobroPedidoModal({ pedido }: { pedido: Pedido }) {
  const { actions } = useErp();
  const { open, close } = useUi();
  const { busy, consultar } = useDocLookup();
  const [tipo, setTipo] = useState<'01' | '03'>(pedido.cliente.doc?.length === 11 ? '01' : '03');
  const [doc, setDoc] = useState(pedido.cliente.doc ?? '');
  const [nombre, setNombre] = useState(pedido.cliente.nombre);
  const [pagos, setPagos] = useState<Pago[]>([{ medio: 'Yape', monto: pedido.total }]);
  const [generarGre, setGenerarGre] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const resumen = resumirPagos(pedido.total, pagos);

  const cobrar = async () => {
    setEnviando(true);
    const r = await actions.cobrarPedido({ pedidoId: pedido.id, tipoComprobante: tipo, docIdentidad: doc, clientName: nombre, pagos, generarGre });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice, vuelto: r.vuelto });
  };

  const input = 'p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold';

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">Cobrar pedido {pedido.id}</h3>
          <p className="text-[11px] text-[#5c7367]">{pedido.cliente.nombre} · S/ {pedido.total.toFixed(2)}{pedido.costoDelivery > 0 ? ` (incluye delivery S/ ${pedido.costoDelivery.toFixed(2)})` : ''}</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-[110px_1fr] gap-2">
        <select aria-label="Tipo de comprobante" value={tipo} onChange={e => setTipo(e.target.value as '01' | '03')} className={input}>
          <option value="03">Boleta</option>
          <option value="01">Factura</option>
        </select>
        <div className="flex gap-1">
          <input aria-label="Documento del cliente" value={doc} onChange={e => setDoc(e.target.value.trim())} placeholder={tipo === '01' ? 'RUC' : 'DNI (opcional ≤ S/ 700)'} className={`${input} w-full min-w-0 font-mono`} />
          <button type="button" disabled={busy} onClick={() => consultar(doc, setNombre)} className="shrink-0 px-3 rounded-xl bg-[#082017] text-[#d4af37] font-bold text-[10px] disabled:opacity-50">Consultar</button>
        </div>
      </div>
      <input aria-label="Nombre del cliente" value={nombre} onChange={e => setNombre(e.target.value)} className={`${input} w-full`} />

      <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
        {pagos.map((p, i) => (
          <div key={i} className="flex gap-2">
            <select aria-label={`Medio de pago ${i + 1}`} value={p.medio} onChange={e => setPagos(pagos.map((x, j) => (j === i ? { ...x, medio: e.target.value as MedioPago } : x)))} className={`${input} bg-white`}>
              {MEDIOS_PAGO.map(m => <option key={m}>{m}</option>)}
            </select>
            <input aria-label={`Monto ${i + 1}`} type="number" min={0} step="0.1" value={p.monto} onChange={e => setPagos(pagos.map((x, j) => (j === i ? { ...x, monto: Math.max(0, Number(e.target.value) || 0) } : x)))} className={`${input} bg-white w-28 font-mono`} />
            {pagos.length > 1 && <button type="button" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-[#b91c1c]" /></button>}
          </div>
        ))}
        <div className="flex justify-between items-center">
          <button type="button" onClick={() => setPagos([...pagos, { medio: 'Efectivo', monto: resumen.falta }])} className="text-[10px] font-bold underline text-[#134e2e]">+ otro medio de pago</button>
          <span className={`font-bold ${resumen.error ? 'text-[#b91c1c]' : 'text-[#134e2e]'}`}>{resumen.error ?? (resumen.vuelto > 0 ? `Vuelto S/ ${resumen.vuelto.toFixed(2)}` : 'Cobro completo ✓')}</span>
        </div>
      </div>

      <label className="flex items-center gap-2 p-3 bg-[#faf8f5] rounded-xl border border-[#eae4dc] cursor-pointer">
        <input type="checkbox" checked={generarGre} onChange={e => setGenerarGre(e.target.checked)} />
        <span className="font-semibold text-[#082017]">Emitir Guía de Remisión para el despacho</span>
      </label>

      <div className="flex gap-2 pt-3 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={cobrar} disabled={enviando || !!resumen.error} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-50">
          {enviando ? 'Enviando a SUNAT...' : `Cobrar y emitir · S/ ${pedido.total.toFixed(2)}`}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: CONFIRMAR ENTREGA (con foto de evidencia)
// ============================================================
export function EntregaPedidoModal({ pedido }: { pedido: Pedido }) {
  const { actions } = useErp();
  const { close } = useUi();
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    const r = await actions.entregarPedido(pedido.id, foto ?? undefined);
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
  };

  return (
    <ModalShell size="max-w-sm" padding="p-6">
      <div className="flex justify-between items-center pb-2 border-b">
        <h3 className="font-serif font-bold text-base text-[#082017]">Confirmar entrega · {pedido.id}</h3>
        <button onClick={close} aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-[#5c7367]">{pedido.cliente.nombre} · {[pedido.direccion, pedido.distrito].filter(Boolean).join(', ')}</p>
      <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-[#d4af37]/60 rounded-2xl cursor-pointer bg-[#faf8f5]">
        <Camera className="w-6 h-6 text-[#134e2e]" />
        <span className="font-bold text-[#082017]">{foto ? foto.name : 'Tomar o subir foto de la entrega'}</span>
        <span className="text-[10px] text-[#8fa89b]">JPG, PNG o WEBP · máx. 5 MB · opcional</span>
        <input aria-label="Foto de evidencia" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-2.5 rounded-xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={confirmar} disabled={enviando} className="flex-1 py-2.5 rounded-xl bg-[#134e2e] text-white font-bold disabled:opacity-60">{enviando ? 'Guardando...' : 'Marcar entregado'}</button>
      </div>
    </ModalShell>
  );
}
