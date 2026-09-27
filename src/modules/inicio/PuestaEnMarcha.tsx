import { useState } from 'react';
import { Check, ChevronRight, Copy, Rocket } from 'lucide-react';
import type { TabId } from '../../layout/navigation';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

interface Paso {
  titulo: string;
  detalle: string;
  hecho: boolean;
  tab: TabId;
  accion: string;
}

/** Guía para dejar el negocio listo para vender: se oculta sola cuando todo está completo. */
export default function PuestaEnMarcha() {
  const { state } = useErp();
  const { setTab, open } = useUi();
  const [copiado, setCopiado] = useState(false);
  const { company, tiendaConfig, serviciosPublicos, products } = state;
  const conFoto = products.filter(p => p.fullImage).length;
  const conStock = products.filter(p => p.stock > 0).length;

  const pasos: Paso[] = [
    { titulo: 'Datos de tu empresa', detalle: 'RUC y razón social para emitir boletas y facturas.', hecho: /^\d{11}$/.test(company.ruc) && !!company.razonSocial.trim(), tab: 'configuracion', accion: 'Completar' },
    { titulo: 'WhatsApp de ventas', detalle: 'A este número llegan los pedidos confirmados en la tienda.', hecho: !!tiendaConfig.whatsapp, tab: 'configuracion', accion: 'Configurar' },
    { titulo: 'Tus servicios', detalle: 'Diseño, mantenimiento, riego… para que los clientes los coticen.', hecho: serviciosPublicos.some(s => s.visible), tab: 'servicios-tienda', accion: 'Agregar' },
    { titulo: 'Tus productos', detalle: 'Uno por uno o todos juntos desde Excel.', hecho: products.length > 0, tab: 'catalogo', accion: 'Cargar' },
    { titulo: 'Fotos del catálogo', detalle: products.length ? `${conFoto} de ${products.length} productos con foto.` : 'Las fotos venden: súbelas desde el celular.', hecho: products.length > 0 && conFoto === products.length, tab: 'catalogo', accion: 'Subir fotos' },
    { titulo: 'Stock disponible', detalle: products.length ? `${conStock} de ${products.length} productos con stock.` : 'Registra el stock inicial al crear cada producto.', hecho: products.length > 0 && conStock === products.length, tab: 'catalogo', accion: 'Sumar stock' }
  ];
  const hechos = pasos.filter(p => p.hecho).length;
  if (hechos === pasos.length) return null;
  const siguiente = pasos.find(p => !p.hecho)!;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tienda`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles */ }
  };

  return (
    <section aria-label="Pon en marcha tu negocio" className="bg-white rounded-3xl border-2 border-bosque-700/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-bosque-700 text-white"><Rocket className="w-5 h-5" aria-hidden /></span>
          <div>
            <h3 className="font-extrabold text-tinta">Pon en marcha tu negocio</h3>
            <p className="text-xs text-tinta-suave">{hechos} de {pasos.length} pasos listos · sigue con: <b>{siguiente.titulo}</b></p>
          </div>
        </div>
        <button onClick={() => void copiar()} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-control border border-crema-300 text-xs font-bold">
          <Copy className="w-4 h-4" aria-hidden /> {copiado ? 'Enlace copiado' : 'Copiar enlace de la tienda'}
        </button>
      </div>
      <div className="h-2 rounded-full bg-crema-200" role="progressbar" aria-valuemin={0} aria-valuemax={pasos.length} aria-valuenow={hechos} aria-label="Avance">
        <div className="h-2 rounded-full bg-bosque-700 transition-all" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <button
              onClick={() => (p.titulo === 'Tus productos' && !p.hecho ? open({ type: 'producto' }) : setTab(p.tab))}
              className={`w-full h-full text-left p-3 rounded-2xl border flex gap-3 items-start transition ${p.hecho ? 'bg-crema border-crema-300' : 'bg-white border-crema-300 hover:border-bosque-700'}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${p.hecho ? 'bg-bosque-700 text-white' : 'bg-crema-200 text-tinta'}`}>
                {p.hecho ? <Check className="w-4 h-4" aria-label="Listo" /> : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-bold ${p.hecho ? 'text-tinta-suave line-through' : 'text-tinta'}`}>{p.titulo}</span>
                <span className="block text-[11px] text-tinta-suave">{p.detalle}</span>
              </span>
              {!p.hecho && <span className="text-[11px] font-bold text-bosque-700 flex items-center shrink-0">{p.accion}<ChevronRight className="w-3.5 h-3.5" aria-hidden /></span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
