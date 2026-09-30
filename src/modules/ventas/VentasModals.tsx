import { useState } from 'react';
import { Camera, QrCode, ScanLine, Trash2, Truck, X } from 'lucide-react';
import { ModalShell, useDocLookup } from '../../components/shared';
import { camaraDisponible, EscanerCamara } from '../../components/EscanerCamara';
import { esc, imprimirTicket, qrSvg, skuDeLectura } from '../../lib/documentos';
import { GeneradorEtiquetas } from '../inventario/Etiquetas';
import { CATEGORIAS_GASTO } from '../../lib/contabilidad';
import { AccionesEmision, porEmitir } from '../admin/Emision';
import { MEDIOS_PAGO, type ComprobanteSunat, type DescuentoGlobal, type LineaCarrito, type MedioPago, type Pago } from '../../domain/types';
import { round2 } from '../../lib/peru';
import { VALOR_PUNTO } from '../../lib/fidelidad';
import { calcularCarrito, resumirPagos } from '../../lib/pos';
import { aplicarPromociones } from '../../store/ErpStore';
import type { PosPreset } from '../../store/UiStore';
import { useErp } from '../../store/ErpStore';
import { hoyLocal } from '../../lib/fechas';
import { conPreciosVigentes } from '../../lib/ofertas';
import { useUi } from '../../store/UiStore';

