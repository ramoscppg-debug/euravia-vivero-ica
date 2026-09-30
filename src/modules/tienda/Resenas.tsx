// ==========================================
// OPINIONES DE CLIENTES (tienda)
// Se muestran sólo las aprobadas por el equipo. El formulario las deja "por aprobar".
// ==========================================
import { useState } from 'react';
import { Star } from 'lucide-react';
import { enviarResena, type ResenaPublica } from './datos';
import { Imagen } from './componentes';

export function Estrellas({ valor, tamano = 'w-4 h-4' }: { valor: number; tamano?: string }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-500" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`${tamano} ${i <= valor ? 'fill-amber-400' : 'text-slate-300'}`} aria-hidden />)}
    </span>
  );
}

export function ListaResenas({ resenas }: { resenas: ResenaPublica[] }) {
  if (!resenas.length) return null;
  const promedio = resenas.reduce((a, r) => a + r.estrellas, 0) / resenas.length;
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-slate-600"><Estrellas valor={Math.round(promedio)} /> <b className="text-slate-900">{promedio.toFixed(1)}</b> de 5 · {resenas.length} opinión(es)</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resenas.map(r => (
          <li key={r.id} className="p-5 rounded-3xl border border-slate-200 bg-white space-y-2">
            {r.foto && <Imagen src={r.foto} alt={`Foto de ${r.nombre}`} className="w-full aspect-[4/3] rounded-2xl" />}
            <Estrellas valor={r.estrellas} />
            <p className="text-slate-700 text-sm leading-relaxed">“{r.texto}”</p>
            <p className="text-xs font-bold text-slate-900">{r.nombre}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormResena({ sku }: { sku?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ nombre: '', telefono: '', estrellas: 5, texto: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const campo = 'w-full min-h-[44px] px-4 rounded-2xl bg-white border border-slate-300 text-slate-900 focus:border-hoja-600 outline-none';

  if (enviado) return <p role="status" className="p-4 rounded-2xl bg-hoja-50 text-hoja-900 font-semibold">¡Gracias por tu opinión! La publicaremos después de revisarla.</p>;
  if (!abierto) return <button onClick={() => setAbierto(true)} className="min-h-[44px] px-5 rounded-full border border-hoja-700 text-hoja-800 font-bold">Dejar mi opinión</button>;

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await enviarResena({ ...f, sku });
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section aria-label="Deja tu opinión" className="p-5 rounded-3xl bg-slate-50 space-y-3 max-w-xl">
      <p className="font-extrabold text-slate-900">Cuéntanos tu experiencia</p>
      <div role="radiogroup" aria-label="Calificación" className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} type="button" role="radio" aria-checked={f.estrellas === i} aria-label={`${i} estrella(s)`} onClick={() => setF({ ...f, estrellas: i })}>
            <Star className={`w-8 h-8 ${i <= f.estrellas ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden />
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm font-bold text-slate-700">Nombre *<input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} maxLength={80} className={`${campo} mt-1`} /></label>
        <label className="block text-sm font-bold text-slate-700">WhatsApp * <span className="font-normal text-slate-500">(no se publica)</span><input type="tel" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} maxLength={20} className={`${campo} mt-1`} /></label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Tu opinión *<textarea value={f.texto} onChange={e => setF({ ...f, texto: e.target.value })} maxLength={600} className={`${campo} mt-1 min-h-[100px] py-3`} /></label>
      {error && <p role="alert" className="p-3 rounded-2xl bg-error-fondo text-error text-sm font-semibold">{error}</p>}
      <button onClick={() => void enviar()} disabled={enviando} className="min-h-[48px] px-6 rounded-full bg-hoja-700 hover:bg-hoja-800 disabled:opacity-60 text-white font-bold">{enviando ? 'Enviando…' : 'Enviar opinión'}</button>
    </section>
  );
}
