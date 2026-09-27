import { useState, type FormEvent } from 'react';
import { CheckCircle2, Leaf, MessageCircle, Share2 } from 'lucide-react';
import { Enlace } from '../../app/router';
import { Boton, claseBoton, InsigniaDisponibilidad } from '../../components/ui';
import type { ProductoPublico } from '../../domain/types';
import { soles } from '../../lib/formato';
import { enlaceWhatsapp, enviarSolicitud, type NuevaSolicitud } from './datos';

export { soles };
import { useTienda } from './TiendaApp';

/** Foto existente del producto; si no hay, un marco neutro (no se inventan imágenes). */
export function Imagen({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) {
    return (
      <div role="img" aria-label={alt} className={`bg-gradient-to-br from-bosque-100 to-crema-200 flex items-center justify-center ${className}`}>
        <Leaf className="w-10 h-10 text-bosque-600/50" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFallo(true)} className={`object-cover ${className}`} />;
}

export function TarjetaProducto({ p }: { p: ProductoPublico }) {
  const { agregar } = useTienda();
  const [agregado, setAgregado] = useState(false);
  return (
    <article className="group bg-white rounded-tarjeta border border-crema-300 overflow-hidden flex flex-col shadow-suave hover:shadow-elevada transition-shadow">
      <Enlace href={`/producto/${encodeURIComponent(p.sku)}`} className="block" aria-label={`${p.nombre}, ver detalle`}>
        <Imagen src={p.imagen} alt={p.nombre} className="w-full aspect-[4/5] group-hover:scale-[1.02] transition-transform duration-500" />
      </Enlace>
      <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
        <div className="flex flex-col-reverse items-start gap-1 sm:flex-row sm:justify-between sm:gap-2">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-tinta-suave leading-tight">{p.categoriaNombre}</span>
          <InsigniaDisponibilidad valor={p.disponibilidad} />
        </div>
        <h3 className="font-serif text-base sm:text-lg font-bold leading-snug text-bosque-950">
          <Enlace href={`/producto/${encodeURIComponent(p.sku)}`} className="hover:underline">{p.nombre}</Enlace>
        </h3>
        {p.nombreCientifico && <p className="text-xs italic text-tinta-suave -mt-1">{p.nombreCientifico}</p>}
        <div className="mt-auto pt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-serif text-lg sm:text-xl font-bold text-bosque-950 whitespace-nowrap">{soles(p.precio)}</span>
          <Boton
            tamano="sm"
            variante={agregado ? 'secundario' : 'primario'}
            disabled={p.disponibilidad === 'AGOTADO'}
            onClick={() => { agregar(p.sku); setAgregado(true); setTimeout(() => setAgregado(false), 1500); }}
            aria-label={`Agregar ${p.nombre} a mi pedido`}
          >
            {agregado ? <><CheckCircle2 className="w-4 h-4" aria-hidden /> Agregado</> : p.disponibilidad === 'AGOTADO' ? 'Agotado' : 'Agregar'}
          </Boton>
        </div>
      </div>
    </article>
  );
}

/**
 * Consulta por WhatsApp si el dueño configuró su número. Si no, lleva al formulario de contacto
 * (nunca un enlace a un número inventado).
 */
export function BotonConsulta({ texto, etiqueta = 'Consultar por WhatsApp', alternativa, className = '' }: { texto: string; etiqueta?: string; alternativa: string; className?: string }) {
  const { datos } = useTienda();
  const url = datos ? enlaceWhatsapp(datos.config, texto) : null;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={claseBoton('acento', 'lg', className)}>
        <MessageCircle className="w-5 h-5" aria-hidden /> {etiqueta}
      </a>
    );
  }
  const contenido = <><MessageCircle className="w-5 h-5" aria-hidden /> Enviar una consulta</>;
  // Un ancla de la misma página (#cotizar) usa el salto nativo del navegador
  return alternativa.startsWith('#')
    ? <a href={alternativa} className={claseBoton('acento', 'lg', className)}>{contenido}</a>
    : <Enlace href={alternativa} className={claseBoton('acento', 'lg', className)}>{contenido}</Enlace>;
}

export function BotonCompartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const compartir = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: titulo, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch {
      // la persona canceló el diálogo de compartir
    }
  };
  return (
    <Boton variante="secundario" onClick={compartir} aria-live="polite">
      <Share2 className="w-4 h-4" aria-hidden /> {copiado ? 'Enlace copiado' : 'Compartir'}
    </Boton>
  );
}

/** Formulario de solicitud (pedido, cotización de servicio o consulta). Queda registrado para el equipo. */
export function FormularioSolicitud({ base, titulo, boton, alEnviar }: {
  base: Omit<NuevaSolicitud, 'nombre' | 'telefono'>;
  titulo: string;
  boton: string;
  alEnviar?: (id: string) => void;
}) {
  const { datos } = useTienda();
  const [f, setF] = useState({ nombre: '', telefono: '', email: '', distrito: '', mensaje: base.mensaje ?? '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const id = await enviarSolicitud({ ...base, ...f }, datos?.productos ?? []);
      setNumero(id);
      alEnviar?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };

  if (numero) {
    return (
      <div role="status" className="p-6 rounded-tarjeta bg-exito-fondo text-exito space-y-1">
        <p className="font-serif text-xl font-bold flex items-center gap-2"><CheckCircle2 className="w-6 h-6" aria-hidden /> ¡Recibimos tu solicitud!</p>
        <p className="text-sm">Número de solicitud: <strong className="font-mono">{numero}</strong>. El equipo de AUREVIA te contactará al teléfono que dejaste.</p>
      </div>
    );
  }

  const campo = 'w-full min-h-[44px] px-3 py-2 rounded-control bg-white border border-crema-300 text-tinta placeholder:text-tinta-suave/70 focus:border-bosque-600';
  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      <p className="font-serif text-xl font-bold text-bosque-950">{titulo}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Nombre *
          <input required autoComplete="name" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} className={`${campo} mt-1`} maxLength={120} />
        </label>
        <label className="block text-sm font-semibold">Teléfono o WhatsApp *
          <input required type="tel" autoComplete="tel" inputMode="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} className={`${campo} mt-1`} maxLength={20} placeholder="+51 9..." />
        </label>
        <label className="block text-sm font-semibold">Correo (opcional)
          <input type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={`${campo} mt-1`} maxLength={120} />
        </label>
        <label className="block text-sm font-semibold">Distrito (opcional)
          <input autoComplete="address-level3" value={f.distrito} onChange={e => setF({ ...f, distrito: e.target.value })} className={`${campo} mt-1`} maxLength={80} />
        </label>
      </div>
      <label className="block text-sm font-semibold">Mensaje
        <textarea value={f.mensaje} onChange={e => setF({ ...f, mensaje: e.target.value })} className={`${campo} mt-1 min-h-[96px]`} maxLength={1000} />
      </label>
      {error && <p role="alert" className="p-3 rounded-control bg-error-fondo text-error text-sm font-semibold">{error}</p>}
      <Boton type="submit" tamano="lg" cargando={enviando} className="w-full sm:w-auto">{boton}</Boton>
      <p className="text-xs text-tinta-suave">Usamos tus datos sólo para responder esta solicitud.</p>
    </form>
  );
}
