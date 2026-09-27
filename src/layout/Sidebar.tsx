import { LayoutDashboard, LogOut, Settings, X } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { bloquesPara, puedeVer, ROL_ETIQUETA } from './navigation';

const itemClass = (active: boolean, main = false) =>
  `w-full flex items-center justify-between px-3.5 ${main ? 'py-2.5' : 'py-2'} rounded-2xl font-medium transition-all ${
    active
      ? 'bg-gradient-to-r from-bosque-800 to-[#1c553d] text-white font-semibold shadow-lg border border-oro/30'
      : 'text-bosque-200 hover:bg-[#0f3325] hover:text-white'
  }`;

export default function Sidebar() {
  const { state } = useErp();
  const { tab, setTab, menuMovil, setMenuMovil } = useUi();
  const { modo, perfil, salir } = useAuth();
  const { company } = state;
  const rol = perfil?.rol ?? 'dueno';

  return (
    <>
    {menuMovil && <div className="fixed inset-0 z-40 bg-bosque-950/60 lg:hidden" onClick={() => setMenuMovil(false)} aria-hidden />}
    <aside id="menu-panel" aria-label="Menú del centro de control" className={`fixed inset-y-0 left-0 z-50 w-72 bg-bosque-950 text-white flex flex-col justify-between shrink-0 p-5 border-r border-[#123829] shadow-2xl transition-transform lg:static lg:z-30 lg:translate-x-0 ${menuMovil ? 'translate-x-0' : '-translate-x-full'}`}>
      {menuMovil && <button onClick={() => setMenuMovil(false)} className="lg:hidden absolute top-3 right-3 p-2 rounded-xl text-bosque-200 hover:bg-bosque-800" aria-label="Cerrar menú"><X className="w-5 h-5" /></button>}
      <div className="space-y-4">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#164432]">
          <img
            src="/logo.jpg"
            alt="Aurevia Logo"
            className="w-12 h-12 rounded-2xl object-cover border border-oro/40 shadow-xl bg-white p-0.5"
          />
          <div>
            <h1 className="font-serif text-xl tracking-wide text-crema-50 flex items-center gap-1.5 font-bold">
              {company.nombreComercial.split(' - ')[0] || 'Aurevia'}
            </h1>
            <p className="text-[9px] text-oro font-semibold tracking-[0.2em] uppercase">Vivero • Jardines • ERP</p>
            <p className="text-[9px] text-[#8fa89b] italic font-serif">Naturaleza que inspira</p>
          </div>
        </div>

        <nav className="space-y-3.5 text-xs overflow-y-auto max-h-[calc(100vh-215px)] pr-1 custom-scrollbar">
          {puedeVer(rol, 'dashboard') && (
          <div>
            <button onClick={() => setTab('dashboard')} className={itemClass(tab === 'dashboard', true)}>
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 text-oro" />
                <span>Inicio Aurevia</span>
              </div>
              <span className="text-[10px] text-[#8fa89b] bg-[#123829] px-2 py-0.5 rounded-full">360°</span>
            </button>
          </div>
          )}

          {bloquesPara(rol).map(block => (
            <div key={block.id} className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-oro uppercase flex items-center justify-between border-b border-[#164432]/70">
                <span className="flex items-center gap-1.5">
                  <block.icon className="w-3 h-3 text-oro" /> {block.label}
                </span>
                <span className="text-[8px] text-[#8fa89b] tracking-normal lowercase bg-[#103324] px-1.5 py-0.5 rounded">{block.hint}</span>
              </div>

              <div className="space-y-1 pt-1">
                {block.items.map(item => (
                  <button key={item.id} onClick={() => setTab(item.id)} className={itemClass(tab === item.id)}>
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-4 h-4 ${item.iconClass ?? 'text-[#8fa89b]'}`} />
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${item.badgeClass ?? 'bg-bosque-700 text-oro'}`}>
                      {item.badge(state)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Sidebar */}
      <div className="pt-3 border-t border-[#164432] text-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-oro to-earth-500 text-tinta font-bold flex items-center justify-center shadow-md">
            {(modo === 'nube' && perfil ? perfil.nombre : company.razonSocial).charAt(0).toUpperCase()}
          </div>
          <div>
            {modo === 'nube' && perfil ? (
              <>
                <p className="font-semibold text-white truncate max-w-[130px]">{perfil.nombre}</p>
                <p className="text-[10px] text-oro">{ROL_ETIQUETA[rol]}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-white truncate max-w-[130px]">{company.nombreComercial.split(' - ')[0]}</p>
                <p className="text-[10px] text-oro font-mono">RUC {company.ruc}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {puedeVer(rol, 'configuracion') && (
            <button onClick={() => setTab('configuracion')} title="Configuración" className="p-1.5 hover:bg-bosque-800 rounded-xl text-[#8fa89b]">
              <Settings className="w-4 h-4 text-oro" />
            </button>
          )}
          {modo === 'nube' && (
            <button onClick={() => void salir()} title="Cerrar sesión" className="p-1.5 hover:bg-bosque-800 rounded-xl text-[#8fa89b]">
              <LogOut className="w-4 h-4 text-oro" />
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
