// ==========================================
// METADATOS POR PÁGINA (título, descripción, Open Graph, canonical)
// Limitación de una SPA con Vite: los rastreadores de redes sociales no ejecutan JavaScript,
// así que la vista previa al compartir usa los metadatos de marca de index.html.
// Los navegadores y Google sí ven estos valores por página.
// ==========================================
const MARCA = 'AUREVIA';

function meta(atributo: 'name' | 'property', clave: string, valor: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${clave}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(atributo, clave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', valor);
}

export function fijarMetadatos({ titulo, descripcion, imagen }: { titulo: string; descripcion: string; imagen?: string }) {
  const completo = titulo === MARCA ? `${MARCA} | Plantas • Jardines • Vida Natural` : `${titulo} | ${MARCA}`;
  document.title = completo;
  meta('name', 'description', descripcion);
  meta('property', 'og:title', completo);
  meta('property', 'og:description', descripcion);
  meta('property', 'og:url', window.location.href);
  if (imagen) meta('property', 'og:image', imagen);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = window.location.origin + window.location.pathname;
}
