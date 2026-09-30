import { useId, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useErp } from '../store/ErpStore';
import type { CarpetaFoto } from '../lib/repo';

/** Subir foto desde la computadora o el celular (se reduce y se publica en el catálogo), o pegar un enlace. */
export function SubirFoto({ valor, cambiar, carpeta, nombre }: { valor?: string; cambiar: (url: string) => void; carpeta: CarpetaFoto; nombre: string }) {
  const { actions } = useErp();
  const id = useId();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo?: File) => {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    const r = await actions.subirFoto(archivo, carpeta, nombre || carpeta);
    setSubiendo(false);
    if (r.ok) cambiar(r.url);
    else setError(r.error);
  };

  return (
    <div className="flex gap-3 items-start">
      <div className="w-24 h-24 rounded-control border border-crema-300 bg-crema overflow-hidden flex items-center justify-center shrink-0">
        {valor ? <img src={valor} alt="Vista previa" className="w-full h-full object-cover" /> : <ImagePlus className="w-7 h-7 text-tinta-suave" aria-hidden />}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <label htmlFor={id} className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-control bg-bosque-950 text-white text-xs font-bold cursor-pointer ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ImagePlus className="w-4 h-4" aria-hidden />} {valor ? 'Cambiar foto' : 'Subir foto'}
          </label>
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { void elegir(e.target.files?.[0]); e.target.value = ''; }} />
          {valor && <button type="button" onClick={() => cambiar('')} className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-control border border-crema-300 text-xs font-bold text-error"><Trash2 className="w-4 h-4" aria-hidden /> Quitar</button>}
        </div>
        <input aria-label="Enlace de la foto" value={valor?.startsWith('data:') ? '' : valor ?? ''} onChange={e => cambiar(e.target.value.trim())} placeholder="…o pega un enlace https" className="w-full min-h-[36px] px-3 rounded-control bg-crema border border-crema-300 text-xs" />
        {error && <p role="alert" className="text-xs font-bold text-error">{error}</p>}
        <p className="text-[11px] text-tinta-suave">JPG, PNG o WEBP. Se ajusta sola a un tamaño liviano para la tienda.</p>
      </div>
    </div>
  );
}
