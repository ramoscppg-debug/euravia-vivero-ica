import { useState } from 'react';
import { Printer, QrCode, ScanLine, Trash2, Truck, X } from 'lucide-react';
import { ModalShell, useDocLookup, useScanner } from '../../components/shared';
import { MEDIOS_PAGO, type ComprobanteSunat, type DescuentoGlobal, type LineaCarrito, type MedioPago, type Pago } from '../../domain/types';
import { round2 } from '../../lib/peru';
import { calcularCarrito, resumirPagos } from '../../lib/pos';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

// ============================================================
// MODAL: PUNTO DE VENTA (carrito, descuentos, pago mixto)
// ============================================================
export function PosModal({ presetSku }: { presetSku?: string }) {
  const { state, actions } = useErp();
  const { open, close } = useUi();
  const { busy, consultar } = useDocLookup();
  const { products, company, invoices, crmClients } = state;

  const [lineas, setLineas] = useState<LineaCarrito[]>(presetSku ? [{ sku: presetSku, qty: 1, descuentoPct: 0 }] : []);
  const [busqueda, setBusqueda] = useState('');
  const [descGlobal, setDescGlobal] = useState<DescuentoGlobal>({ tipo: 'PCT', valor: 0 });
  const [tipo, setTipo] = useState<'01' | '03'>('03');
  const [doc, setDoc] = useState('');
  const [clientName, setClientName] = useState('Clientes Varios');
  const [pagosManual, setPagosManual] = useState<Pago[] | null>(null); // null = cobro exacto en efectivo
  const [generarGre, setGenerarGre] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [sending, setSending] = useState(false);

  const carrito = calcularCarrito(lineas, products, descGlobal);
  const pagos = pagosManual ?? [{ medio: 'Efectivo' as MedioPago, monto: carrito.total }];
  const resumen = resumirPagos(carrito.total, pagos);
  const igv = round2(carrito.total - carrito.total / 1.18);

  const q = busqueda.trim().toLowerCase();
  const encontrados = q ? products.filter(p => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : products;

  const agregar = (sku: string) => {
    setLineas(ls => (ls.some(l => l.sku === sku) ? ls.map(l => (l.sku === sku ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { sku, qty: 1, descuentoPct: 0 }]));
    setBusqueda('');
  };
  const cambiarLinea = (sku: string, cambio: Partial<LineaCarrito>) =>
    setLineas(ls => ls.map(l => (l.sku === sku ? { ...l, ...cambio } : l)).filter(l => l.qty > 0));

  // Si el cliente ya compró antes, se completa su nombre solo
  const buscarCliente = (valor: string) => {
    setDoc(valor);
    if (valor.length !== 8 && valor.length !== 11) return;
    const previo = crmClients.find(c => c.doc === valor)?.name ?? invoices.find(i => i.cliente.numDoc === valor)?.cliente.nombreRazonSocial;
    if (previo) setClientName(previo);
    if (valor.length === 11) setTipo('01');
  };

  const setPago = (i: number, cambio: Partial<Pago>) => setPagosManual(pagos.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  const faltante = () => round2(Math.max(0, carrito.total - pagos.filter((_, j) => j !== pagos.length - 1).reduce((a, p) => a + p.monto, 0)));

  const emitir = async () => {
    setSending(true);
    const r = await actions.registrarVenta({
      lineas, descuentoGlobal: descGlobal, tipoComprobante: tipo, docIdentidad: doc, clientName, pagos, generarGre, direccionEntrega: direccion
    });
    setSending(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice, vuelto: r.vuelto });
  };

  const input = 'p-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold';

  return (
    <ModalShell size="max-w-6xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">Emitir Venta & CPE SUNAT (POS)</h3>
          <p className="text-[11px] text-[#5c7367]">Carrito con descuentos y pago mixto · descuenta Kardex, suma a caja y emite UBL 2.1 en un solo paso</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-5">
        {/* ------- Catálogo ------- */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              aria-label="Buscar o escanear producto"
              autoFocus
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && encontrados[0]) agregar(encontrados[0].sku); }}
              placeholder="🔎 Nombre o SKU · escanea y presiona Enter"
              className={`${input} flex-1 font-mono`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">
            {encontrados.map(p => {
              const enCarrito = lineas.find(l => l.sku === p.sku)?.qty ?? 0;
              const agotado = p.stock - enCarrito <= 0;
              return (
                <button
                  key={p.sku}
                  disabled={agotado}
                  onClick={() => agregar(p.sku)}
                  className="text-left p-2.5 rounded-2xl border border-[#e8e2d8] bg-white hover:border-[#d4af37] hover:shadow-md transition disabled:opacity-40 flex gap-2"
                >
                  <img src={p.fullImage} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-bold text-[#082017] truncate">{p.name}</span>
                    <span className="block font-mono text-[10px] text-[#8fa89b]">{p.sku} · stock {p.stock - enCarrito}</span>
                    <span className="block font-serif font-bold text-[#134e2e]">S/ {p.price.toFixed(2)}</span>
                  </span>
                </button>
              );
            })}
            {!encontrados.length && <p className="col-span-2 text-[#8fa89b] font-semibold">Sin coincidencias para “{busqueda}”.</p>}
          </div>
        </div>

        {/* ------- Carrito y cobro ------- */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e8e2d8] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#faf8f5] text-[10px] uppercase text-[#5c7367]">
                <tr><th className="p-2">Producto</th><th className="p-2 text-center">Cant.</th><th className="p-2 text-center">Desc. %</th><th className="p-2 text-right">Importe</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-[#f5efe6]">
                {carrito.lineas.map(l => (
                  <tr key={l.sku}>
                    <td className="p-2"><span className="font-bold text-[#082017]">{l.name}</span><span className="block text-[10px] text-[#8fa89b]">S/ {l.precioLista.toFixed(2)} c/u</span></td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <button aria-label={`Menos ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: l.qty - 1 })} className="w-6 h-6 rounded-lg bg-[#f4ede4] font-bold">−</button>
                        <input aria-label={`Cantidad ${l.sku}`} type="number" min={1} value={l.qty} onChange={e => cambiarLinea(l.sku, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className="w-12 p-1 border rounded-lg text-center font-bold" />
                        <button aria-label={`Más ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: l.qty + 1 })} className="w-6 h-6 rounded-lg bg-[#f4ede4] font-bold">+</button>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <input aria-label={`Descuento ${l.sku}`} type="number" min={0} max={100} value={l.descuentoPct} onChange={e => cambiarLinea(l.sku, { descuentoPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-14 p-1 border rounded-lg text-center" />
                    </td>
                    <td className="p-2 text-right font-mono font-bold">S/ {l.neto.toFixed(2)}</td>
                    <td className="p-2"><button aria-label={`Quitar ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: 0 })}><Trash2 className="w-4 h-4 text-[#b91c1c]" /></button></td>
                  </tr>
                ))}
                {!carrito.lineas.length && (
                  <tr><td colSpan={5} className="p-4 text-center text-[#8fa89b] font-semibold">Carrito vacío: toca un producto o escanéalo.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold block text-[#082017]">Descuento a toda la venta</label>
              <div className="flex gap-1.5">
                <select aria-label="Tipo de descuento" value={descGlobal.tipo} onChange={e => setDescGlobal({ ...descGlobal, tipo: e.target.value as DescuentoGlobal['tipo'] })} className={input}>
                  <option value="PCT">%</option>
                  <option value="MONTO">S/</option>
                </select>
                <input aria-label="Valor del descuento" type="number" min={0} value={descGlobal.valor} onChange={e => setDescGlobal({ ...descGlobal, valor: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-[#e7f5ed] border border-[#134e2e]/20 text-right space-y-0.5">
              <p className="text-[#5c7367]">Subtotal: <span className="font-mono">S/ {carrito.subtotal.toFixed(2)}</span></p>
              {carrito.descuentoTotal > 0 && <p className="text-[#b91c1c]">Descuentos: <span className="font-mono">− S/ {carrito.descuentoTotal.toFixed(2)}</span></p>}
              <p className="text-[#5c7367]">IGV incluido: <span className="font-mono">S/ {igv.toFixed(2)}</span></p>
              <p className="font-serif text-2xl font-bold text-[#082017]" aria-label="Total a cobrar">S/ {carrito.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-[110px_1fr_1.3fr] gap-2">
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Comprobante</label>
              <select aria-label="Tipo de comprobante" value={tipo} onChange={e => setTipo(e.target.value as '01' | '03')} className={`${input} w-full`}>
                <option value="03">Boleta</option>
                <option value="01">Factura</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">{tipo === '01' ? 'RUC' : 'DNI (opcional ≤ S/ 700)'}</label>
              <div className="flex gap-1">
                <input aria-label="Documento del cliente" value={doc} onChange={e => buscarCliente(e.target.value.trim())} className={`${input} w-full min-w-0 font-mono`} />
                <button type="button" disabled={busy} onClick={() => consultar(doc, setClientName)} title="Validar y consultar en SUNAT / RENIEC" className="shrink-0 px-2 rounded-xl bg-[#082017] text-[#d4af37] disabled:opacity-50">
                  <ScanLine className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Nombre / Razón social</label>
              <input aria-label="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} className={`${input} w-full`} />
            </div>
          </div>

          {/* Pagos */}
          <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#082017]">Cobro</span>
              <div className="flex gap-1.5">
                {[50, 100, 200].map(b => (
                  <button key={b} type="button" onClick={() => setPagosManual([{ medio: 'Efectivo', monto: b }])} className="px-2 py-1 rounded-lg bg-white border font-bold">S/ {b}</button>
                ))}
                <button type="button" onClick={() => setPagosManual(null)} className="px-2 py-1 rounded-lg bg-white border font-bold">Exacto</button>
                <button type="button" onClick={() => setPagosManual([...pagos, { medio: 'Yape', monto: 0 }])} className="px-2 py-1 rounded-lg bg-[#082017] text-[#d4af37] font-bold">+ Pago</button>
              </div>
            </div>
            {pagos.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select aria-label={`Medio de pago ${i + 1}`} value={p.medio} onChange={e => setPago(i, { medio: e.target.value as MedioPago })} className={`${input} bg-white`}>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input aria-label={`Monto ${i + 1}`} type="number" min={0} step="0.1" value={p.monto} onChange={e => setPago(i, { monto: Math.max(0, Number(e.target.value) || 0) })} className={`${input} bg-white w-28 font-mono`} />
                {i === pagos.length - 1 && pagos.length > 1 && (
                  <button type="button" onClick={() => setPago(i, { monto: faltante() })} className="text-[10px] font-bold text-[#134e2e] underline">completar</button>
                )}
                {pagos.length > 1 && (
                  <button type="button" aria-label={`Quitar pago ${i + 1}`} onClick={() => setPagosManual(pagos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-[#b91c1c]" /></button>
                )}
              </div>
            ))}
            <p className={`font-bold ${resumen.error ? 'text-[#b91c1c]' : 'text-[#134e2e]'}`}>
              {resumen.error ?? (resumen.vuelto > 0 ? `Vuelto: S/ ${resumen.vuelto.toFixed(2)}` : 'Cobro completo ✓')}
            </p>
          </div>

          {/* Delivery */}
          <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={generarGre} onChange={e => setGenerarGre(e.target.checked)} className="rounded text-[#082017] focus:ring-0" />
              <span className="font-semibold text-[#082017]">Generar Guía de Remisión (GRE {company.serieGre}) para Delivery</span>
              <Truck className="w-4 h-4 text-[#8fa89b]" />
            </label>
            {generarGre && (
              <input aria-label="Dirección de entrega" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección de entrega (calle, número, distrito)" className={`${input} w-full bg-white`} />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
            <button onClick={emitir} disabled={sending || !!resumen.error} className="flex-[2] py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-50">
              {sending ? 'Enviando a SUNAT...' : `Emitir Comprobante SUNAT · S/ ${carrito.total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: TICKET TÉRMICO 80MM
// ============================================================
export function TicketModal({ invoice, vuelto }: { invoice: ComprobanteSunat; vuelto?: number }) {
  const { state } = useErp();
  const { close } = useUi();
  const { company } = state;
  const titulo = invoice.tipoComprobante === '01' ? 'FACTURA ELECTRÓNICA' : invoice.tipoComprobante === '07' ? 'NOTA DE CRÉDITO ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
  return (
    <ModalShell size="max-w-sm" padding="p-6" overlay="bg-[#082017]/80" className="space-y-4 font-mono text-center">
      <div className="flex justify-between items-center pb-2 border-b">
        <span className="text-[10px] font-bold text-[#8fa89b]">COMPROBANTE ELECTRÓNICO</span>
        <button onClick={close} aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-[#082017]">{company.razonSocial}</h2>
        <p className="text-[10px]">RUC: {company.ruc}</p>
        <p className="text-[9px] text-gray-500">{company.direccion}</p>
      </div>
      <div className="border-t border-b border-dashed py-2 text-left space-y-1">
        <p className="font-bold text-center text-sm">{titulo}</p>
        <p className="text-center font-bold">{invoice.id}</p>
        {invoice.referencia && <p className="text-[10px] text-center">Modifica a: {invoice.referencia} · {invoice.motivo}</p>}
        <p className="text-[10px]">Cliente: {invoice.cliente.nombreRazonSocial}{invoice.cliente.numDoc ? ` (${invoice.cliente.numDoc})` : ''}</p>
        <div className="pt-1 space-y-0.5">
          {invoice.items.map(it => (
            <div key={it.item} className="flex justify-between text-[10px] gap-2">
              <span className="truncate">{it.cantidad} x {it.descripcion}</span>
              <span>{it.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        {!!invoice.descuentoTotal && <p className="text-[10px] text-right">Descuento aplicado: -{invoice.descuentoTotal.toFixed(2)}</p>}
        <p className="text-[10px] text-right">IGV: {invoice.totalIgv.toFixed(2)}</p>
        <p className="text-[11px] text-right font-bold">Total: S/ {invoice.montoTotal.toFixed(2)}</p>
        {invoice.pagos?.map(p => <p key={p.medio} className="text-[10px] text-right">{invoice.tipoComprobante === '07' ? 'Reembolso' : 'Pago'} {p.medio}: {p.monto.toFixed(2)}</p>)}
        {!!vuelto && <p className="text-[11px] text-right font-bold">Vuelto: S/ {vuelto.toFixed(2)}</p>}
      </div>
      <button onClick={() => { window.print(); close(); }} className="w-full py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold">
        Imprimir Ticket
      </button>
    </ModalShell>
  );
}

// ============================================================
// MODAL: GENERADOR DE ETIQUETAS QR BOTÁNICAS
// ============================================================
export function QrModal({ presetSku }: { presetSku: string }) {
  const { state } = useErp();
  const { close } = useUi();
  const scan = useScanner();
  const { products, company } = state;
  const [sku, setSku] = useState(presetSku);
  const [size, setSize] = useState<'50x30' | '70x40' | 'A4_SHEET'>('50x30');
  const [qty, setQty] = useState(1);
  const currentProd = products.find(p => p.sku === sku) || products[0];

  return (
    <ModalShell size="max-w-xl" padding="p-6" overlay="bg-[#082017]/80" className="space-y-5">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-[#134e2e]" />
          <h3 className="font-serif font-bold text-lg text-[#082017]">Generador de Etiquetas & QR Botánico</h3>
        </div>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Seleccionar Planta</label>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="w-full p-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs">
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}
          </select>
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Formato de Etiqueta</label>
          <select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className="w-full p-2 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold text-xs">
            <option value="50x30">🏷️ 50x30 mm (Maceta estándar)</option>
            <option value="70x40">🌿 70x40 mm (Estaca grande)</option>
            <option value="A4_SHEET">📄 Pliego A4 (24 stickers)</option>
          </select>
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Cantidad</label>
          <input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-bold text-xs" />
        </div>
      </div>

      {/* Vista Previa */}
      <div className="p-4 bg-[#faf8f5] border-2 border-dashed border-[#d4af37]/60 rounded-3xl flex items-center justify-center">
        <div className="w-[320px] bg-white border-2 border-[#082017] p-3.5 rounded-2xl shadow-md space-y-2 text-[#082017]">
          <div className="flex items-center justify-between border-b border-[#082017] pb-1">
            <span className="font-serif font-bold text-[11px] uppercase tracking-wider">{company.nombreComercial.split(' - ')[0]}</span>
            <span className="font-mono text-[9px] font-bold bg-[#082017] text-[#d4af37] px-1.5 py-0.5 rounded">{currentProd.sku}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-[#082017] rounded-xl flex flex-col items-center justify-center shrink-0">
              <QrCode className="w-14 h-14 text-[#082017]" />
              <span className="text-[7px] font-mono font-bold">ESCANEAR POS</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-serif font-bold text-sm truncate">{currentProd.name}</h4>
              <p className="text-[9px] text-[#8c6239] italic font-serif truncate">{currentProd.scientificName}</p>
              <p className="text-[8px] text-[#5c7367]">{currentProd.careLight} • {currentProd.careWater}</p>
            </div>
          </div>
          <div className="pt-1 border-t border-dashed flex justify-between items-center text-xs">
            <span className="font-mono text-[8px] text-gray-500 font-bold">{currentProd.location}</span>
            <span className="font-serif font-bold text-sm text-[#082017]">S/ {currentProd.price.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button onClick={() => scan(sku)} className="flex-1 py-3 rounded-2xl bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] font-bold text-xs flex items-center justify-center gap-1.5">
          <ScanLine className="w-4 h-4 text-[#134e2e]" /> Simular Escaneo en Caja
        </button>
        <button onClick={() => { window.print(); alert(`✅ Imprimiendo ${qty} etiqueta(s) térmica(s) (${size})`); }} className="flex-1 py-3 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg">
          <Printer className="w-4 h-4" /> Imprimir Etiqueta(s)
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// MODAL: REGISTRAR GASTO MENOR CAJA CHICA
// ============================================================
export function EgresoModal() {
  const { actions } = useErp();
  const { close } = useUi();
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState(15);

  const registrar = async () => {
    const r = await actions.registrarEgreso(motivo, monto);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`💵 Egreso de S/ ${monto.toFixed(2)} registrado en caja chica.`);
  };

  return (
    <ModalShell size="max-w-sm" padding="p-6">
      <div className="flex justify-between items-center pb-2 border-b">
        <h3 className="font-serif font-bold text-base text-[#082017]">Vale de Egreso - Caja Chica</h3>
        <button onClick={close}><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1">Motivo / Concepto del Gasto</label>
          <input type="text" placeholder="Ej: Pasajes chofer, compra de bolsas..." value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-semibold" />
        </div>
        <div>
          <label className="font-bold block mb-1">Monto en Efectivo (S/)</label>
          <input type="number" step="0.50" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="w-full p-2 bg-[#faf8f5] border rounded-xl font-bold font-mono" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-2 rounded-xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={registrar} className="flex-1 py-2 rounded-xl bg-[#082017] text-[#d4af37] font-bold">Registrar Egreso</button>
      </div>
    </ModalShell>
  );
}
