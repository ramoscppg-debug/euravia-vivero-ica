import { ChevronDown, ExternalLink, LayoutDashboard, LogOut, X } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { blockOf, bloquesPara, puedeVer, ROL_ETIQUETA } from './navigation';

/** Menú por áreas: sólo el área activa despliega sus secciones (menos ruido, mismo alcance). */
export default function Sidebar() {
  const { state } = useErp();
  const { tab, setTab, menuMovil, setMenuMovil } = useUi();
  const { modo, perfil, salir } = useAuth();
  const { company } = state;
  const rol = perfil?.rol ?? 'dueno';
  const activa = blockOf(tab)?.id;
  const nombre = company.nombreComercial.split(' - ')[0] || company.razonSocial || 'AUREVIA';

  return (
    <>
      {menuMovil && <div className="fixed inset-0 z-40 bg-bosque-950/60 lg:hidden" onClick={() => setMenuMovil(false)} aria-hidden />}
      <aside id="menu-panel" aria-label="Menú del centro de control" className={`fixed inset-y-0 left-0 z-50 w-72 bg-bosque-950 text-white flex flex-col shrink-0 border-r border-bosque-900 shadow-2xl transition-transform lg:static lg:z-30 lg:translate-x-0 lg:shadow-none ${menuMovil ? 'translate-x-0' : '-translate-x-full'}`}>
        {menuMovil && <button onClick={() => setMenuMovil(false)} className="lg:hidden absolute top-3 right-3 p-2 rounded-xl text-bosque-200 hover:bg-bosque-800" aria-label="Cerrar menú"><X className="w-5 h-5" /></button>}

        <div className="flex items-center gap-3 px-5 h-20 border-b border-bosque-900 shrink-0">
          <img src="/logo.jpg" alt="" className="w-11 h-11 rounded-2xl object-cover bg-white p-0.5" />
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-[0.14em] text-white truncate">{nombre.toUpperCase()}</h1>
            <p className="text-[10px] text-bosque-200 font-semibold tracking-wider uppercase">Centro de control</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 text-sm">
          {puedeVer(rol, 'dashboard') && (
            <button onClick={() => setTab('dashboard')} aria-current={tab === 'dashboard' ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition ${tab === 'dashboard' ? 'bg-white text-bosque-950' : 'text-bosque-100 hover:bg-bosque-900'}`}>
              <LayoutDashboard className="w-4 h-4" aria-hidden /> Inicio
            </button>
          )}

          {bloquesPara(rol).map(block => {
            const abierta = activa === block.id;
            const pendientes = block.items.reduce((a, i) => a + Number(i.badge?.(state) ?? 0), 0);
            return (
              <div key={block.id}>
                <button onClick={() => { if (!abierta) setTab(block.items[0].id); }} aria-expanded={abierta}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition ${abierta ? 'text-white bg-bosque-900' : 'text-bosque-100 hover:bg-bosque-900'}`}>
                  <block.icon className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{block.label}</span>
                  {!abierta && pendientes > 0 && <span className="min-w-[20px] px-1.5 py-0.5 rounded-full bg-oro text-bosque-950 text-[10px] font-extrabold">{pendientes}</span>}
                  <ChevronDown className={`w-4 h-4 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {abierta && (
                  <div className="mt-1 mb-2 ml-5 pl-3 border-l border-bosque-800 space-y-0.5">
                    {block.items.map(item => {
                      const b = item.badge?.(state);
                      return (
                        <button key={item.id} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition ${tab === item.id ? 'bg-white text-bosque-950 font-bold' : 'text-bosque-200 hover:text-white hover:bg-bosque-900'}`}>
                          <span className="text-left">{item.label}</span>
                          {b && <span className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${tab === item.id ? 'bg-bosque-950 text-white' : 'bg-oro text-bosque-950'}`}>{b}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-bosque-900 space-y-2 shrink-0">
          <a href="/tienda" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-bosque-100 hover:bg-bosque-900">
            <ExternalLink className="w-4 h-4" aria-hidden /> Ver tienda de clientes
          </a>
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-oro text-bosque-950 font-extrabold flex items-center justify-center shrink-0">
              {((modo === 'nube' && perfil ? perfil.nombre : nombre) || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-semibold text-white truncate">{modo === 'nube' && perfil ? perfil.nombre : nombre}</p>
              <p className="text-bosque-200">{modo === 'nube' ? ROL_ETIQUETA[rol] : 'Modo demo'}</p>
            </div>
            {modo === 'nube' && (
              <button onClick={() => void salir()} title="Cerrar sesión" aria-label="Cerrar sesión" className="p-2 hover:bg-bosque-900 rounded-xl text-bosque-100">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