// ============================================================
// MODAL: PUNTO DE VENTA (carrito, descuentos, pago mixto)
// ============================================================
export function PosModal({ presetSku, preset }: { presetSku?: string; preset?: PosPreset }) {
  const { state, actions } = useErp();
  const { open, close } = useUi();
  const { busy, consultar } = useDocLookup();
  const { company, invoices, crmClients, puntosSaldo } = state;
  const products = conPreciosVigentes(state.products, state.eventos, hoyLocal()); // ofertas y eventos vigentes

  const [lineas, setLineas] = useState<LineaCarrito[]>(preset?.lineas ?? (presetSku ? [{ sku: presetSku, qty: 1, descuentoPct: 0 }] : []));
  const [busqueda, setBusqueda] = useState('');
  const [descGlobal, setDescGlobal] = useState<DescuentoGlobal>(preset?.descuentoGlobal ?? { tipo: 'PCT', valor: 0 });
  const [tipo, setTipo] = useState<'01' | '03'>(preset?.doc?.length === 11 ? '01' : '03');
  const [doc, setDoc] = useState(preset?.doc ?? '');
  const [clientName, setClientName] = useState(preset?.nombre ?? 'Clientes Varios');
  const [cuponTexto, setCuponTexto] = useState('');
  const [cupon, setCupon] = useState<string | undefined>();
  const [puntos, setPuntos] = useState(0);
  const [pagosManual, setPagosManual] = useState<Pago[] | null>(null); // null = cobro exacto en efectivo
  const [generarGre, setGenerarGre] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [sending, setSending] = useState(false);

  // Descuento manual + cupón + puntos (misma regla que valida el servidor)
  const promo = aplicarPromociones(lineas, descGlobal, cupon, puntos, state);
  const carrito = promo.ok ? promo.carrito : calcularCarrito(lineas, products, descGlobal);
  const saldoPuntos = puntosSaldo[doc] ?? 0;
  const pagos = pagosManual ?? [{ medio: 'Efectivo' as MedioPago, monto: carrito.total }];
  const resumen = resumirPagos(carrito.total, pagos);
  const igv = round2(carrito.total - carrito.total / 1.18);

  const [camara, setCamara] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const q = busqueda.trim().toLowerCase();
  const encontrados = q ? products.filter(p => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : products;

  /** Un escáner (USB o cámara) entrega el SKU o el enlace de la etiqueta QR: se suma una unidad. */
  const leerCodigo = (lectura: string): boolean => {
    const sku = skuDeLectura(lectura);
    const texto = lectura.toUpperCase();
    // Si el teclado del lector cambió algún símbolo del enlace, igual se reconoce el SKU dentro del texto
    const prod = products.find(p => p.sku.toUpperCase() === sku) ?? [...products].sort((a, b) => b.sku.length - a.sku.length).find(p => texto.includes(p.sku.toUpperCase()));
    if (!prod) {
      setAviso(`No se encontró el código "${lectura.slice(0, 40)}"`);
      return false;
    }
    agregar(prod.sku);
    setAviso(`+1 ${prod.name}`);
    return true;
  };

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
      lineas, descuentoGlobal: descGlobal, tipoComprobante: tipo, docIdentidad: doc, clientName, pagos, generarGre, direccionEntrega: direccion,
      cupon, puntosCanjear: puntos, cotizacionId: preset?.cotizacionId
    });
    setSending(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice, vuelto: r.vuelto });
  };

  const input = 'p-2 bg-crema border border-crema-300 rounded-xl font-semibold';

  return (
    <ModalShell size="max-w-6xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">Emitir Venta & CPE SUNAT (POS)</h3>
          <p className="text-[11px] text-tinta-suave">Carrito con descuentos y pago mixto · descuenta Kardex, suma a caja y emite UBL 2.1 en un solo paso</p>
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
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
              onKeyDown={e => {
                if (e.key !== 'Enter' || !busqueda.trim()) return;
                if (!leerCodigo(busqueda) && encontrados[0]) agregar(encontrados[0].sku);
                setBusqueda('');
              }}
              placeholder="🔎 Nombre o SKU · escanea y presiona Enter"
              className={`${input} flex-1 font-mono`}
            />
            {camaraDisponible() && (
              <button type="button" onClick={() => setCamara(c => !c)} className={`px-3 rounded-xl font-bold text-xs flex items-center gap-1 ${camara ? 'bg-bosque-950 text-oro' : 'bg-crema-200 text-tinta'}`} aria-pressed={camara}>
                <Camera className="w-4 h-4" aria-hidden /> Cámara
              </button>
            )}
          </div>
          {camara && <EscanerCamara alLeer={leerCodigo} cerrar={() => setCamara(false)} />}
          {aviso && <p role="status" className="text-xs font-bold text-bosque-700">{aviso}</p>}
          <div className="grid grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">
            {encontrados.map(p => {
              const enCarrito = lineas.find(l => l.sku === p.sku)?.qty ?? 0;
              const agotado = p.stock - enCarrito <= 0;
              return (
                <button
                  key={p.sku}
                  disabled={agotado}
                  onClick={() => agregar(p.sku)}
                  className="text-left p-2.5 rounded-2xl border border-crema-300 bg-white hover:border-oro hover:shadow-md transition disabled:opacity-40 flex gap-2"
                >
                  <img src={p.fullImage} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-bold text-tinta truncate">{p.name}</span>
                    <span className="block font-mono text-[10px] text-tinta-suave">{p.sku} · stock {p.stock - enCarrito}</span>
                    <span className="block font-serif font-bold text-bosque-700">S/ {p.price.toFixed(2)}{(state.products.find(x => x.sku === p.sku)?.price ?? p.price) > p.price && <span className="ml-1 text-[10px] font-sans text-terracota">oferta</span>}</span>
                  </span>
                </button>
              );
            })}
            {!encontrados.length && <p className="col-span-2 text-tinta-suave font-semibold">Sin coincidencias para “{busqueda}”.</p>}
          </div>
        </div>

        {/* ------- Carrito y cobro ------- */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-crema-300 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-crema text-[10px] uppercase text-tinta-suave">
                <tr><th className="p-2">Producto</th><th className="p-2 text-center">Cant.</th><th className="p-2 text-center">Desc. %</th><th className="p-2 text-right">Importe</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {carrito.lineas.map(l => (
                  <tr key={l.sku}>
                    <td className="p-2"><span className="font-bold text-tinta">{l.name}</span><span className="block text-[10px] text-tinta-suave">S/ {l.precioLista.toFixed(2)} c/u</span></td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <button aria-label={`Menos ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: l.qty - 1 })} className="w-6 h-6 rounded-lg bg-crema-200 font-bold">−</button>
                        <input aria-label={`Cantidad ${l.sku}`} type="number" min={1} value={l.qty} onChange={e => cambiarLinea(l.sku, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className="w-12 p-1 border rounded-lg text-center font-bold" />
                        <button aria-label={`Más ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: l.qty + 1 })} className="w-6 h-6 rounded-lg bg-crema-200 font-bold">+</button>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <input aria-label={`Descuento ${l.sku}`} type="number" min={0} max={100} value={l.descuentoPct} onChange={e => cambiarLinea(l.sku, { descuentoPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-14 p-1 border rounded-lg text-center" />
                    </td>
                    <td className="p-2 text-right font-mono font-bold">S/ {l.neto.toFixed(2)}</td>
                    <td className="p-2"><button aria-label={`Quitar ${l.sku}`} onClick={() => cambiarLinea(l.sku, { qty: 0 })}><Trash2 className="w-4 h-4 text-error" /></button></td>
                  </tr>
                ))}
                {!carrito.lineas.length && (
                  <tr><td colSpan={5} className="p-4 text-center text-tinta-suave font-semibold">Carrito vacío: toca un producto o escanéalo.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold block text-tinta">Descuento a toda la venta</label>
              <div className="flex gap-1.5">
                <select aria-label="Tipo de descuento" value={descGlobal.tipo} onChange={e => setDescGlobal({ ...descGlobal, tipo: e.target.value as DescuentoGlobal['tipo'] })} className={input}>
                  <option value="PCT">%</option>
                  <option value="MONTO">S/</option>
                </select>
                <input aria-label="Valor del descuento" type="number" min={0} value={descGlobal.valor} onChange={e => setDescGlobal({ ...descGlobal, valor: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-full`} />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-bosque-100 border border-bosque-700/20 text-right space-y-0.5">
              <p className="text-tinta-suave">Subtotal: <span className="font-mono">S/ {carrito.subtotal.toFixed(2)}</span></p>
              {carrito.descuentoTotal > 0 && <p className="text-error">Descuentos: <span className="font-mono">− S/ {carrito.descuentoTotal.toFixed(2)}</span></p>}
              <p className="text-tinta-suave">IGV incluido: <span className="font-mono">S/ {igv.toFixed(2)}</span></p>
              {doc && carrito.total > 0 && <p className="text-[10px] text-bosque-700">Ganará {Math.floor(carrito.total / 10)} puntos</p>}
              <p className="font-serif text-2xl font-bold text-tinta" aria-label="Total a cobrar">S/ {carrito.total.toFixed(2)}</p>
            </div>
          </div>

          {/* Cupón y puntos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1 text-tinta">Cupón</label>
              <div className="flex gap-1.5">
                <input aria-label="Código de cupón" value={cupon ?? cuponTexto} disabled={!!cupon} onChange={e => setCuponTexto(e.target.value.toUpperCase())} placeholder="Ej: BIENVENIDA10" className={`${input} w-full min-w-0 font-mono uppercase`} />
                {cupon
                  ? <button type="button" onClick={() => { setCupon(undefined); setCuponTexto(''); }} className="shrink-0 px-2 rounded-xl bg-error-fondo text-error font-bold">Quitar</button>
                  : <button type="button" onClick={() => {
                      const r = aplicarPromociones(lineas, descGlobal, cuponTexto, 0, state);
                      if (!r.ok) alert(r.error); else setCupon(cuponTexto.trim().toUpperCase());
                    }} className="shrink-0 px-2 rounded-xl bg-bosque-950 text-oro font-bold">Aplicar</button>}
              </div>
              {cupon && promo.ok && promo.cupon && <p className="text-[10px] font-bold text-bosque-700 mt-1">✓ {cupon}: − S/ {promo.cupon.descuento.toFixed(2)}</p>}
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Puntos {saldoPuntos > 0 ? `(tiene ${saldoPuntos} = S/ ${(saldoPuntos * VALOR_PUNTO).toFixed(2)})` : ''}</label>
              <input aria-label="Puntos a canjear" type="number" min={0} max={saldoPuntos} disabled={saldoPuntos <= 0} value={puntos} onChange={e => setPuntos(Math.min(saldoPuntos, Math.max(0, Math.floor(Number(e.target.value) || 0))))} className={`${input} w-full`} />
              {!promo.ok && <p className="text-[10px] font-bold text-error mt-1">{promo.error}</p>}
            </div>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-[110px_1fr_1.3fr] gap-2">
            <div>
              <label className="font-bold block mb-1 text-tinta">Comprobante</label>
              <select aria-label="Tipo de comprobante" value={tipo} onChange={e => setTipo(e.target.value as '01' | '03')} className={`${input} w-full`}>
                <option value="03">Boleta</option>
                <option value="01">Factura</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">{tipo === '01' ? 'RUC' : 'DNI (opcional ≤ S/ 700)'}</label>
              <div className="flex gap-1">
                <input aria-label="Documento del cliente" value={doc} onChange={e => buscarCliente(e.target.value.trim())} className={`${input} w-full min-w-0 font-mono`} />
                <button type="button" disabled={busy} onClick={() => consultar(doc, setClientName)} title="Validar y consultar en SUNAT / RENIEC" className="shrink-0 px-2 rounded-xl bg-bosque-950 text-oro disabled:opacity-50">
                  <ScanLine className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Nombre / Razón social</label>
              <input aria-label="Nombre del cliente" value={clientName} onChange={e => setClientName(e.target.value)} className={`${input} w-full`} />
            </div>
          </div>

          {/* Pagos */}
          <div className="p-3 bg-crema rounded-2xl border border-[#eae4dc] space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-tinta">Cobro</span>
              <div className="flex gap-1.5">
                {[50, 100, 200].map(b => (
                  <button key={b} type="button" onClick={() => setPagosManual([{ medio: 'Efectivo', monto: b }])} className="px-2 py-1 rounded-lg bg-white border font-bold">S/ {b}</button>
                ))}
                <button type="button" onClick={() => setPagosManual(null)} className="px-2 py-1 rounded-lg bg-white border font-bold">Exacto</button>
                <button type="button" onClick={() => setPagosManual([...pagos, { medio: 'Yape', monto: 0 }])} className="px-2 py-1 rounded-lg bg-bosque-950 text-oro font-bold">+ Pago</button>
              </div>
            </div>
            {pagos.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select aria-label={`Medio de pago ${i + 1}`} value={p.medio} onChange={e => setPago(i, { medio: e.target.value as MedioPago })} className={`${input} bg-white`}>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input aria-label={`Monto ${i + 1}`} type="number" min={0} step="0.1" value={p.monto} onChange={e => setPago(i, { monto: Math.max(0, Number(e.target.value) || 0) })} className={`${input} bg-white w-28 font-mono`} />
                {i === pagos.length - 1 && pagos.length > 1 && (
                  <button type="button" onClick={() => setPago(i, { monto: faltante() })} className="text-[10px] font-bold text-bosque-700 underline">completar</button>
                )}
                {pagos.length > 1 && (
                  <button type="button" aria-label={`Quitar pago ${i + 1}`} onClick={() => setPagosManual(pagos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-error" /></button>
                )}
              </div>
            ))}
            <p className={`font-bold ${resumen.error ? 'text-error' : 'text-bosque-700'}`}>
              {resumen.error ?? (resumen.vuelto > 0 ? `Vuelto: S/ ${resumen.vuelto.toFixed(2)}` : 'Cobro completo ✓')}
            </p>
          </div>

          {/* Delivery */}
          <div className="p-3 bg-crema rounded-2xl border border-[#eae4dc] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={generarGre} onChange={e => setGenerarGre(e.target.checked)} className="rounded text-tinta focus:ring-0" />
              <span className="font-semibold text-tinta">Generar Guía de Remisión (GRE {company.serieGre}) para Delivery</span>
              <Truck className="w-4 h-4 text-tinta-suave" />
            </label>
            {generarGre && (
              <input aria-label="Dirección de entrega" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección de entrega (calle, número, distrito)" className={`${input} w-full bg-white`} />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-tinta-suave">Cancelar</button>
            <button onClick={emitir} disabled={sending || !!resumen.error || !promo.ok} className="flex-[2] py-3 rounded-2xl bg-bosque-950 text-oro font-bold shadow-lg disabled:opacity-50">
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
    <ModalShell size="max-w-sm" padding="p-6" overlay="bg-bosque-950/80" className="space-y-4 font-mono text-center">
      <div className="flex justify-between items-center pb-2 border-b">
        <span className="text-[10px] font-bold text-tinta-suave">COMPROBANTE ELECTRÓNICO{porEmitir(invoice) ? ' · POR EMITIR EN SUNAT' : ''}</span>
        <button onClick={close} aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-tinta">{company.razonSocial}</h2>
        <p className="text-[10px]">RUC: {company.ruc}</p>
        <p className="text-[9px] text-gray-500">{company.direccion}</p>
      </div>
      <div className="border-t border-b border-dashed py-2 text-left space-y-1">
        <p className="font-bold text-center text-sm">{titulo}</p>
        <p className="text-center font-bold">{invoice.numeroSunat ?? invoice.id}{porEmitir(invoice) && <span className="block text-[9px] font-normal text-aviso">N° sugerido · emítelo en SUNAT y anota el número real</span>}</p>
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
        {invoice.cupon && <p className="text-[10px] text-right">Cupón: {invoice.cupon}</p>}
        {!!invoice.puntosCanjeados && <p className="text-[10px] text-right">Puntos canjeados: {invoice.puntosCanjeados}</p>}
        {!!invoice.puntosGanados && invoice.puntosGanados > 0 && <p className="text-[10px] text-right">Puntos ganados: {invoice.puntosGanados}</p>}
      </div>
      {invoice.tipoComprobante !== 'NV' && (
        <div className="p-3 rounded-2xl bg-crema text-left font-sans">
          <p className="text-[11px] font-bold text-tinta mb-2">{porEmitir(invoice) ? 'Emítelo en SUNAT y envíaselo al cliente por WhatsApp' : 'Comprobante emitido'}</p>
          <AccionesEmision inv={invoice} />
        </div>
      )}
      <button onClick={() => { imprimirTicket(ticketHtml(invoice, company, titulo, vuelto), invoice.id); close(); }} className="w-full py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold">
        {porEmitir(invoice) ? 'Imprimir nota de venta' : 'Imprimir Ticket'}
      </button>
    </ModalShell>
  );
}

// ============================================================
// MODAL: GENERADOR DE ETIQUETAS QR BOTÁNICAS
// ============================================================
export function QrModal({ presetSku }: { presetSku: string }) {
  const { close } = useUi();
  return (
    <ModalShell size="max-w-4xl" padding="p-6" overlay="bg-bosque-950/80" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <h3 className="font-serif font-bold text-lg text-tinta flex items-center gap-2"><QrCode className="w-5 h-5 text-bosque-700" aria-hidden /> Etiquetas QR</h3>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <GeneradorEtiquetas presetSku={presetSku} />
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
  const [cuenta, setCuenta] = useState('63112');

  const registrar = async () => {
    const r = await actions.registrarEgreso(motivo, monto, cuenta);
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
        <h3 className="font-serif font-bold text-base text-tinta">Vale de Egreso - Caja Chica</h3>
        <button onClick={close}><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="font-bold block mb-1">Motivo / Concepto del Gasto</label>
          <input type="text" placeholder="Ej: Pasajes chofer, compra de bolsas..." value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full p-2 bg-crema border rounded-xl font-semibold" />
        </div>
        <div>
          <label className="font-bold block mb-1">Categoría (cuenta PCGE)</label>
          <select aria-label="Categoría del vale" value={cuenta} onChange={e => setCuenta(e.target.value)} className="w-full p-2 bg-crema border rounded-xl font-semibold">
            {CATEGORIAS_GASTO.map(c => <option key={c.cuenta} value={c.cuenta}>{c.nombre} · {c.cuenta}</option>)}
          </select>
        </div>
        <div>
          <label className="font-bold block mb-1">Monto en Efectivo (S/)</label>
          <input type="number" step="0.50" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="w-full p-2 bg-crema border rounded-xl font-bold font-mono" />
        </div>
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-2 rounded-xl border font-bold text-tinta-suave">Cancelar</button>
        <button onClick={registrar} className="flex-1 py-2 rounded-xl bg-bosque-950 text-oro font-bold">Registrar Egreso</button>
      </div>
    </ModalShell>
  );
}

/** Representación impresa del comprobante (80 mm) con el QR de SUNAT: RUC|tipo|serie|número|IGV|total|fecha|tipo doc|n° doc. */
function ticketHtml(inv: ComprobanteSunat, company: { razonSocial: string; ruc: string; direccion: string; pieDePaginaTicket: string }, titulo: string, vuelto?: number): string {
  const pendiente = !inv.numeroSunat && inv.estadoSunat === 'PENDIENTE';
  if (pendiente) titulo = 'NOTA DE VENTA';
  const [serie, numero] = (inv.numeroSunat ?? inv.id).split('-');
  const qr = pendiente ? '' : qrSvg([company.ruc, inv.tipoComprobante, serie, numero, inv.totalIgv.toFixed(2), inv.montoTotal.toFixed(2), inv.fechaEmision, inv.cliente.tipoDoc, inv.cliente.numDoc].join('|'));
  const fila = (a: string, b: string, fuerte = false) => `<div style="display:flex;justify-content:space-between;gap:6px${fuerte ? ';font-weight:800' : ''}"><span>${a}</span><span>${b}</span></div>`;
  return `<div style="text-align:center"><b style="font-size:13px">${esc(company.razonSocial)}</b><div>RUC ${esc(company.ruc)}</div><div>${esc(company.direccion)}</div></div>
    <hr style="border:0;border-top:1px dashed #000"><div style="text-align:center;font-weight:800">${esc(titulo)}<br>${pendiente ? `Venta ${esc(inv.id)}` : esc(inv.numeroSunat ?? inv.id)}</div>
    <div>Fecha: ${esc(inv.fechaEmision)} ${esc(inv.horaEmision ?? '')}</div><div>Cliente: ${esc(inv.cliente.nombreRazonSocial)}${inv.cliente.numDoc ? ` (${esc(inv.cliente.numDoc)})` : ''}</div>
    ${inv.referencia ? `<div>Modifica a: ${esc(inv.referencia)} · ${esc(inv.motivo ?? '')}</div>` : ''}
    <hr style="border:0;border-top:1px dashed #000">${inv.items.map(it => fila(`${it.cantidad} x ${esc(it.descripcion)}`, it.total.toFixed(2))).join('')}
    <hr style="border:0;border-top:1px dashed #000">
    ${inv.descuentoTotal ? fila('Descuento', `-${inv.descuentoTotal.toFixed(2)}`) : ''}${fila('Op. gravada', inv.opGravadas.toFixed(2))}${fila('IGV 18%', inv.totalIgv.toFixed(2))}${fila('TOTAL S/', inv.montoTotal.toFixed(2), true)}
    ${(inv.pagos ?? []).map(p => fila(`${inv.tipoComprobante === '07' ? 'Reembolso' : 'Pago'} ${esc(p.medio)}`, p.monto.toFixed(2))).join('')}${vuelto ? fila('Vuelto', vuelto.toFixed(2), true) : ''}
    ${pendiente ? '<div style="text-align:center;margin-top:8px;font-weight:700">Su comprobante electrónico se le enviará por WhatsApp en el transcurso del día.</div>' : `<div style="width:30mm;margin:8px auto">${qr}</div><div style="text-align:center;font-size:9px">Representación impresa de la ${esc(titulo.toLowerCase())}</div>`}
    ${company.pieDePaginaTicket ? `<div style="text-align:center;margin-top:6px">${esc(company.pieDePaginaTicket)}</div>` : ''}`;
}
