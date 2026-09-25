import { LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { bloquesPara, puedeVer, ROL_ETIQUETA } from './navigation';

const itemClass = (active: boolean, main = false) =>
  `w-full flex items-center justify-between px-3.5 ${main ? 'py-2.5' : 'py-2'} rounded-2xl font-medium transition-all ${
    active
      ? 'bg-gradient-to-r from-[#123e2c] to-[#1c553d] text-white font-semibold shadow-lg border border-[#d4af37]/30'
      : 'text-[#c2d4cb] hover:bg-[#0f3325] hover:text-white'
  }`;

export default function Sidebar() {
  const { state } = useErp();
  const { tab, setTab } = useUi();
  const { modo, perfil, salir } = useAuth();
  const { company } = state;
  const rol = perfil?.rol ?? 'dueno';

  return (
    <aside className="w-72 bg-[#082017] text-white flex flex-col justify-between shrink-0 p-5 border-r border-[#123829] shadow-2xl z-30">
      <div className="space-y-4">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#164432]">
          <img
            src="/logo.jpg"
            alt="Aurevia Logo"
            className="w-12 h-12 rounded-2xl object-cover border border-[#d4af37]/40 shadow-xl bg-white p-0.5"
          />
          <div>
            <h1 className="font-serif text-xl tracking-wide text-[#fdfbf7] flex items-center gap-1.5 font-bold">
              {company.nombreComercial.split(' - ')[0] || 'Aurevia'}
            </h1>
            <p className="text-[9px] text-[#d4af37] font-semibold tracking-[0.2em] uppercase">Vivero • Jardines • ERP</p>
            <p className="text-[9px] text-[#8fa89b] italic font-serif">Naturaleza que inspira</p>
          </div>
        </div>

        <nav className="space-y-3.5 text-xs overflow-y-auto max-h-[calc(100vh-215px)] pr-1 custom-scrollbar">
          {puedeVer(rol, 'dashboard') && (
          <div>
            <button onClick={() => setTab('dashboard')} className={itemClass(tab === 'dashboard', true)}>
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 text-[#d4af37]" />
                <span>Inicio Aurevia</span>
              </div>
              <span className="text-[10px] text-[#8fa89b] bg-[#123829] px-2 py-0.5 rounded-full">360°</span>
            </button>
          </div>
          )}

          {bloquesPara(rol).map(block => (
            <div key={block.id} className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#d4af37] uppercase flex items-center justify-between border-b border-[#164432]/70">
                <span className="flex items-center gap-1.5">
                  <block.icon className="w-3 h-3 text-[#d4af37]" /> {block.label}
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
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${item.badgeClass ?? 'bg-[#134e2e] text-[#d4af37]'}`}>
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
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8c6239] text-[#082017] font-bold flex items-center justify-center shadow-md">
            {(modo === 'nube' && perfil ? perfil.nombre : company.razonSocial).charAt(0).toUpperCase()}
          </div>
          <div>
            {modo === 'nube' && perfil ? (
              <>
                <p className="font-semibold text-white truncate max-w-[130px]">{perfil.nombre}</p>
                <p className="text-[10px] text-[#d4af37]">{ROL_ETIQUETA[rol]}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-white truncate max-w-[130px]">{company.nombreComercial.split(' - ')[0]}</p>
                <p className="text-[10px] text-[#d4af37] font-mono">RUC {company.ruc}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {puedeVer(rol, 'configuracion') && (
            <button onClick={() => setTab('configuracion')} title="Configuración" className="p-1.5 hover:bg-[#123e2c] rounded-xl text-[#8fa89b]">
              <Settings className="w-4 h-4 text-[#d4af37]" />
            </button>
          )}
          {modo === 'nube' && (
            <button onClick={() => void salir()} title="Cerrar sesión" className="p-1.5 hover:bg-[#123e2c] rounded-xl text-[#8fa89b]">
              <LogOut className="w-4 h-4 text-[#d4af37]" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
