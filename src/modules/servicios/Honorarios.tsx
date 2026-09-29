// ==========================================
// JARDINEROS Y RECIBOS POR HONORARIOS
// El jardinero cobra su servicio con recibo por honorarios (RxH) y la empresa le cobra una comisión.
// Si el cliente pide factura, AUREVIA factura el servicio (+ IGV) y el jardinero le emite su RxH por su parte.
// ==========================================
import { useState } from 'react';
import { Info, Save, UserPlus } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { MEDIOS_PAGO, type Jardinero, type MedioPago, type ServicioJardinero } from '../../domain/types';
import { soles } from '../../lib/formato';
import { hoyLocal } from '../../lib/fechas';
import { conIgv, round2 } from '../../lib/peru';
import { useErp, type JardineroInput } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { Bloque } from '../admin/comunes';

const campo = 'w-full min-h-[40px] px-3 rounded-control border border-crema-300 bg-white text-sm';
const TOPE_RETENCION = 1500;

/** Lo que resulta de un servicio según la modalidad (mismo cálculo que la base). */
export function calculoServicio(valor: number, pct: number, modalidad: ServicioJardinero['modalidad'], suspension = false) {
  const comision = round2(valor * pct / 100);
  const honorario = round2(valor - comision);
  const retencion = modalidad === 'FACTURA' && honorario > TOPE_RETENCION && !suspension ? round2(honorario * 0.08) : 0;
  return {
    comision,
    comisionConIgv: round2(conIgv(comision)),
    facturaCliente: round2(conIgv(valor)),
    honorario,
    retencion,
    netoJardinero: round2(honorario - retencion)
  };
}

export default function Honorarios() {
  const { state } = useErp();
  const pct = state.company.comisionJardineroPct;
  return (
    <div className="space-y-5">
      <Tarjeta className="p-5 text-sm space-y-2">
        <p className="flex items-center gap-2 font-extrabold text-tinta"><Info className="w-4 h-4 text-bosque-700" aria-hidden /> Cómo se cobran los servicios de jardinería</p>
        <ul className="list-disc pl-5 space-y-1 text-tinta-suave">
          <li><b className="text-tinta">Con recibo por honorarios:</b> el jardinero cobra al cliente con su RxH (sin IGV). AUREVIA le cobra al jardinero su comisión con boleta o factura (+ IGV).</li>
          <li><b className="text-tinta">Con factura:</b> AUREVIA factura el servicio al cliente sumando el 18% de IGV. El jardinero emite su RxH a AUREVIA por el precio menos la comisión; si supera S/ 1 500 se le retiene el 8% de renta de 4ta.</li>
          <li>Comisión general: {pct !== undefined ? <b className="text-tinta">{pct}%</b> : <b className="text-error">sin configurar (Ajustes)</b>}. Cada jardinero puede tener la suya.</li>
        </ul>
      </Tarjeta>
      <div className="grid xl:grid-cols-[1fr_1.3fr] gap-5 items-start">
        <Jardineros />
        <NuevoServicio />
      </div>
      <ListaServicios />
    </div>
  );
}

// ---------- Jardineros ----------
const JARDINERO_VACIO: JardineroInput = { nombre: '', ruc: '', dni: '', telefono: '', suspension4ta: false, activo: true };

