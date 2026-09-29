import { useEffect, useState } from 'react';
import { ChevronLeft, Droplets, ShieldCheck, Sun, Truck } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import { esPlanta, url } from '../datos';
import { BotonCompartir, ChipStock, Contador, Imagen, NotaStock, soles, TarjetaProducto } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Producto({ sku }: { sku: string }) {
  const { datos, agregar, setPanel } = useTienda();
  const [cantidad, setCantidad] = useState(1);
  const p = datos?.productos.find(x => x.sku === sku);

  useEffect(() => {
    if (p) fijarMetadatos({ titulo: p.nombre, descripcion: p.descripcion ?? `${p.nombre} en AUREVIA: ${soles(p.precio)}.`, imagen: p.imagen });
  }, [p]);

  if (!datos) return <Pagina className="py-10 grid lg:grid-cols-2 gap-10"><Esqueleto className="aspect-square !rounded-3xl" /><Esqueleto className="h-64" /></Pagina>;
  if (!p) {
    return (
      <Pagina className="py-16">
        <EstadoVacio titulo="Este producto ya no está en el catálogo" detalle="Puede que se haya retirado." accion={<Enlace href={url('/plantas')} className="text-hoja-700 font-bold underline">Ver el catálogo</Enlace>} />
      </Pagina>
    );
  }

  const volver = esPlanta(p) ? { href: url('/plantas'), label: 'Plantas' } : { href: url('/productos'), label: 'Productos e insumos' };
  const relacionados = datos.productos.filter(x => x.sku !== p.sku && esPlanta(x) === esPlanta(p) && x.stock > 0).slice(0, 4);
  const hayCuidados = !!(p.luz || p.riego);

  return (
    <Pagina className="py-8">
      <Enlace href={volver.href} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-hoja-800 mb-6">
        <ChevronLeft className="w-4 h-4" aria-hidden /> {volver.label}
      </Enlace>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
        <Imagen src={p.imagen} alt={p.nombre} className="w-full aspect-square rounded-[2rem] bg-slate-50" />

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-hoja-700">{p.categoriaNombre}</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-slate-900">{p.nombre}</h1>
            {p.nombreCientifico && <p className="italic text-slate-500">{p.nombreCientifico}{p.familia ? ` · ${p.familia}` : ''}</p>}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl font-extrabold text-slate-900">{soles(p.precio)}</span>
            <ChipStock p={p} />
          </div>
          <p className="text-xs text-slate-500 -mt-3">Precio unitario sin IGV: en tu boleta o factura se suma el 18% ({soles(Math.round(p.precio * 118) / 100)} con IGV).</p>

          {p.descripcion && <p className="text-base leading-relaxed text-slate-700">{p.descripcion}</p>}

          {/* Selección: se puede pedir más que el stock; esa parte la coordina un asesor */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <Contador valor={cantidad} cambiar={setCantidad} etiqueta={p.nombre} grande />
              <button
                onClick={() => { agregar(p.sku, cantidad); setPanel(true); }}
                className="flex-1 min-h-[52px] rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold"
              >
                Agregar a mi cotización · {soles(cantidad * p.precio)}
              </button>
            </div>
            <NotaStock stock={p.stock} cantidad={cantidad} />
            {cantidad <= p.stock && p.stock > 0 && <p className="text-xs text-slate-500">¿Necesitas más de {p.stock}? Súmalas igual: un asesor de ventas atiende la cantidad adicional.</p>}
          </div>

          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
            <li className="flex items-start gap-2"><ShieldCheck className="w-5 h-5 text-hoja-700 shrink-0" aria-hidden /> Sin pago en línea: coordinas el pago por WhatsApp.</li>
            <li className="flex items-start gap-2"><Truck className="w-5 h-5 text-hoja-700 shrink-0" aria-hidden /> Recojo en vivero o delivery a coordinar.</li>
          </ul>

          {hayCuidados && (
            <section aria-label="Cuidados" className="p-4 rounded-3xl border border-hoja-100 bg-hoja-50/60 space-y-2">
              <h2 className="text-lg font-extrabold text-slate-900">Cuidados</h2>
              {p.luz && <p className="flex items-start gap-2 text-sm"><Sun className="w-5 h-5 text-amber-600 shrink-0" aria-hidden /><span><strong>Luz:</strong> {p.luz}</span></p>}
              {p.riego && <p className="flex items-start gap-2 text-sm"><Droplets className="w-5 h-5 text-sky-700 shrink-0" aria-hidden /><span><strong>Riego:</strong> {p.riego}</span></p>}
            </section>
          )}

          <BotonCompartir titulo={p.nombre} />
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-4">También te puede interesar</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{relacionados.map(r => <TarjetaProducto key={r.sku} p={r} />)}</div>
        </section>
      )}
    </Pagina>
  );
}
