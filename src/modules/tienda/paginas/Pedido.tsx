import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Minus, Plus, Trash2 } from 'lucide-react';
import { Enlace } from '../../../app/router';
import { claseBoton, EstadoVacio, Esqueleto, InsigniaDisponibilidad } from '../../../components/ui';
import { enlaceWhatsapp } from '../datos';
import { FormularioSolicitud, Imagen, soles } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Pedido() {
  const { datos, carrito, cambiarCantidad, vaciar } = useTienda();
  const [confirmado, setConfirmado] = useState<string | null>(null);
  useEffect(() => fijarMetadatos({ titulo: 'Mi pedido', descripcion: 'Revisa tu selección y envíanos tu solicitud de pedido.' }), []);

  if (!datos) return <Pagina className="py-10"><Esqueleto className="h-64 !rounded-tarjeta" /></Pagina>;

  // Tras enviar, el carrito se vacía pero la confirmación se queda a la vista
  if (confirmado) {
    return (
      <Pagina className="py-16 max-w-2xl">
        <div role="status" className="p-8 rounded-tarjeta bg-exito-fondo text-exito space-y-2 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto" aria-hidden />
          <p className="font-serif text-2xl font-bold">¡Recibimos tu solicitud!</p>
          <p>Número de solicitud: <strong className="font-mono">{confirmado}</strong>. Te contactaremos para confirmar disponibilidad, delivery y pago.</p>
          <Enlace href="/plantas" className={claseBoton('primario', 'md', 'mt-3')}>Seguir viendo plantas</Enlace>
        </div>
      </Pagina>
    );
  }

  // Sólo productos que siguen en el catálogo; los que salieron se descartan del carrito
  const lineas = carrito
    .map(l => ({ ...l, p: datos.productos.find(x => x.sku === l.sku) }))
    .filter((l): l is typeof l & { p: NonNullable<typeof l.p> } => !!l.p);
  const total = lineas.reduce((a, l) => a + l.cantidad * l.p.precio, 0);
  const hayAgotados = lineas.some(l => l.p.disponibilidad === 'AGOTADO');

  if (!lineas.length) {
    return (
      <Pagina className="py-16">
        <EstadoVacio
          titulo="Tu pedido está vacío"
          detalle="Agrega plantas o insumos desde el catálogo."
          accion={<Enlace href="/plantas" className={claseBoton('primario', 'md')}>Ver plantas</Enlace>}
        />
      </Pagina>
    );
  }

  const textoWa = `Hola, quisiera hacer este pedido:\n${lineas.map(l => `• ${l.cantidad}× ${l.p.nombre} (${soles(l.p.precio)})`).join('\n')}\nTotal referencial: ${soles(total)}`;
  const wa = enlaceWhatsapp(datos.config, textoWa);

  return (
    <Pagina className="py-10 grid lg:grid-cols-[1.3fr_1fr] gap-10">
      <section aria-label="Productos de mi pedido">
        <h1 className="font-serif text-4xl font-bold text-bosque-950 mb-6">Mi pedido</h1>
        <ul className="divide-y divide-crema-300 border-y border-crema-300">
          {lineas.map(l => (
            <li key={l.sku} className="py-4 flex gap-4">
              <Imagen src={l.p.imagen} alt={l.p.nombre} className="w-20 h-20 rounded-control shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <Enlace href={`/producto/${encodeURIComponent(l.sku)}`} className="font-serif text-lg font-bold text-bosque-950 hover:underline">{l.p.nombre}</Enlace>
                <div className="flex items-center gap-2 flex-wrap"><span className="text-sm text-tinta-suave">{soles(l.p.precio)} c/u</span><InsigniaDisponibilidad valor={l.p.disponibilidad} /></div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-control border border-crema-300 bg-white" role="group" aria-label={`Cantidad de ${l.p.nombre}`}>
                    <button className="min-w-[40px] min-h-[40px] flex items-center justify-center" onClick={() => cambiarCantidad(l.sku, l.cantidad - 1)} aria-label="Menos"><Minus className="w-4 h-4" /></button>
                    <span className="w-8 text-center font-bold">{l.cantidad}</span>
                    <button className="min-w-[40px] min-h-[40px] flex items-center justify-center" onClick={() => cambiarCantidad(l.sku, l.cantidad + 1)} aria-label="Más"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => cambiarCantidad(l.sku, 0)} className="min-w-[40px] min-h-[40px] flex items-center justify-center text-error" aria-label={`Quitar ${l.p.nombre}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <span className="font-serif text-lg font-bold text-bosque-950 shrink-0">{soles(l.cantidad * l.p.precio)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-baseline pt-4">
          <span className="text-tinta-suave">Total referencial (con IGV)</span>
          <span className="font-serif text-3xl font-bold text-bosque-950">{soles(total)}</span>
        </div>
        <p className="text-xs text-tinta-suave mt-1">El costo de delivery y la disponibilidad final se confirman antes de coordinar el pago.</p>
        {hayAgotados && <p role="alert" className="mt-3 p-3 rounded-control bg-aviso-fondo text-aviso text-sm font-semibold">Algún producto está agotado; te ofreceremos una alternativa.</p>}
      </section>

      <div className="space-y-4 self-start">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={claseBoton('acento', 'lg', 'w-full')}>
            <MessageCircle className="w-5 h-5" aria-hidden /> Enviar pedido por WhatsApp
          </a>
        )}
        <div className="p-6 rounded-tarjeta bg-white border border-crema-300 shadow-suave">
          <FormularioSolicitud
            base={{ tipo: 'PEDIDO', items: lineas.map(l => ({ sku: l.sku, cantidad: l.cantidad })), mensaje: '' }}
            titulo={wa ? 'O déjanos tus datos' : 'Envíanos tu pedido'}
            boton="Enviar solicitud de pedido"
            alEnviar={id => { setConfirmado(id); vaciar(); }}
          />
        </div>
      </div>
    </Pagina>
  );
}