function Jardineros() {
  const { state, actions } = useErp();
  const [f, setF] = useState<JardineroInput>(JARDINERO_VACIO);
  const [comision, setComision] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (c: Partial<JardineroInput>) => setF(prev => ({ ...prev, ...c }));

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const r = await actions.guardarJardinero({ ...f, comisionPct: comision.trim() === '' ? undefined : Number(comision) });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setF(JARDINERO_VACIO);
    setComision('');
  };
  const editar = (j: Jardinero) => {
    setF({ ...j, ruc: j.ruc ?? '', dni: j.dni ?? '', telefono: j.telefono ?? '' });
    setComision(j.comisionPct !== undefined ? String(j.comisionPct) : '');
  };

  return (
    <Bloque titulo="Jardineros">
      {state.jardineros.length ? (
        <ul className="divide-y divide-crema-200">
          {state.jardineros.map(j => (
            <li key={j.id} className="py-2 flex items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className="font-bold text-tinta">{j.nombre}</span>
                <span className="block text-xs text-tinta-suave">{[j.ruc && `RUC ${j.ruc}`, j.dni && `DNI ${j.dni}`, j.telefono].filter(Boolean).join(' · ') || 'Sin documento'}</span>
              </span>
              <Insignia>{j.comisionPct !== undefined ? `${j.comisionPct}%` : 'comisión general'}</Insignia>
              {j.suspension4ta && <Insignia tono="exito">sin retención</Insignia>}
              {!j.activo && <Insignia tono="error">inactivo</Insignia>}
              <Boton tamano="sm" variante="fantasma" onClick={() => editar(j)}>Editar</Boton>
            </li>
          ))}
        </ul>
      ) : <p className="text-tinta-suave">Aún no hay jardineros.</p>}

      <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-crema-200">
        <input aria-label="Nombre del jardinero" placeholder="Nombre completo" value={f.nombre} onChange={e => set({ nombre: e.target.value })} className={`${campo} sm:col-span-2`} />
        <input aria-label="RUC del jardinero" placeholder="RUC (10…)" inputMode="numeric" value={f.ruc ?? ''} onChange={e => set({ ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={`${campo} font-mono`} />
        <input aria-label="DNI del jardinero" placeholder="DNI" inputMode="numeric" value={f.dni ?? ''} onChange={e => set({ dni: e.target.value.replace(/\D/g, '').slice(0, 8) })} className={`${campo} font-mono`} />
        <input aria-label="Teléfono del jardinero" placeholder="Teléfono" value={f.telefono ?? ''} onChange={e => set({ telefono: e.target.value })} className={campo} />
        <input aria-label="Comisión del jardinero" placeholder={`Comisión % (vacío = ${state.company.comisionJardineroPct ?? '—'}%)`} type="number" min={0} max={100} step="0.5" value={comision} onChange={e => setComision(e.target.value)} className={campo} />
        <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={f.suspension4ta} onChange={e => set({ suspension4ta: e.target.checked })} /> Tiene constancia de suspensión de retenciones de 4ta categoría</label>
        {f.id && <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={f.activo} onChange={e => set({ activo: e.target.checked })} /> Activo</label>}
      </div>
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      <div className="flex gap-2">
        <Boton tamano="sm" cargando={guardando} onClick={() => void guardar()}>{f.id ? <><Save className="w-4 h-4" aria-hidden /> Guardar cambios</> : <><UserPlus className="w-4 h-4" aria-hidden /> Agregar jardinero</>}</Boton>
        {f.id && <Boton tamano="sm" variante="secundario" onClick={() => { setF(JARDINERO_VACIO); setComision(''); }}>Cancelar</Boton>}
      </div>
    </Bloque>
  );
}

// ---------- Registrar servicio ----------
function NuevoServicio() {
  const { state, actions } = useErp();
  const activos = state.jardineros.filter(j => j.activo);
  const [jardineroId, setJardineroId] = useState('');
  const [fecha, setFecha] = useState(hoyLocal());
  const [descripcion, setDescripcion] = useState('');
  const [cliente, setCliente] = useState('');
  const [doc, setDoc] = useState('');
  const [valor, setValor] = useState('');
  const [modalidad, setModalidad] = useState<ServicioJardinero['modalidad']>('RXH_CLIENTE');
  const [rxhSerie, setRxhSerie] = useState('E001');
  const [rxhNumero, setRxhNumero] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const j = activos.find(x => x.id === jardineroId) ?? activos[0];
  const pct = j?.comisionPct ?? state.company.comisionJardineroPct;
  const monto = Number(valor) || 0;
  const c = pct !== undefined && monto > 0 ? calculoServicio(monto, pct, modalidad, j?.suspension4ta) : null;

  const registrar = async () => {
    if (!j) return setError('Agrega primero un jardinero.');
    setGuardando(true);
    setError(null);
    setOk(null);
    const r = await actions.registrarServicioJardinero({
      jardineroId: j.id, fecha, descripcion, clienteNombre: cliente, clienteDoc: doc || undefined, valor: monto, modalidad,
      rxhSerie: modalidad === 'RXH_CLIENTE' ? rxhSerie : undefined, rxhNumero: modalidad === 'RXH_CLIENTE' ? rxhNumero || undefined : undefined
    });
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setOk(`Servicio registrado: ${modalidad === 'FACTURA' ? 'emite la factura al cliente y registra el recibo del jardinero' : 'cobra la comisión al jardinero'} en la lista de abajo.`);
    setDescripcion(''); setCliente(''); setDoc(''); setValor(''); setRxhNumero('');
  };

  return (
    <Bloque titulo="Registrar servicio">
      {!activos.length ? <p className="text-tinta-suave">Agrega un jardinero para registrar servicios.</p> : (
        <>
          <div className="grid sm:grid-cols-2 gap-2">
            <select aria-label="Jardinero del servicio" value={j?.id ?? ''} onChange={e => setJardineroId(e.target.value)} className={campo}>
              {activos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            <input aria-label="Fecha del servicio" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} />
            <input aria-label="Descripción del servicio" placeholder="Servicio (ej. mantenimiento de jardín 40 m²)" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={200} className={`${campo} sm:col-span-2`} />
            <input aria-label="Cliente del servicio" placeholder={modalidad === 'FACTURA' ? 'Razón social del cliente' : 'Nombre del cliente'} value={cliente} onChange={e => setCliente(e.target.value)} className={campo} />
            <input aria-label="Documento del cliente del servicio" placeholder={modalidad === 'FACTURA' ? 'RUC del cliente *' : 'DNI o RUC (opcional)'} inputMode="numeric" value={doc} onChange={e => setDoc(e.target.value.replace(/\D/g, '').slice(0, 11))} className={`${campo} font-mono`} />
            <input aria-label="Precio del servicio sin IGV" placeholder="Precio acordado (S/, sin IGV)" type="number" min={0} step="0.5" value={valor} onChange={e => setValor(e.target.value)} className={`${campo} sm:col-span-2`} />
          </div>
          <fieldset className="grid sm:grid-cols-2 gap-2">
            <legend className="sr-only">Comprobante del cliente</legend>
            <label className={`p-3 rounded-control border cursor-pointer ${modalidad === 'RXH_CLIENTE' ? 'border-bosque-700 bg-bosque-50' : 'border-crema-300'}`}>
              <input type="radio" name="modalidad" className="mr-2" checked={modalidad === 'RXH_CLIENTE'} onChange={() => setModalidad('RXH_CLIENTE')} />
              <b>Recibo por honorarios</b><span className="block text-xs text-tinta-suave">El jardinero cobra al cliente; AUREVIA le cobra la comisión.</span>
            </label>
            <label className={`p-3 rounded-control border cursor-pointer ${modalidad === 'FACTURA' ? 'border-bosque-700 bg-bosque-50' : 'border-crema-300'}`}>
              <input type="radio" name="modalidad" className="mr-2" checked={modalidad === 'FACTURA'} onChange={() => setModalidad('FACTURA')} />
              <b>Cliente pide factura</b><span className="block text-xs text-tinta-suave">AUREVIA factura con IGV; el jardinero le emite su RxH.</span>
            </label>
          </fieldset>
          {modalidad === 'RXH_CLIENTE' && (
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <input aria-label="Serie del recibo al cliente" value={rxhSerie} onChange={e => setRxhSerie(e.target.value.toUpperCase().slice(0, 4))} className={`${campo} font-mono`} />
              <input aria-label="Número del recibo al cliente" placeholder="N° del RxH que emitió al cliente (puede ir después)" inputMode="numeric" value={rxhNumero} onChange={e => setRxhNumero(e.target.value.replace(/\D/g, '').slice(0, 8))} className={`${campo} font-mono`} />
            </div>
          )}

          {c && (
            <dl aria-label="Resumen del servicio" className="p-3 rounded-control bg-crema-50 border border-crema-200 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
              {modalidad === 'RXH_CLIENTE' ? <>
                <dt>El cliente paga al jardinero (RxH, sin IGV)</dt><dd className="text-right font-bold">{soles(monto)}</dd>
                <dt>Comisión AUREVIA ({pct}%)</dt><dd className="text-right">{soles(c.comision)}</dd>
                <dt>El jardinero paga a AUREVIA (comisión + IGV)</dt><dd className="text-right font-extrabold">{soles(c.comisionConIgv)}</dd>
              </> : <>
                <dt>Factura al cliente (servicio + IGV 18%)</dt><dd className="text-right font-extrabold">{soles(c.facturaCliente)}</dd>
                <dt>RxH del jardinero a AUREVIA (precio − {pct}%)</dt><dd className="text-right font-bold">{soles(c.honorario)}</dd>
                {c.retencion > 0 && <><dt>Retención renta de 4ta (8%)</dt><dd className="text-right">− {soles(c.retencion)}</dd></>}
                <dt>Se le paga al jardinero</dt><dd className="text-right font-extrabold">{soles(c.netoJardinero)}</dd>
              </>}
            </dl>
          )}
          {pct === undefined && <p className="text-error text-xs font-bold">Configura la comisión de los jardineros en Ajustes.</p>}
          {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
          {ok && <p role="status" className="text-exito font-bold text-xs">{ok}</p>}
          <Boton cargando={guardando} onClick={() => void registrar()}>Registrar servicio</Boton>
        </>
      )}
    </Bloque>
  );
}

// ---------- Servicios y pasos pendientes ----------
function ListaServicios() {
  const { state } = useErp();
  if (!state.serviciosJardinero.length) {
    return <Tarjeta><EstadoVacio titulo="Sin servicios registrados" detalle="Registra el servicio de un jardinero para cobrar la comisión o facturarlo al cliente." /></Tarjeta>;
  }
  return (
    <Bloque titulo="Servicios de jardineros">
      <ul className="divide-y divide-crema-200">
        {state.serviciosJardinero.map(s => <FilaServicio key={s.id} s={s} />)}
      </ul>
    </Bloque>
  );
}

function FilaServicio({ s }: { s: ServicioJardinero }) {
  const { state, actions } = useErp();
  const { open } = useUi();
  const j = state.jardineros.find(x => x.id === s.jardineroId);
  const gasto = s.gastoId ? state.gastos.find(g => g.id === s.gastoId) : undefined;
  const factura = s.modalidad === 'FACTURA';
  const [medio, setMedio] = useState<MedioPago>('Transferencia');
  const [operacion, setOperacion] = useState('');
  const [serie, setSerie] = useState('E001');
  const [numero, setNumero] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const montoComprobante = round2(conIgv(factura ? s.valor : s.comision));

  const correr = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setOcupado(true);
    setError(null);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) setError(r.error ?? 'No se pudo completar.');
  };
  const emitir = () => correr(async () => {
    const r = await actions.emitirComprobanteServicio(s.id, [{ medio, monto: montoComprobante, operacion: operacion.trim() || undefined }]);
    if (r.ok) open({ type: 'ticket', invoice: r.invoice, vuelto: r.vuelto });
    return r;
  });
  const registrarRxh = () => correr(() => actions.registrarRxhJardinero(s.id, serie, numero));
  const pagar = () => correr(() => actions.pagarGasto(gasto!.id, medio, operacion));

  const pideOperacion = medio !== 'Efectivo';
  const pendienteEmitir = !s.comprobanteId && (s.comision > 0 || factura);
  const selectorPago = (
    <>
      <select aria-label={`Medio de pago del servicio ${s.descripcion}`} value={medio} onChange={e => setMedio(e.target.value as MedioPago)} className="min-h-[36px] px-2 rounded-control border border-crema-300 bg-white text-xs">
        {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      {pideOperacion && <input aria-label={`N° de operación del servicio ${s.descripcion}`} value={operacion} onChange={e => setOperacion(e.target.value)} placeholder="N° operación" className="w-28 min-h-[36px] px-2 rounded-control border border-crema-300 text-xs" />}
    </>
  );

  return (
    <li className="py-3 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex-1 min-w-[220px]">
          <span className="font-bold text-tinta">{s.descripcion}</span>
          <span className="block text-xs text-tinta-suave">{s.fecha} · {j?.nombre ?? 'Jardinero'} · cliente {s.clienteNombre}{s.clienteDoc ? ` (${s.clienteDoc})` : ''}</span>
        </span>
        <Insignia tono={factura ? 'marca' : 'neutro'}>{factura ? 'Factura AUREVIA' : 'RxH al cliente'}</Insignia>
        <span className="text-right text-xs">
          <span className="block font-extrabold text-sm">{soles(s.valor)} <span className="font-normal text-tinta-suave">sin IGV</span></span>
          comisión {s.comisionPct}%: {soles(s.comision)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Paso 1: comprobante de AUREVIA */}
        {s.comprobanteId
          ? <Insignia tono="exito">{factura ? 'Factura' : 'Comisión cobrada'} {s.comprobanteId}</Insignia>
          : s.comision > 0 || factura
            ? <span className="flex flex-wrap items-center gap-2 p-2 rounded-control bg-aviso-fondo">
                <b>{factura ? `Emitir factura al cliente: ${soles(montoComprobante)}` : `Cobrar comisión al jardinero: ${soles(montoComprobante)}`}</b>
                {selectorPago}
                <Boton tamano="sm" cargando={ocupado} onClick={() => void emitir()}>{factura ? 'Emitir factura' : 'Cobrar comisión'}</Boton>
              </span>
            : null}

        {/* Paso 2: recibo por honorarios */}
        {s.rxhNumero
          ? <Insignia tono="exito">RxH {s.rxhSerie}-{s.rxhNumero}</Insignia>
          : <span className="flex flex-wrap items-center gap-2 p-2 rounded-control bg-crema-100">
              <b>{factura ? 'RxH del jardinero a AUREVIA' : 'N° de RxH al cliente'}</b>
              <input aria-label={`Serie del RxH de ${s.descripcion}`} value={serie} onChange={e => setSerie(e.target.value.toUpperCase().slice(0, 4))} className="w-16 min-h-[36px] px-2 rounded-control border border-crema-300 font-mono" />
              <input aria-label={`Número del RxH de ${s.descripcion}`} value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Número" className="w-24 min-h-[36px] px-2 rounded-control border border-crema-300 font-mono" />
              <Boton tamano="sm" variante="secundario" cargando={ocupado} onClick={() => void registrarRxh()}>Registrar RxH</Boton>
            </span>}

        {/* Paso 3 (factura): pagar al jardinero */}
        {factura && gasto && (gasto.medioPago
          ? <Insignia tono="exito">Pagado {soles(gasto.total - (gasto.retencion ?? 0))} · {gasto.medioPago}</Insignia>
          : <span className="flex flex-wrap items-center gap-2 p-2 rounded-control bg-aviso-fondo">
              <b>Pagar al jardinero: {soles(gasto.total - (gasto.retencion ?? 0))}</b>{gasto.retencion ? <span>(retención 4ta {soles(gasto.retencion)})</span> : null}
              {pendienteEmitir ? <span>(primero emite la factura)</span> : <>{selectorPago}<Boton tamano="sm" cargando={ocupado} onClick={() => void pagar()}>Pagar</Boton></>}
            </span>)}
      </div>
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
    </li>
  );
}
