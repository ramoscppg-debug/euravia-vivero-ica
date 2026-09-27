import { useState } from 'react';
import { BookOpen, FileText, Printer } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { imprimirBrochure, type TipoDocumento } from '../../lib/documentos';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';
import { docDeCotizacion, docDePedido, docDeSolicitud, imprimir } from './documentosVenta';

type Origen = 'cotizaciones' | 'pedidos' | 'web';

/** Documentos comerciales listos para imprimir o guardar en PDF, y el brochure de la empresa. */
export default function Documentos() {
  const { state } = useErp();
  const [origen, setOrigen] = useState<Origen>('pedidos');

  const filas: { id: string; cliente: string; detalle: string; total: number; docs: [TipoDocumento, () => void][] }[] =
    origen === 'cotizaciones'
      ? state.cotizaciones.map(c => ({
        id: c.id, cliente: c.cliente.nombre, detalle: `${c.fecha} · vence ${c.vence} · ${c.estado}`, total: c.total,
        docs: [['COTIZACIÓN', () => imprimir(docDeCotizacion(state, c))], ['PROFORMA', () => imprimir(docDeCotizacion(state, c, 'PROFORMA'))]]
      }))
      : origen === 'pedidos'
        ? state.pedidos.map(p => ({
          id: p.id, cliente: p.razonSocial || p.cliente.nombre, detalle: `${p.createdAt.slice(0, 10)} · ${p.estado} · entrega ${p.fechaEntrega}`, total: p.total,
          docs: [['NOTA DE PEDIDO', () => imprimir(docDePedido(state, p))], ['PROFORMA', () => imprimir(docDePedido(state, p, 'PROFORMA'))]]
        }))
        : state.solicitudes.filter(s => s.tipo !== 'CONSULTA').map(s => ({
          id: s.id, cliente: s.razonSocial || s.nombre, detalle: `${s.createdAt.slice(0, 10)} · ${s.tipo === 'SERVICIO' ? 'servicio' : 'pedido web'} · ${s.comprobante.toLowerCase()}`, total: s.totalReferencial,
          docs: [['PROFORMA', () => imprimir(docDeSolicitud(state, s))], ['COTIZACIÓN', () => imprimir(docDeSolicitud(state, s, 'COTIZACIÓN'))]]
        }));

  return (
    <div className="space-y-6">
      <Tarjeta className="p-5 space-y-4">
        <div>
          <h3 className="font-extrabold text-tinta flex items-center gap-2"><FileText className="w-5 h-5 text-bosque-700" aria-hidden /> Cotización, proforma y nota de pedido</h3>
          <p className="text-xs text-tinta-suave">Elige el registro y el documento. Se abre la impresión: puedes imprimirlo o elegir “Guardar como PDF” para enviarlo por WhatsApp o correo.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs" role="tablist" aria-label="Origen">
          {([['pedidos', 'Pedidos'], ['web', 'Pedidos web'], ['cotizaciones', 'Cotizaciones']] as const).map(([id, t]) => (
            <button key={id} role="tab" aria-selected={origen === id} onClick={() => setOrigen(id)} className={`px-3 py-1.5 rounded-full font-bold border ${origen === id ? 'bg-bosque-950 text-white border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>{t}</button>
          ))}
        </div>
        {filas.length ? (
          <ul className="divide-y divide-crema-200 text-sm">
            {filas.map(f => (
              <li key={f.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-[200px]"><span className="font-bold text-tinta">{f.cliente}</span><span className="block text-xs text-tinta-suave font-mono">{f.id} · {f.detalle}</span></span>
                <span className="font-extrabold w-24 text-right">{f.total ? soles(f.total) : '—'}</span>
                <span className="flex gap-1.5">
                  {f.docs.map(([tipo, fn]) => <Boton key={tipo} tamano="sm" variante={tipo === 'PROFORMA' ? 'secundario' : 'primario'} onClick={fn}><Printer className="w-3.5 h-3.5" aria-hidden /> {tipo.charAt(0) + tipo.slice(1).toLowerCase()}</Boton>)}
                </span>
              </li>
            ))}
          </ul>
        ) : <EstadoVacio titulo="Sin registros" detalle="Cuando existan pedidos o cotizaciones podrás generar sus documentos aquí." />}
      </Tarjeta>

      <Brochure />
    </div>
  );
}

function Brochure() {
  const { state } = useErp();
  const { company, tiendaConfig, products, serviciosPublicos } = state;
  const visibles = products.filter(p => p.visibleTienda !== false);
  const [lema, setLema] = useState('Plantas, insumos y jardinería');
  const [presentacion, setPresentacion] = useState('');
  const [precios, setPrecios] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>(() => {
    const destacados = visibles.filter(p => p.destacado).map(p => p.sku);
    return (destacados.length ? destacados : visibles.map(p => p.sku)).slice(0, 12);
  });
  const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';

  const generar = () => imprimirBrochure({
    empresa: company, contacto: tiendaConfig, lema, presentacion, mostrarPrecios: precios, urlTienda: `${window.location.origin}/tienda`,
    productos: visibles.filter(p => elegidos.includes(p.sku)).map(p => ({ nombre: p.name, categoria: p.categoryName, precio: p.price, imagen: p.fullImage || undefined, descripcion: p.description })),
    servicios: serviciosPublicos.filter(s => s.visible).map(s => ({ nombre: s.nombre, resumen: s.resumen, imagen: s.imagen }))
  });

  return (
    <Tarjeta className="p-5 space-y-4 text-sm">
      <div>
        <h3 className="font-extrabold text-tinta flex items-center gap-2"><BookOpen className="w-5 h-5 text-bosque-700" aria-hidden /> Brochure de la empresa</h3>
        <p className="text-xs text-tinta-suave">Portada, catálogo, servicios y contacto con un QR a la tienda. Se arma con tus datos reales: completa Ajustes y sube fotos para que luzca mejor.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block font-bold text-tinta">Lema<input value={lema} onChange={e => setLema(e.target.value)} maxLength={80} className={`${campo} mt-1`} /></label>
        <label className="flex items-center gap-2 font-bold text-tinta md:mt-6"><input type="checkbox" checked={precios} onChange={e => setPrecios(e.target.checked)} /> Mostrar precios</label>
        <label className="block font-bold text-tinta md:col-span-2">Presentación (opcional)<textarea value={presentacion} onChange={e => setPresentacion(e.target.value)} maxLength={500} placeholder="Quiénes somos, desde cuándo, qué nos diferencia…" className={`${campo} mt-1 min-h-[80px] py-2`} /></label>
      </div>
      <fieldset>
        <legend className="font-bold text-tinta mb-2">Productos del brochure ({elegidos.length})</legend>
        {visibles.length ? (
          <div className="flex flex-wrap gap-2">
            {visibles.map(p => {
              const on = elegidos.includes(p.sku);
              return (
                <button key={p.sku} type="button" aria-pressed={on} onClick={() => setElegidos(e => (on ? e.filter(x => x !== p.sku) : [...e, p.sku]))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? 'bg-bosque-700 text-white border-bosque-700' : 'bg-white text-tinta-suave border-crema-300'}`}>
                  {p.name}{!p.fullImage && ' · sin foto'}
                </button>
              );
            })}
          </div>
        ) : <p className="text-tinta-suave">Aún no hay productos visibles en la tienda.</p>}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={generar}><Printer className="w-4 h-4" aria-hidden /> Generar brochure (PDF)</Boton>
        {!company.ruc && <Insignia tono="aviso">Sin RUC configurado: no aparecerá en el brochure</Insignia>}
        {!tiendaConfig.whatsapp && <Insignia tono="aviso">Sin WhatsApp configurado</Insignia>}
      </div>
    </Tarjeta>
  );
}
