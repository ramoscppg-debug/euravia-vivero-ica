import { lazy, Suspense, useEffect } from 'react';
import { useUbicacion } from './router';
import { Cargando } from '../components/ui';

// Cada lado se descarga por separado: el cliente nunca baja el panel y el equipo no baja la tienda
const PanelApp = lazy(() => import('./PanelApp'));
const TiendaApp = lazy(() => import('../modules/tienda/TiendaApp'));

/**
 * Raíz: el enlace principal ("/") es el centro de control del equipo de ventas y el administrador;
 * la tienda de los clientes vive en "/tienda" (ése es el enlace que se comparte al público).
 */
export default function App() {
  const { ruta } = useUbicacion();
  const esTienda = ruta === '/tienda' || ruta.startsWith('/tienda/');

  // Enlaces antiguos a /panel siguen funcionando
  useEffect(() => {
    if (ruta === '/panel' || ruta.startsWith('/panel/')) window.history.replaceState(null, '', `/${window.location.hash}`);
  }, [ruta]);

  return (
    <Suspense fallback={<Cargando texto={esTienda ? 'Abriendo la tienda…' : 'Abriendo el centro de control…'} />}>
      {esTienda ? <TiendaApp /> : <PanelApp />}
    </Suspense>
  );
}
