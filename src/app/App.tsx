import { lazy, Suspense } from 'react';
import { useUbicacion } from './router';
import TiendaApp from '../modules/tienda/TiendaApp';
import { Cargando } from '../components/ui';

// El panel (ERP completo) sólo se descarga cuando alguien entra a /panel
const PanelApp = lazy(() => import('./PanelApp'));

/** Raíz: la tienda pública vive en "/", el centro de control privado en "/panel". */
export default function App() {
  const { ruta } = useUbicacion();
  if (ruta === '/panel' || ruta.startsWith('/panel/')) {
    return (
      <Suspense fallback={<Cargando texto="Abriendo el centro de control…" />}>
        <PanelApp />
      </Suspense>
    );
  }
  return <TiendaApp />;
}
