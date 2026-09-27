import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useUbicacion } from '../../../app/router';
import { enlaceWhatsapp, enviarSolicitud } from '../datos';
import { Titulo } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Contacto() {
  const { datos } = useTienda();
  const { query } = useUbicacion();
  const sku = query.get('producto');
  const producto = sku ? datos?.productos.find(p => p.sku === sku) : undefined;
  useEffect(() => fijarMetadatos({ titulo: 'Contacto', descripcion: 'Escríbenos para consultas sobre plantas, insumos y servicios de jardinería.' }), []);

  const c = datos?.config;
  const wa = c ? enlaceWhatsapp(c, 'Hola, tengo una consulta.') : null;

  return (
    <Pagina className="py-10 grid lg:grid-cols-[1fr_1.2fr] gap-10">
      <div className="space-y-5">
        <Titulo nivel="h1" antetitulo="Contacto" titulo="Conversemos" bajada="Escríbenos y un asesor te responde a la brevedad." />
        {(c?.direccion || c?.horario || c?.email) && (
          <ul className="space-y-3 text-slate-700">
            {c?.direccion && <li className="flex gap-3"><MapPin className="w-5 h-5 text-hoja-700 shrink-0" aria-hidden />{c.direccion}</li>}
            {c?.horario && <li className="flex gap-3"><Clock className="w-5 h-5 text-hoja-700 shrink-0" aria-hidden />{c.horario}</li>}
            {c?.email && <li className="flex gap-3"><Mail className="w-5 h-5 text-hoja-700 shrink-0" aria-hidden /><a href={`mailto:${c.email}`} className="underline">{c.email}</a></li>}
          </ul>
        )}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] px-6 rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold items-center gap-2"><MessageCircle className="w-5 h-5" aria-hidden /> Escribir por WhatsApp</a>}
      </div>
      <div className="p-6 rounded-3xl bg-white border border-slate-200">
        <FormularioConsulta key={sku ?? 'general'} inicial={producto ? `Consulta sobre ${producto.nombre} (${producto.sku}).` : ''} />
      </div>
    </Pagina>
  );
}

function FormularioConsulta({ inicial }: { inicial: string }) {
  const { datos } = useTienda();
  const [f, setF] = useState({ nombre: '', telefono: '', email: '', mensaje: inicial });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      setNumero(await enviarSolicitud({ tipo: 'CONSULTA', ...f }, datos?.productos ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };

  if (numero) {
    return (
      <div role="status" className="p-6 rounded-3xl bg-hoja-50 text-hoja-900 space-y-1">
        <p className="text-xl font-extrabold flex items-center gap-2"><CheckCircle2 className="w-6 h-6" aria-hidden /> ¡Recibimos tu consulta!</p>
        <p className="text-sm">Número: <strong className="font-mono">{numero}</strong>. Te contactaremos al teléfono que dejaste.</p>
      </div>
    );
  }

  const campo = 'w-full min-h-[48px] px-4 rounded-2xl bg-white border border-slate-300 focus:border-hoja-600 outline-none';
  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      <p className="text-xl font-extrabold text-slate-900">Envíanos tu consulta</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">Nombre *<input required autoComplete="name" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} className={`${campo} mt-1`} maxLength={120} /></label>
        <label className="block text-sm font-bold text-slate-700">Teléfono o WhatsApp *<input required type="tel" autoComplete="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} className={`${campo} mt-1`} maxLength={20} placeholder="+51 9..." /></label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Correo (opcional)<input type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={`${campo} mt-1`} maxLength={120} /></label>
      <label className="block text-sm font-bold text-slate-700">Mensaje<textarea value={f.mensaje} onChange={e => setF({ ...f, mensaje: e.target.value })} className={`${campo} mt-1 min-h-[110px] py-3`} maxLength={1000} /></label>
      {error && <p role="alert" className="p-3 rounded-2xl bg-error-fondo text-error text-sm font-semibold">{error}</p>}
      <button type="submit" disabled={enviando} className="w-full sm:w-auto min-h-[52px] px-8 rounded-full bg-hoja-700 hover:bg-hoja-800 disabled:opacity-60 text-white font-bold">{enviando ? 'Enviando…' : 'Enviar consulta'}</button>
      <p className="text-xs text-slate-500">Usamos tus datos sólo para responder esta consulta.</p>
    </form>
  );
}
