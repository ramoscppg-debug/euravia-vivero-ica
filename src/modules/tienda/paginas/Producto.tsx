import { useEffect, useState } from 'react';
import { ChevronLeft, Droplets, Minus, Plus, Sun } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { Boton, EstadoVacio, Esqueleto, InsigniaDisponibilidad } from '../../../components/ui';
import { esPlanta } from '../datos';
import { BotonCompartir, BotonConsulta, Imagen, soles, TarjetaProducto } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Producto({ sku }: { sku: string }) {
  const { datos, agregar } = useTienda();
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const p = datos?.productos.find(x => x.sku === sku);

  useEffect(() => {
    if (p) fijarMetadatos({ titulo: p.nombre, descripcion: p.descripcion ?? `${p.nombre} en AUREVIA: ${soles(p.precio)}.`, imagen: p.imagen });
  }, [p]);

  if (!datos) return <Pagina className="py-10 grid lg:grid-cols-2 gap-10"><Esqueleto className="aspect-square !rounded-tarjeta" /><Esqueleto className="h-64" /></Pagina>;
  if (!p) {
    return (
      <Pagina className="py-16">
        <EstadoVacio titulo="Este producto ya no está en el catálogo" detalle="Puede que se haya agotado o retirado." accion={<Enlace href="/plantas" className="text-terracota font-bold underline">Ver el catálogo</Enlace>} />
      </Pagina>
    );
  }

  const volver = esPlanta(p) ? { href: '/plantas', label: 'Plantas' } : { href: '/productos', label: 'Productos e insumos' };
  const relacionados = datos.productos.filter(x => x.sku !== p.sku && esPlanta(x) === esPlanta(p) && x.disponibilidad !== 'AGOTADO').slice(0, 4);
  const hayCuidados = !!(p.luz || p.riego);
  const agotado = p.disponibilidad === 'AGOTADO';

  return (
    <Pagina className="py-8">
      <Enlace href={volver.href} className="inline-flex items-center gap-1 text-sm font-semibold text-tinta-suave hover:text-bosque-950 mb-6">
        <ChevronLeft className="w-4 h-4" aria-hidden /> {volver.label}
      </Enlace>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
        <Imagen src={p.imagen} alt={p.nombre} className="w-full aspect-square rounded-tarjeta shadow-suave" />

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{p.categoriaNombre}</p>
            <h1 className="font-serif text-4xl font-bold leading-tight text-bosque-950">{p.nombre}</h1>
            {p.nombreCientifico && <p className="italic text-tinta-suave">{p.nombreCientifico}{p.familia ? ` · ${p.familia}` : ''}</p>}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-serif text-3xl font-bold text-bosque-950">{soles(p.precio)}</span>
            <InsigniaDisponibilidad valor={p.disponibilidad} />
          </div>
          <p className="text-xs text-tinta-suave -mt-3">Precio con IGV. Te confirmamos disponibilidad y delivery antes de coordinar el pago.</p>

          {p.descripcion && <p className="text-base leading-relaxed text-tinta">{p.descripcion}</p>}

          {hayCuidados && (
            <section aria-label="Cuidados" className="p-4 rounded-tarjeta bg-bosque-50 border border-bosque-100 space-y-2">
              <h2 className="font-serif text-lg font-bold text-bosque-950">Cuidados</h2>
              {p.luz && <p className="flex items-start gap-2 text-sm"><Sun className="w-5 h-5 text-oro shrink-0" aria-hidden /><span><strong>Luz:</strong> {p.luz}</span></p>}
              {p.riego && <p className="flex items-start gap-2 text-sm"><Droplets className="w-5 h-5 text-bosque-600 shrink-0" aria-hidden /><span><strong>Riego:</strong> {p.riego}</span></p>}
            </section>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="flex items-center rounded-control border border-crema-300 bg-white self-start" role="group" aria-label="Cantidad">
              <button className="min-w-[44px] min-h-[48px] flex items-center justify-center disabled:opacity-40" onClick={() => setCantidad(c => Math.max(1, c - 1))} disabled={cantidad <= 1 || agotado} aria-label="Menos"><Minus className="w-4 h-4" /></button>
              <span className="w-10 text-center font-bold" aria-live="polite">{cantidad}</span>
              <button className="min-w-[44px] min-h-[48px] flex items-center justify-center disabled:opacity-40" onClick={() => setCantidad(c => Math.min(99, c + 1))} disabled={agotado} aria-label="Más"><Plus className="w-4 h-4" /></button>
            </div>
            <Boton tamano="lg" className="flex-1" disabled={agotado} onClick={() => { agregar(p.sku, cantidad); setAgregado(true); }}>
              {agotado ? 'Agotado' : 'Agregar a mi pedido'}
            </Boton>
          </div>
          {agregado && (
            <p role="status" className="p-3 rounded-control bg-exito-fondo text-exito text-sm font-semibold">
              Agregado. <Enlace href="/pedido" className="underline">Ver mi pedido</Enlace>
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <BotonConsulta
              texto={`Hola, quisiera consultar por ${p.nombre} (${p.sku}): ${window.location.href}`}
              alternativa={`/contacto?producto=${encodeURIComponent(p.sku)}`}
            />
            <BotonCompartir titulo={p.nombre} />
          </div>
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl font-bold text-bosque-950 mb-4">También te puede interesar</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{relacionados.map(r => <TarjetaProducto key={r.sku} p={r} />)}</div>
        </section>
      )}
    </Pagina>
  );
}
