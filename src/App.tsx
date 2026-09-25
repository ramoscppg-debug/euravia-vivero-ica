import type { ComponentType } from 'react';
import Header from './layout/Header';
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
import { ErpProvider } from './store/ErpStore';
import { UiProvider, useUi } from './store/UiStore';

const SCREENS: Record<TabId, ComponentType> = {
  dashboard: Dashboard,
  caja: Caja,
  catalogo: Catalogo,
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
  const Screen = SCREENS[tab];
  return (
    <div className="flex h-screen bg-[#faf8f5] text-[#1c2e24] overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[#fbf9f6]">
          <Screen />
        </div>
      </main>
      <ModalHost />
    </div>
  );
}

export default function App() {
  return (
    <ErpProvider>
      <UiProvider>
        <Shell />
      </UiProvider>
    </ErpProvider>
  );
}
