// ==========================================
// COTIZAR: selección → datos y comprobante → confirmar → enviar por WhatsApp.
// El pedido se registra primero (queda en el panel con número) y luego el cliente lo envía listo por WhatsApp.
// ==========================================
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, MessageCircle, Store, Truck } from 'lucide-react';
import { Enlace, useUbicacion } from '../../../app/router';
import { Esqueleto } from '../../../components/ui';
import type { SolicitudTienda } from '../../../domain/types';
import { AVISO_IGV, desgloseIgv, enlaceWhatsapp, enviarSolicitud, mensajePedido, tarifaDe, url, validarSolicitud, type NuevaSolicitud } from '../datos';
import { Contador, Imagen, NotaStock, soles } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useLineas, useTienda } from '../TiendaApp';

interface Formulario {
  nombre: string;
  telefono: string;
  email: string;
  comprobante: SolicitudTienda['comprobante'];
  doc: string;
  razonSocial: string;
  entrega: SolicitudTienda['entrega'];
  direccion: string;
  distrito: string;
  mensaje: string;
}

const VACIO: Formulario = { nombre: '', telefono: '', email: '', comprobante: 'BOLETA', doc: '', razonSocial: '', entrega: 'RECOJO', direccion: '', distrito: '', mensaje: '' };
const CLAVE_DATOS = 'aurevia.cliente.v1'; // se recuerdan nombre y teléfono en este navegador para la próxima vez

function leerDatos(): Formulario {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_DATOS) ?? '{}');
    return { ...VACIO, nombre: String(v.nombre ?? ''), telefono: String(v.telefono ?? ''), email: String(v.email ?? '') };
  } catch {
    return VACIO;
  }
}

interface Enviado {
  numero: string;
  whatsapp: string | null;
  telefono: string;
}

