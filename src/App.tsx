import type { ComponentType } from 'react';
import Header from './layout/Header';
import Login, { Cargando, SinRol } from './layout/Login';
import ModalHost from './layout/ModalHost';
import Sidebar from './layout/Sidebar';
import type { TabId } from './layout/navigation';
import Ajustes from './modules/admin/Ajustes';
import Comprobantes from './modules/admin/Comprobantes';
import Contabilidad from './modules/admin/Contabilidad';
import Detracciones from './modules/admin/Detracciones';
import Guias from './modules/admin/Guias';
import Planilla from './modules/admin/Planilla';
import Clientes from './modules/clientes/Clientes';
import Dashboard from './modules/inicio/Dashboard';
import Bajas from './modules/inventario/Bajas';
import Kardex from './modules/inventario/Kardex';
import Proyectos from './modules/servicios/Proyectos';
import Caja from './modules/ventas/Caja';
import Catalogo from './modules/ventas/Catalogo';
import Pedidos from './modules/ventas/Pedidos';
import { AuthProvider, useAuth } from './store/AuthStore';
import { ErpProvider, useErp } from './store/ErpStore';
import { UiProvider, useUi } from './store/UiStore';

const SCREENS: Record<TabId, ComponentType> = {
  dashboard: Dashboard,
  caja: Caja,
  catalogo: Catalogo,
  pedidos: Pedidos,
  jardineria: Proyectos,
  crm: Clientes,
  kardex: Kardex,
  bajas: Bajas,
  guias: Guias,
  sunat: Comprobantes,
  detracciones: Detracciones,
  contabilidad: Contabilidad,
  planilla: Planilla,
  configuracion: Ajustes
};

function Shell() {
  const { tab } = useUi();
  const { cargando, errorCarga, actions } = useErp();
  const Screen = SCREENS[tab];
  return (
    <div className="flex h-screen bg-[#faf8f5] text-[#1c2e24] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[#fbf9f6]">
          {errorCarga && (
            <div role="alert" className="p-4 rounded-2xl bg-[#fee2e2] text-[#b91c1c] text-xs font-semibold flex items-center justify-between gap-3">
              <span>No se pudieron cargar los datos: {errorCarga}</span>
              <button onClick={() => void actions.recargar()} className="px-3 py-1.5 rounded-xl bg-[#b91c1c] text-white font-bold shrink-0">Reintentar</button>
            </div>
          )}
          {cargando ? <p className="text-xs font-bold text-[#8fa89b]">Cargando datos del vivero...</p> : <Screen />}
        </div>
      </main>
      <ModalHost />
    </div>
  );
}

/** Decide qué ve la persona: login, aviso de "sin rol" o el ERP con los permisos de su rol. */
function Portero() {
  const { modo, cargando, session, perfil } = useAuth();
  if (modo === 'nube') {
    if (cargando) return <Cargando texto="Conectando..." />;
    if (!session) return <Login />;
    if (!perfil?.rol) return <SinRol />;
  }
  const rol = perfil?.rol ?? 'dueno';
  return (
    <ErpProvider key={perfil?.id} nube={modo === 'nube'} usuario={perfil?.nombre ?? ''}>
      <UiProvider rol={rol}>
        <Shell />
      </UiProvider>
    </ErpProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Portero />
    </AuthProvider>
  );
}
