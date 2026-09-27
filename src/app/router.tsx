// ==========================================
// ENRUTADOR MÍNIMO (History API, sin dependencias)
// Rutas públicas de la tienda en "/", centro de control privado en "/panel".
// vercel.json ya reescribe cualquier ruta a index.html, así los enlaces compartidos abren directo.
// ==========================================
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const EVENTO = 'aurevia:navegar';

export function navegar(ruta: string, { reemplazar = false } = {}) {
  if (ruta === window.location.pathname + window.location.search + window.location.hash) return;
  if (reemplazar) window.history.replaceState(null, '', ruta);
  else window.history.pushState(null, '', ruta);
  window.dispatchEvent(new Event(EVENTO));
  if (!ruta.includes('#')) window.scrollTo({ top: 0 });
}

export interface Ubicacion {
  ruta: string; // pathname sin barra final
  query: URLSearchParams;
}

const leer = (): Ubicacion => ({
  ruta: window.location.pathname.replace(/\/+$/, '') || '/',
  query: new URLSearchParams(window.location.search)
});

/** Ruta actual; se actualiza con navegar() y con los botones atrás/adelante. */
export function useUbicacion(): Ubicacion {
  const [u, setU] = useState(leer);
  useEffect(() => {
    const actualizar = () => setU(leer());
    window.addEventListener('popstate', actualizar);
    window.addEventListener(EVENTO, actualizar);
    return () => {
      window.removeEventListener('popstate', actualizar);
      window.removeEventListener(EVENTO, actualizar);
    };
  }, []);
  return u;
}

/** Enlace interno: se comporta como <a> (abrir en pestaña nueva, copiar enlace) pero sin recargar. */
export function Enlace({ href, onClick, ...resto }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const alHacerClic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || resto.target === '_blank') return;
    e.preventDefault();
    navegar(href);
  };
  return <a href={href} onClick={alHacerClic} {...resto} />;
}
