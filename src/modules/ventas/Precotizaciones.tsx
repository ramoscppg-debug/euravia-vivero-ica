// ==========================================
// PRE-COTIZACIONES
// Armado con la estructura del modelo (unidad, afectación, valor venta, IGV por ítem), opción de considerar
// el IGV (boleta o factura), PDF, envío por WhatsApp con enlace para el cliente y aceptación con adelanto.
// ==========================================
import { useState } from 'react';
import { CheckCircle2, FileDown, MessageCircle, Plus, Save, Trash2, X } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { MEDIOS_PAGO, type MedioPago } from '../../domain/types';
import { imprimirHtml } from '../../lib/documentos';
import { hoyLocal } from '../../lib/fechas';
import { soles } from '../../lib/formato';
import {
  AFECTACIONES, calcularPrecotizacion, condicionesBase, empresaDoc, ESTILO_PRECOTIZACION, htmlPrecotizacion, mensajeComprobante, mensajePrecotizacion, NOMBRE_CPE, pagado, saldo, seEliminaEl, UNIDADES,
  type ComprobantePrecotizacion, type LineaPrecotizacion, type Precotizacion
} from '../../lib/precotizacion';
import { useErp } from '../../store/ErpStore';
import { enlaceWa } from '../clientes/Recordatorios';

const campo = 'w-full min-h-[38px] px-2 rounded-control border border-crema-300 bg-white text-sm';
const TONO: Record<Precotizacion['estado'], 'neutro' | 'aviso' | 'exito' | 'error' | 'marca'> = { BORRADOR: 'neutro', ENVIADA: 'aviso', ACEPTADA: 'marca', PAGADA: 'exito', RECHAZADA: 'error' };
const lineaVacia = (): LineaPrecotizacion => ({ concepto: '', unidad: 'UND', cantidad: 1, precio: 0, afectacion: 'GRAVADO' });
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function Precotizaciones() {
  const { state } = useErp();
  const [editando, setEditando] = useState<Precotizacion | null>(null);
  const nueva = (): Precotizacion => ({
    id: `nueva-${Date.now()}`, numero: '', token: '', fecha: hoyLocal(), validezDias: 15, cliente: { nombre: '' }, conIgv: true,
    lineas: [lineaVacia()], condiciones: condicionesBase(true, 15), opGravadas: 0, opExoneradas: 0, opInafectas: 0, igv: 0, total: 0, estado: 'BORRADOR', pagos: [], comprobantes: []
  });

  if (editando) return <Editor inicial={editando} cerrar={() => setEditando(null)} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave max-w-2xl">Arma la cotización con el detalle por ítem (unidad, afectación, valor de venta e IGV), envíala por WhatsApp con un enlace para que el cliente la vea y descargue, y cuando la apruebe regístrala con su adelanto. Las que no se aceptan se eliminan a los 20 días.</p>
        <Boton onClick={() => setEditando(nueva())}><Plus className="w-4 h-4" aria-hidden /> Nueva pre-cotización</Boton>
      </div>
      {state.precotizaciones.length
        ? <div className="grid gap-3 lg:grid-cols-2">{state.precotizaciones.map(c => <Tarjeta_ key={c.id} c={c} editar={() => setEditando(c)} />)}</div>
        : <Tarjeta><EstadoVacio titulo="Aún no hay pre-cotizaciones" detalle="Crea la primera con el botón Nueva pre-cotización." /></Tarjeta>}
    </div>
  );
}