export default function Cotizar() {
  const { datos, cambiarCantidad, vaciar } = useTienda();
  const { lineas, total } = useLineas();
  const { query } = useUbicacion();
  const servicio = datos?.servicios.find(s => s.slug === query.get('servicio'));
  const modoServicio = !!query.get('servicio');
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState<Formulario>(leerDatos);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<Enviado | null>(null);

  useEffect(() => fijarMetadatos({ titulo: modoServicio ? 'Cotizar servicio' : 'Confirmar pedido', descripcion: 'Confirma tu pedido y envíalo por WhatsApp.' }), [modoServicio]);
  useEffect(() => { window.scrollTo({ top: 0 }); setError(null); }, [paso]);
  // Servicios: recibo por honorarios del jardinero o factura de la empresa; productos: boleta o factura
  useEffect(() => setF(prev => (modoServicio && prev.comprobante === 'BOLETA' ? { ...prev, comprobante: 'RXH' } : !modoServicio && prev.comprobante === 'RXH' ? { ...prev, comprobante: 'BOLETA' } : prev)), [modoServicio]);

  const solicitud: NuevaSolicitud = useMemo(() => ({
    tipo: modoServicio ? 'SERVICIO' : 'PEDIDO',
    servicio: servicio?.slug,
    nombre: f.nombre, telefono: f.telefono, email: f.email || undefined,
    comprobante: f.comprobante, doc: f.doc, razonSocial: f.comprobante === 'FACTURA' ? f.razonSocial : undefined,
    entrega: modoServicio ? 'RECOJO' : f.entrega, direccion: modoServicio || f.entrega === 'DELIVERY' ? f.direccion : undefined,
    distrito: f.distrito.trim(), mensaje: f.mensaje,
    items: modoServicio ? [] : lineas.map(l => ({ sku: l.sku, cantidad: l.cantidad }))
  }), [modoServicio, servicio, f, lineas]);

  if (!datos) return <Pagina className="py-10"><Esqueleto className="h-72 !rounded-3xl" /></Pagina>;
  const tarifa = !modoServicio && f.entrega === 'DELIVERY' ? tarifaDe(datos.tarifas, f.distrito) : undefined;
  const montos = desgloseIgv(total, tarifa?.costo ?? 0);
  if (enviado) return <Exito enviado={enviado} modoServicio={modoServicio} />;

  if (modoServicio && !servicio) {
    return <Pagina className="py-16 text-center space-y-3"><p className="text-xl font-extrabold">Servicio no disponible</p><Enlace href={url('/servicios')} className="text-hoja-700 font-bold underline">Ver servicios</Enlace></Pagina>;
  }
  if (!modoServicio && !lineas.length) {
    return (
      <Pagina className="py-16 text-center space-y-3">
        <p className="text-2xl font-extrabold text-slate-900">Tu cotización está vacía</p>
        <p className="text-slate-600">Agrega plantas o insumos desde el catálogo.</p>
        <Enlace href={url('/plantas')} className="inline-flex min-h-[48px] items-center px-6 rounded-full bg-hoja-700 text-white font-bold">Ver plantas</Enlace>
      </Pagina>
    );
  }

  const pasos = modoServicio ? ['Tu necesidad', 'Tus datos', 'Confirmar'] : ['Tu selección', 'Tus datos', 'Confirmar'];
  const set = (cambio: Partial<Formulario>) => setF(prev => ({ ...prev, ...cambio }));

  const siguiente = () => {
    if (paso === 0 && modoServicio && f.mensaje.trim().length < 10) return setError('Cuéntanos en unas palabras qué necesitas (medidas, lugar, plantas…).');
    if (paso === 1) {
      const e = validarSolicitud(solicitud);
      if (e) return setError(e);
      if (!modoServicio && f.entrega === 'DELIVERY' && datos.tarifas.length && !f.distrito.trim()) return setError('Elige tu distrito para calcular el delivery.');
    }
    setPaso(p => p + 1);
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const numero = await enviarSolicitud(solicitud, datos.productos, datos.tarifas);
      const texto = mensajePedido(numero, solicitud, lineas.map(l => ({ nombre: l.p.nombre, cantidad: l.cantidad, precio: l.p.precio, stock: l.p.stock })), servicio?.nombre, tarifa?.costo);
      try { localStorage.setItem(CLAVE_DATOS, JSON.stringify({ nombre: f.nombre, telefono: f.telefono, email: f.email })); } catch { /* sin almacenamiento */ }
      setEnviado({ numero, whatsapp: enlaceWhatsapp(datos.config, texto), telefono: f.telefono });
      if (!modoServicio) vaciar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const hayAsesor = lineas.some(l => l.cantidad > l.p.stock);
  const campo = 'w-full min-h-[48px] px-4 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-hoja-600 outline-none';

  return (
    <Pagina className="py-8 max-w-4xl">
      <Pasos pasos={pasos} actual={paso} />

      <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-5">
          {/* PASO 1 */}
          {paso === 0 && !modoServicio && (
            <section aria-label="Tu selección" className="space-y-4">
              <h1 className="text-2xl font-extrabold text-slate-900">Revisa tu selección</h1>
              <ul className="divide-y divide-slate-100 rounded-3xl border border-slate-200 px-4">
                {lineas.map(l => (
                  <li key={l.sku} className="py-4 flex gap-3">
                    <Imagen src={l.p.imagen} alt={l.p.nombre} className="w-20 h-20 rounded-2xl shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-bold text-slate-900">{l.p.nombre}</p>
                      <p className="text-xs text-slate-500">{soles(l.p.precio)} c/u + IGV · {l.p.stock > 0 ? `${l.p.stock} disponibles` : 'sin stock'}</p>
                      <Contador valor={l.cantidad} cambiar={n => cambiarCantidad(l.sku, n)} etiqueta={l.p.nombre} permitirCero />
                      <NotaStock stock={l.p.stock} cantidad={l.cantidad} compacta />
                    </div>
                    <span className="font-extrabold text-slate-900 shrink-0">{soles(l.cantidad * l.p.precio)}</span>
                  </li>
                ))}
              </ul>
              <p className="p-3 rounded-2xl bg-amber-50 text-amber-900 text-sm font-semibold">{AVISO_IGV}</p>
              <Enlace href={url('/plantas')} className="inline-block text-sm font-bold text-hoja-700 hover:underline">+ Seguir agregando</Enlace>
            </section>
          )}
          {paso === 0 && modoServicio && servicio && (
            <section aria-label="Tu necesidad" className="space-y-4">
              <h1 className="text-2xl font-extrabold text-slate-900">Cotizar: {servicio.nombre}</h1>
              <p className="text-slate-600">{servicio.resumen}</p>
              <label className="block text-sm font-bold text-slate-700">¿Qué necesitas? *
                <textarea value={f.mensaje} onChange={e => set({ mensaje: e.target.value })} maxLength={1000} placeholder="Ej.: jardín de 30 m² en casa, con poca luz; quiero plantas de bajo mantenimiento." className={`${campo} mt-1 min-h-[140px] py-3`} />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm font-bold text-slate-700">Dirección del servicio
                  <input value={f.direccion} onChange={e => set({ direccion: e.target.value })} maxLength={250} className={`${campo} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-slate-700">Distrito
                  <input value={f.distrito} onChange={e => set({ distrito: e.target.value })} maxLength={80} className={`${campo} mt-1`} />
                </label>
              </div>
            </section>
          )}

          {/* PASO 2 */}
          {paso === 1 && (
            <section aria-label="Tus datos" className="space-y-5">
              <h1 className="text-2xl font-extrabold text-slate-900">Tus datos y comprobante</h1>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm font-bold text-slate-700">Nombre *
                  <input autoComplete="name" value={f.nombre} onChange={e => set({ nombre: e.target.value })} maxLength={120} className={`${campo} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-slate-700">WhatsApp *
                  <input type="tel" autoComplete="tel" inputMode="tel" value={f.telefono} onChange={e => set({ telefono: e.target.value })} maxLength={20} placeholder="+51 9…" className={`${campo} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-slate-700 sm:col-span-2">Correo (opcional)
                  <input type="email" autoComplete="email" value={f.email} onChange={e => set({ email: e.target.value })} maxLength={120} className={`${campo} mt-1`} />
                </label>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-bold text-slate-700 mb-2">¿Qué comprobante necesitas? *</legend>
                <div className={`grid gap-3 ${modoServicio ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                  {modoServicio && <Opcion activa={f.comprobante === 'RXH'} onClick={() => set({ comprobante: 'RXH' })} titulo="Recibo por honorarios" detalle="Lo emite el jardinero · sin IGV" icono={<FileText className="w-5 h-5" aria-hidden />} />}
                  <Opcion activa={f.comprobante === 'BOLETA'} onClick={() => set({ comprobante: 'BOLETA' })} titulo="Boleta" detalle={modoServicio ? 'La emite AUREVIA · + IGV 18%' : 'Persona natural (DNI) · + IGV'} icono={<FileText className="w-5 h-5" aria-hidden />} />
                  <Opcion activa={f.comprobante === 'FACTURA'} onClick={() => set({ comprobante: 'FACTURA' })} titulo="Factura" detalle={modoServicio ? 'La emite AUREVIA · + IGV 18%' : 'Empresa o negocio (RUC) · + IGV'} icono={<FileText className="w-5 h-5" aria-hidden />} />
                </div>
                {!modoServicio && <p className="text-xs text-amber-900 font-semibold">{AVISO_IGV}</p>}
                {modoServicio && f.comprobante !== 'RXH' && <p className="text-xs text-amber-900 font-semibold">Con boleta o factura, al precio del servicio se le suma el 18% de IGV.</p>}
                {f.comprobante !== 'FACTURA' ? (
                  <label className="block text-sm font-bold text-slate-700">DNI (opcional)
                    <input inputMode="numeric" value={f.doc} onChange={e => set({ doc: e.target.value.replace(/\D/g, '').slice(0, 8) })} className={`${campo} mt-1 font-mono`} placeholder="8 dígitos" />
                  </label>
                ) : (
                  <div className="grid sm:grid-cols-[180px_1fr] gap-3">
                    <label className="block text-sm font-bold text-slate-700">RUC *
                      <input inputMode="numeric" value={f.doc} onChange={e => set({ doc: e.target.value.replace(/\D/g, '').slice(0, 11) })} className={`${campo} mt-1 font-mono`} placeholder="11 dígitos" />
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Razón social *
                      <input value={f.razonSocial} onChange={e => set({ razonSocial: e.target.value })} maxLength={150} className={`${campo} mt-1`} />
                    </label>
                  </div>
                )}
              </fieldset>

              {!modoServicio && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-bold text-slate-700 mb-2">¿Cómo lo recibes? *</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <Opcion activa={f.entrega === 'RECOJO'} onClick={() => set({ entrega: 'RECOJO' })} titulo="Recojo" detalle="En el vivero" icono={<Store className="w-5 h-5" aria-hidden />} />
                    <Opcion activa={f.entrega === 'DELIVERY'} onClick={() => set({ entrega: 'DELIVERY' })} titulo="Delivery" detalle={datos.tarifas.length ? `Desde ${soles(Math.min(...datos.tarifas.map(t => t.costo)))} según distrito` : 'Costo a coordinar'} icono={<Truck className="w-5 h-5" aria-hidden />} />
                  </div>
                  {f.entrega === 'DELIVERY' && (
                    <div className="grid sm:grid-cols-[1fr_200px] gap-3">
                      <label className="block text-sm font-bold text-slate-700">Dirección *
                        <input autoComplete="street-address" value={f.direccion} onChange={e => set({ direccion: e.target.value })} maxLength={250} className={`${campo} mt-1`} />
                      </label>
                      {datos.tarifas.length ? (
                        <label className="block text-sm font-bold text-slate-700">Distrito *
                          <select value={tarifaDe(datos.tarifas, f.distrito) || !f.distrito ? f.distrito : '__otro'} onChange={e => set({ distrito: e.target.value === '__otro' ? ' ' : e.target.value })} className={`${campo} mt-1`}>
                            <option value="">Elige tu distrito</option>
                            {datos.tarifas.map(t => <option key={t.distrito} value={t.distrito}>{t.distrito} · delivery {soles(t.costo)}</option>)}
                            <option value="__otro">Otro distrito (costo a coordinar)</option>
                          </select>
                          {!!f.distrito && !tarifaDe(datos.tarifas, f.distrito) && (
                            <input aria-label="Tu distrito" autoFocus value={f.distrito.trim()} onChange={e => set({ distrito: e.target.value || ' ' })} maxLength={80} placeholder="Escribe tu distrito" className={`${campo} mt-2`} />
                          )}
                        </label>
                      ) : (
                        <label className="block text-sm font-bold text-slate-700">Distrito
                          <input autoComplete="address-level3" value={f.distrito} onChange={e => set({ distrito: e.target.value })} maxLength={80} className={`${campo} mt-1`} />
                        </label>
                      )}
                    </div>
                  )}
                  <label className="block text-sm font-bold text-slate-700">Nota para el asesor (opcional)
                    <textarea value={f.mensaje} onChange={e => set({ mensaje: e.target.value })} maxLength={1000} className={`${campo} mt-1 min-h-[88px] py-3`} />
                  </label>
                </fieldset>
              )}
            </section>
          )}

          {/* PASO 3 */}
          {paso === 2 && (
            <section aria-label="Confirmar" className="space-y-4">
              <h1 className="text-2xl font-extrabold text-slate-900">Confirma tu {modoServicio ? 'solicitud' : 'pedido'}</h1>
              <div className="rounded-3xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-hoja-50 flex justify-between items-center gap-3">
                  <p className="font-extrabold text-hoja-900">{modoServicio ? 'Solicitud de cotización' : 'Nota de pedido'}</p>
                  <span className="text-xs font-bold text-hoja-800">{f.comprobante === 'FACTURA' ? 'Factura' : f.comprobante === 'RXH' ? 'Recibo por honorarios' : 'Boleta'}</span>
                </div>
                <dl className="px-5 py-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Dato t="Cliente" v={f.nombre} />
                  <Dato t="WhatsApp" v={f.telefono} />
                  {f.comprobante === 'FACTURA' ? <><Dato t="RUC" v={f.doc} /><Dato t="Razón social" v={f.razonSocial} /></> : f.doc ? <Dato t="DNI" v={f.doc} /> : null}
                  {modoServicio ? <Dato t="Servicio" v={servicio?.nombre ?? ''} /> : <Dato t="Entrega" v={f.entrega === 'DELIVERY' ? `Delivery · ${[f.direccion, f.distrito.trim()].filter(Boolean).join(', ')} · ${tarifa ? soles(tarifa.costo) : 'costo a coordinar'}` : 'Recojo en el vivero'} />}
                </dl>
                {!modoServicio && (
                  <table className="w-full text-sm border-t border-slate-200">
                    <thead className="text-xs uppercase text-slate-500"><tr><th className="text-left px-5 py-2">Producto</th><th className="text-right px-2">Cant.</th><th className="text-right px-5">Importe</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineas.map(l => (
                        <tr key={l.sku}><td className="px-5 py-2">{l.p.nombre}{l.cantidad > l.p.stock && <span className="block text-[11px] font-bold text-amber-800">Con asesor: hay {l.p.stock}</span>}</td><td className="text-right px-2">{l.cantidad}</td><td className="text-right px-5 font-semibold">{soles(l.cantidad * l.p.precio)}</td></tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200"><td colSpan={2} className="px-5 py-2">Valor de venta</td><td className="text-right px-5 font-semibold">{soles(montos.valor)}</td></tr>
                      <tr><td colSpan={2} className="px-5 py-2">IGV (18%)</td><td className="text-right px-5 font-semibold">{soles(montos.igv)}</td></tr>
                      {tarifa && <tr className="border-t border-slate-200"><td colSpan={2} className="px-5 py-2">Delivery a {tarifa.distrito}</td><td className="text-right px-5 font-semibold">{soles(tarifa.costo)}</td></tr>}
                      <tr className="border-t border-slate-200"><td colSpan={2} className="px-5 py-3 font-bold">Total referencial</td><td className="text-right px-5 font-extrabold text-lg">{soles(montos.total)}</td></tr>
                    </tfoot>
                  </table>
                )}
                {f.mensaje.trim() && <p className="px-5 py-3 border-t border-slate-200 text-sm text-slate-600 italic">“{f.mensaje.trim()}”</p>}
              </div>
              <p className="text-sm text-slate-600">Al confirmar, tu {modoServicio ? 'solicitud' : 'pedido'} queda registrado con un número y podrás enviarlo por WhatsApp. El pago y la entrega los coordinas con un asesor; aquí no se cobra nada.</p>
            </section>
          )}

          {error && <p role="alert" className="p-3 rounded-2xl bg-error-fondo text-error text-sm font-semibold">{error}</p>}

          <div className="flex gap-3 pt-2">
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)} className="min-h-[52px] px-5 rounded-full border border-slate-300 font-bold text-slate-700 inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" aria-hidden /> Atrás</button>
            )}
            {paso < 2 ? (
              <button onClick={siguiente} className="flex-1 min-h-[52px] rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold inline-flex items-center justify-center gap-2">Continuar <ArrowRight className="w-5 h-5" aria-hidden /></button>
            ) : (
              <button onClick={() => void confirmar()} disabled={enviando} aria-busy={enviando || undefined} className="flex-1 min-h-[52px] rounded-full bg-hoja-700 hover:bg-hoja-800 disabled:opacity-60 text-white font-bold inline-flex items-center justify-center gap-2">
                <Check className="w-5 h-5" aria-hidden /> {enviando ? 'Registrando…' : `Confirmar ${modoServicio ? 'solicitud' : 'pedido'}`}
              </button>
            )}
          </div>
        </div>

        {/* Resumen siempre visible */}
        <aside className="lg:sticky lg:top-24 self-start rounded-3xl bg-slate-50 p-5 space-y-3 text-sm">
          <p className="font-extrabold text-slate-900">Resumen</p>
          {modoServicio ? (
            <p className="text-slate-600">{servicio?.nombre}: te enviaremos una cotización a medida.</p>
          ) : (
            <>
              <p className="flex justify-between"><span className="text-slate-600">{lineas.length} producto(s) sin IGV</span><span className="font-bold">{soles(montos.valor)}</span></p>
              <p className="flex justify-between"><span className="text-slate-600">IGV (18%)</span><span className="font-bold">{soles(montos.igv)}</span></p>
              <p className="flex justify-between"><span className="text-slate-600">Delivery</span><span className="font-bold">{f.entrega !== 'DELIVERY' ? '—' : tarifa ? soles(tarifa.costo) : 'A coordinar'}</span></p>
              <p className="flex justify-between border-t border-slate-200 pt-3 text-base"><span className="font-bold">Total referencial</span><span className="font-extrabold">{soles(montos.total)}</span></p>
              <p className="text-xs text-slate-500">{AVISO_IGV}</p>
              {hayAsesor && <p className="p-2.5 rounded-xl bg-amber-50 text-amber-900 text-xs font-semibold">Parte de tu pedido supera el stock: un asesor de ventas lo coordina contigo.</p>}
            </>
          )}
          <p className="flex items-start gap-2 text-xs text-slate-500 pt-1"><MessageCircle className="w-4 h-4 shrink-0 text-hoja-700" aria-hidden /> Pago y entrega se coordinan por WhatsApp.</p>
        </aside>
      </div>
    </Pagina>
  );
}

function Pasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Pasos">
      {pasos.map((p, i) => (
        <li key={p} className="flex items-center gap-2 flex-1 last:flex-none" aria-current={i === actual ? 'step' : undefined}>
          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 ${i < actual ? 'bg-hoja-700 text-white' : i === actual ? 'bg-hoja-700 text-white ring-4 ring-hoja-100' : 'bg-slate-100 text-slate-500'}`}>
            {i < actual ? <Check className="w-4 h-4" aria-hidden /> : i + 1}
          </span>
          <span className={`text-sm font-bold hidden sm:inline ${i === actual ? 'text-slate-900' : 'text-slate-500'}`}>{p}</span>
          {i < pasos.length - 1 && <span className={`flex-1 h-0.5 rounded ${i < actual ? 'bg-hoja-600' : 'bg-slate-200'}`} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function Opcion({ activa, onClick, titulo, detalle, icono }: { activa: boolean; onClick: () => void; titulo: string; detalle: string; icono: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`text-left p-4 rounded-2xl border-2 transition-colors flex gap-3 items-start ${activa ? 'border-hoja-600 bg-hoja-50' : 'border-slate-200 hover:border-slate-300'}`}>
      <span className={activa ? 'text-hoja-700' : 'text-slate-400'}>{icono}</span>
      <span><span className="block font-extrabold text-slate-900">{titulo}</span><span className="block text-xs text-slate-600">{detalle}</span></span>
    </button>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return <div><dt className="text-xs text-slate-500">{t}</dt><dd className="font-semibold text-slate-900 break-words">{v || '—'}</dd></div>;
}

function Exito({ enviado, modoServicio }: { enviado: Enviado; modoServicio: boolean }) {
  return (
    <Pagina className="py-14 max-w-xl">
      <div role="status" className="rounded-[2rem] border border-hoja-200 bg-gradient-to-b from-hoja-50 to-white p-8 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 mx-auto text-hoja-700" aria-hidden />
        <p className="text-2xl font-extrabold text-slate-900">{modoServicio ? '¡Solicitud registrada!' : '¡Pedido registrado!'}</p>
        <p className="text-slate-600">Número: <strong className="font-mono text-slate-900">{enviado.numero}</strong></p>
        {enviado.whatsapp ? (
          <>
            <p className="text-slate-600">Último paso: envíanos tu {modoServicio ? 'solicitud' : 'pedido'} por WhatsApp para que un asesor lo atienda y coordine el pago.</p>
            <a href={enviado.whatsapp} target="_blank" rel="noopener noreferrer" className="w-full min-h-[56px] rounded-full bg-hoja-700 hover:bg-hoja-800 text-white text-lg font-extrabold inline-flex items-center justify-center gap-2 shadow-lg">
              <MessageCircle className="w-6 h-6" aria-hidden /> Enviar {modoServicio ? 'solicitud' : 'pedido'} por WhatsApp
            </a>
          </>
        ) : (
          <p className="text-slate-600">Un asesor de ventas te escribirá al <strong>{enviado.telefono}</strong> para coordinar el pago y la entrega.</p>
        )}
        <Enlace href={url('/plantas')} className="inline-block text-sm font-bold text-hoja-700 hover:underline">Seguir viendo el catálogo</Enlace>
      </div>
    </Pagina>
  );
}