function useAccionesPrecotizacion(c: Precotizacion) {
  const { state, actions } = useErp();
  const empresa = state.company.nombreComercial?.split(' - ')[0] || state.company.razonSocial || 'AUREVIA';
  const pdf = (x: Precotizacion) => imprimirHtml(`Pre-cotización ${x.numero}`, htmlPrecotizacion(x, empresaDoc(state.company, state.tiendaConfig)), ESTILO_PRECOTIZACION);
  const whatsapp = async (x: Precotizacion): Promise<string | null> => {
    let enviada = x;
    if (x.estado === 'BORRADOR') {
      const r = await actions.guardarPrecotizacion({ ...x, estado: 'ENVIADA' });
      if (!r.ok) return r.error;
      enviada = r.precotizacion;
    }
    const texto = mensajePrecotizacion(enviada, empresa, `${window.location.origin}/tienda/cotizacion/${enviada.token}`);
    const url = enlaceWa(enviada.cliente.telefono ?? '', texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener');
    return null;
  };
  /** Envía el comprobante (enlace de Drive) al WhatsApp del cliente y lo marca como enviado. */
  const enviarComprobante = async (x: Precotizacion, cp: ComprobantePrecotizacion) => {
    const texto = mensajeComprobante(x, cp, empresa);
    window.open(enlaceWa(x.cliente.telefono ?? '', texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    const r = await actions.marcarComprobantePrecotizacionEnviado(x.id, cp.numero);
    return r.ok ? null : r.error;
  };
  return { pdf, whatsapp, enviarComprobante, actions, c };
}

function Tarjeta_({ c, editar }: { c: Precotizacion; editar: () => void }) {
  const { pdf, whatsapp, enviarComprobante, actions } = useAccionesPrecotizacion(c);
  const [cpe, setCpe] = useState<{ tipo: '01' | '03'; numero: string; url: string } | null>(null);
  const agregarCpe = async () => {
    if (!cpe) return;
    setError(null);
    const r = await actions.agregarComprobantePrecotizacion(c.id, { ...cpe, fecha: hoyLocal() });
    if (!r.ok) return setError(r.error);
    setCpe(null);
  };
  const [pago, setPago] = useState<{ monto: string; medio: MedioPago; operacion: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pag = pagado(c);
  const pendiente = saldo(c);
  const abierta = c.estado === 'ENVIADA' || c.estado === 'ACEPTADA' || c.estado === 'BORRADOR';

  const registrar = async () => {
    if (!pago) return;
    setOcupado(true); setError(null);
    const r = await actions.registrarPagoPrecotizacion(c.id, Number(pago.monto), pago.medio, pago.operacion);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setPago(null);
  };

  return (
    <Tarjeta as="article" className="p-4 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span><b className="text-tinta">{c.numero}</b> · {c.cliente.nombre}<span className="block text-xs text-tinta-suave">{c.fecha} · {c.lineas.length} ítem(s) · {c.conIgv ? 'con IGV' : 'sin IGV'}</span></span>
        <Insignia tono={TONO[c.estado]}>{c.estado}</Insignia>
      </div>
      {seEliminaEl(c) && <p className="text-[11px] text-aviso font-bold">Si no se acepta, se elimina el {seEliminaEl(c)}</p>}
      <p className="flex flex-wrap gap-x-4"><span>Total <b>{soles(c.total)}</b></span>{pag > 0 && <span>Pagado <b className="text-exito">{soles(pag)}</b></span>}{pag > 0 && pendiente > 0 && <span>Saldo <b className="text-error">{soles(pendiente)}</b></span>}</p>
      <div className="flex flex-wrap gap-2">
        {(c.estado === 'BORRADOR' || c.estado === 'ENVIADA') && <Boton tamano="sm" variante="secundario" onClick={editar}>Editar</Boton>}
        <Boton tamano="sm" variante="secundario" onClick={() => pdf(c)}><FileDown className="w-4 h-4" aria-hidden /> PDF</Boton>
        {abierta && <Boton tamano="sm" variante="secundario" onClick={() => void whatsapp(c).then(e => setError(e))}><MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp</Boton>}
        {(c.estado === 'ENVIADA' || c.estado === 'ACEPTADA') && !pago && (
          <Boton tamano="sm" onClick={() => setPago({ monto: String(pag ? pendiente : r2(c.total / 2)), medio: 'Transferencia', operacion: '' })}>
            <CheckCircle2 className="w-4 h-4" aria-hidden /> {pag ? 'Registrar pago' : 'Aceptar con adelanto'}
          </Boton>
        )}
        {c.estado === 'ENVIADA' && <Boton tamano="sm" variante="fantasma" onClick={() => void actions.guardarPrecotizacion({ ...c, estado: 'RECHAZADA' })}>Rechazada</Boton>}
      </div>
      {pago && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-control bg-crema-50 border border-crema-200">
          <label className="text-xs font-bold">{pag ? 'Pago' : 'Adelanto'} (S/)<input aria-label={`Monto del pago de ${c.numero}`} type="number" min={0} step="0.1" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} className={`${campo} w-28 mt-1`} /></label>
          <label className="text-xs font-bold">Medio<select aria-label={`Medio del pago de ${c.numero}`} value={pago.medio} onChange={e => setPago({ ...pago, medio: e.target.value as MedioPago })} className={`${campo} mt-1`}>{MEDIOS_PAGO.map(m => <option key={m}>{m}</option>)}</select></label>
          {pago.medio !== 'Efectivo' && <label className="text-xs font-bold">N° operación<input aria-label={`Operación del pago de ${c.numero}`} value={pago.operacion} onChange={e => setPago({ ...pago, operacion: e.target.value })} className={`${campo} w-32 mt-1`} /></label>}
          <Boton tamano="sm" cargando={ocupado} onClick={() => void registrar()}>Confirmar</Boton>
          <button aria-label="Cancelar pago" onClick={() => setPago(null)} className="p-2"><X className="w-4 h-4" /></button>
        </div>
      )}
      {c.pagos.length > 0 && <ul className="text-xs text-tinta-suave">{c.pagos.map((p, i) => <li key={i}>{p.fecha} · {i === 0 ? 'Adelanto' : 'Pago'} {soles(p.monto)} · {p.medio}{p.operacion ? ` op. ${p.operacion}` : ''}</li>)}</ul>}

      {/* Comprobantes emitidos en el portal SUNAT (control): número y enlace del PDF */}
      {(c.estado === 'ACEPTADA' || c.estado === 'PAGADA' || c.comprobantes.length > 0) && (
        <div aria-label={`Comprobantes de ${c.numero}`} className="pt-2 border-t border-crema-200 space-y-1.5">
          {c.comprobantes.map(cp => (
            <div key={cp.numero} className="flex flex-wrap items-center gap-2 text-xs">
              <a href={cp.url} target="_blank" rel="noreferrer" className="font-bold text-bosque-700 underline">{NOMBRE_CPE[cp.tipo]} {cp.numero}</a>
              {cp.enviadoAt ? <Insignia tono="exito">enviado {cp.enviadoAt.slice(0, 10)}</Insignia> : <Insignia tono="aviso">por enviar</Insignia>}
              <Boton tamano="sm" variante="secundario" onClick={() => void enviarComprobante(c, cp).then(e => setError(e))}><MessageCircle className="w-4 h-4" aria-hidden /> Enviar al cliente</Boton>
            </div>
          ))}
          {!c.comprobantes.length && !cpe && <p className="text-xs text-aviso font-bold">Falta registrar el comprobante emitido en SUNAT.</p>}
          {cpe ? (
            <div className="flex flex-wrap items-end gap-2">
              <select aria-label={`Tipo de comprobante de ${c.numero}`} value={cpe.tipo} onChange={e => setCpe({ ...cpe, tipo: e.target.value as '01' | '03' })} className={`${campo} w-28`}><option value="01">Factura</option><option value="03">Boleta</option></select>
              <input aria-label={`Número del comprobante de ${c.numero}`} placeholder="F001-245" value={cpe.numero} onChange={e => setCpe({ ...cpe, numero: e.target.value.toUpperCase() })} className={`${campo} w-32 font-mono`} />
              <input aria-label={`Enlace del comprobante de ${c.numero}`} placeholder="Enlace de Drive del PDF" value={cpe.url} onChange={e => setCpe({ ...cpe, url: e.target.value })} className={`${campo} flex-1 min-w-[200px]`} />
              <Boton tamano="sm" onClick={() => void agregarCpe()}>Guardar</Boton>
              <button aria-label="Cancelar comprobante" onClick={() => setCpe(null)} className="p-2"><X className="w-4 h-4" /></button>
            </div>
          ) : <Boton tamano="sm" variante="secundario" onClick={() => setCpe({ tipo: c.cliente.doc?.length === 11 ? '01' : '03', numero: '', url: '' })}><Plus className="w-4 h-4" aria-hidden /> Registrar comprobante emitido</Boton>}
        </div>
      )}
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
    </Tarjeta>
  );
}

function Editor({ inicial, cerrar }: { inicial: Precotizacion; cerrar: () => void }) {
  const { state, actions } = useErp();
  const [c, setC] = useState<Precotizacion>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const { pdf, whatsapp } = useAccionesPrecotizacion(c);
  const calc = calcularPrecotizacion(c.lineas.filter(l => l.concepto.trim()), c.conIgv);
  const set = (cambio: Partial<Precotizacion>) => setC(prev => ({ ...prev, ...cambio }));
  const setLinea = (i: number, cambio: Partial<LineaPrecotizacion>) => set({ lineas: c.lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)) });
  const hayExonerados = c.lineas.some(l => l.afectacion === 'EXONERADO');

  /** Al escribir el nombre de un producto del catálogo, toma su precio sin IGV. */
  const elegirConcepto = (i: number, texto: string) => {
    const p = state.products.find(x => x.name.toLowerCase() === texto.trim().toLowerCase());
    setLinea(i, p ? { concepto: p.name, sku: p.sku, unidad: c.lineas[i].unidad || 'UND', precio: r2(p.price / 1.18), afectacion: 'GRAVADO' } : { concepto: texto, sku: undefined });
  };
  const guardar = async (estado?: Precotizacion['estado']) => {
    setGuardando(true); setError(null);
    const r = await actions.guardarPrecotizacion({ ...c, estado: estado ?? c.estado });
    setGuardando(false);
    if (!r.ok) { setError(r.error); return null; }
    setC(r.precotizacion);
    return r.precotizacion;
  };

  return (
    <Tarjeta as="section" className="p-5 space-y-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-tinta text-base">{c.numero ? `Pre-cotización ${c.numero}` : 'Nueva pre-cotización'}</h3>
        <button onClick={cerrar} aria-label="Cerrar editor" className="p-1.5"><X className="w-5 h-5" /></button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input aria-label="Cliente de la pre-cotización" placeholder="Cliente *" value={c.cliente.nombre} onChange={e => set({ cliente: { ...c.cliente, nombre: e.target.value } })} className={campo} />
        <input aria-label="DNI o RUC del cliente" placeholder="DNI o RUC" inputMode="numeric" value={c.cliente.doc ?? ''} onChange={e => set({ cliente: { ...c.cliente, doc: e.target.value.replace(/\D/g, '').slice(0, 11) } })} className={`${campo} font-mono`} />
        <input aria-label="WhatsApp del cliente" placeholder="WhatsApp (9 dígitos)" value={c.cliente.telefono ?? ''} onChange={e => set({ cliente: { ...c.cliente, telefono: e.target.value } })} className={campo} />
        <input aria-label="Dirección del cliente" placeholder="Dirección / obra" value={c.cliente.direccion ?? ''} onChange={e => set({ cliente: { ...c.cliente, direccion: e.target.value } })} className={campo} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 font-bold p-2 rounded-control border border-bosque-200 bg-bosque-50">
          <input type="checkbox" checked={c.conIgv} onChange={e => set({ conIgv: e.target.checked, condiciones: condicionesBase(e.target.checked, c.validezDias, hayExonerados) })} />
          Considerar IGV (el cliente pide boleta o factura)
        </label>
        <label className="flex items-center gap-2 text-xs">Fecha<input aria-label="Fecha de la pre-cotización" type="date" value={c.fecha} onChange={e => set({ fecha: e.target.value })} className={campo} /></label>
        <label className="flex items-center gap-2 text-xs">Validez (días)<input aria-label="Validez en días" type="number" min={1} max={90} value={c.validezDias} onChange={e => set({ validezDias: Math.max(1, Math.min(90, Number(e.target.value) || 15)) })} className={`${campo} w-20`} /></label>
      </div>

      <div className="overflow-x-auto">
        <datalist id="productos-precotizacion">{state.products.map(p => <option key={p.sku} value={p.name} />)}</datalist>
        <table className="w-full text-xs min-w-[900px]" aria-label="Ítems de la pre-cotización">
          <thead className="bg-[#1f3a68] text-white uppercase text-[10px]"><tr>
            <th className="p-2">N°</th><th className="p-2 text-left">Concepto</th><th className="p-2">Und.</th><th className="p-2">Cant.</th><th className="p-2">Precio unit. (sin IGV)</th>
            <th className="p-2">Afectación</th><th className="p-2 text-right">Valor venta</th><th className="p-2 text-right">IGV</th><th className="p-2 text-right">Total</th><th /></tr></thead>
          <tbody>
            {c.lineas.map((l, i) => {
              const valor = r2(l.cantidad * l.precio);
              const igv = c.conIgv && l.afectacion === 'GRAVADO' ? r2(valor * 0.18) : 0;
              return (
                <tr key={i} className="border-b border-crema-200">
                  <td className="p-1 text-center">{i + 1}</td>
                  <td className="p-1"><input aria-label={`Concepto ${i + 1}`} list="productos-precotizacion" value={l.concepto} onChange={e => elegirConcepto(i, e.target.value)} placeholder="Ej. Grass americano" className={campo} /></td>
                  <td className="p-1"><select aria-label={`Unidad ${i + 1}`} value={l.unidad} onChange={e => setLinea(i, { unidad: e.target.value })} className={campo}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></td>
                  <td className="p-1"><input aria-label={`Cantidad ${i + 1}`} type="number" min={0} step="any" value={l.cantidad || ''} onChange={e => setLinea(i, { cantidad: Number(e.target.value) || 0 })} className={`${campo} w-20 text-right`} /></td>
                  <td className="p-1"><input aria-label={`Precio ${i + 1}`} type="number" min={0} step="0.01" value={l.precio || ''} onChange={e => setLinea(i, { precio: Number(e.target.value) || 0 })} className={`${campo} w-28 text-right`} /></td>
                  <td className="p-1"><select aria-label={`Afectación ${i + 1}`} value={l.afectacion} onChange={e => setLinea(i, { afectacion: e.target.value as LineaPrecotizacion['afectacion'] })} className={campo}>{AFECTACIONES.map(a => <option key={a}>{a}</option>)}</select></td>
                  <td className="p-1 text-right">{soles(valor)}</td><td className="p-1 text-right">{soles(igv)}</td><td className="p-1 text-right font-bold">{soles(valor + igv)}</td>
                  <td className="p-1"><button aria-label={`Quitar ítem ${i + 1}`} onClick={() => set({ lineas: c.lineas.length > 1 ? c.lineas.filter((_, j) => j !== i) : [lineaVacia()] })} className="p-1.5 text-error"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Boton tamano="sm" variante="secundario" onClick={() => set({ lineas: [...c.lineas, lineaVacia()] })}><Plus className="w-4 h-4" aria-hidden /> Agregar ítem</Boton>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-2">
          <label className="block text-xs font-bold">Condiciones (una por línea)
            <textarea aria-label="Condiciones" value={c.condiciones.join('\n')} onChange={e => set({ condiciones: e.target.value.split('\n') })} className={`${campo} mt-1 min-h-[120px] py-2`} />
          </label>
          <button onClick={() => set({ condiciones: condicionesBase(c.conIgv, c.validezDias, hayExonerados) })} className="text-xs font-bold text-bosque-700 underline">Usar las condiciones del modelo</button>
          <input aria-label="Observaciones" placeholder="Observaciones (opcional)" value={c.notas ?? ''} onChange={e => set({ notas: e.target.value })} className={campo} />
        </div>
        <table aria-label="Totales de la pre-cotización" className="w-full text-sm border border-crema-300">
          <tbody>
            <tr><td className="p-2">Op. gravadas</td><td className="p-2 text-right">{soles(calc.opGravadas)}</td></tr>
            <tr><td className="p-2">Op. exoneradas</td><td className="p-2 text-right">{soles(calc.opExoneradas)}</td></tr>
            {calc.opInafectas > 0 && <tr><td className="p-2">Op. inafectas</td><td className="p-2 text-right">{soles(calc.opInafectas)}</td></tr>}
            <tr><td className="p-2">IGV (18%)</td><td className="p-2 text-right">{c.conIgv ? soles(calc.igv) : 'No incluido'}</td></tr>
            <tr className="bg-[#dbe6f3] font-extrabold"><td className="p-2">TOTAL A PAGAR</td><td className="p-2 text-right">{soles(calc.total)}</td></tr>
          </tbody>
        </table>
      </div>

      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Boton cargando={guardando} onClick={() => void guardar().then(x => x && cerrar())}><Save className="w-4 h-4" aria-hidden /> Guardar</Boton>
        <Boton variante="secundario" onClick={() => void guardar().then(x => x && pdf(x))}><FileDown className="w-4 h-4" aria-hidden /> Guardar y PDF</Boton>
        <Boton variante="acento" onClick={() => void guardar().then(async x => { if (!x) return; const e = await whatsapp(x); if (e) setError(e); else cerrar(); })}><MessageCircle className="w-4 h-4" aria-hidden /> Enviar por WhatsApp</Boton>
      </div>
    </Tarjeta>
  );
}
