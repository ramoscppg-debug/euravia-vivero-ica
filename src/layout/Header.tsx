import { AlertTriangle, Menu, PackagePlus, PlusCircle } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { blockOf, itemOf, puedeVer } from './navigation';

/** Barra superior: dónde estoy, las secciones del área (conectadas entre sí) y las acciones rápidas. */
export default function Header() {
  const { state } = useErp();
  const { tab, setTab, open, menuMovil, setMenuMovil } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const vende = puedeVer(rol, 'caja');
  const area = blockOf(tab);
  const secciones = area?.items.filter(i => puedeVer(rol, i.id)) ?? [];
  const sinEmpresa = !state.company.ruc;

  return (
    <div className="shrink-0 bg-white border-b border-crema-300 z-20">
      <header className="h-16 px-3 lg:px-8 flex items-center gap-2">
        <button onClick={() => setMenuMovil(!menuMovil)} className="lg:hidden min-w-[44px] min-h-[44px] -ml-1 inline-flex items-center justify-center rounded-xl text-tinta hover:bg-crema-200" aria-label="Abrir menú" aria-expanded={menuMovil} aria-controls="menu-panel">
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-suave truncate">{area?.label ?? 'Inicio'}</p>
          <h2 className="text-base lg:text-lg font-extrabold text-tinta truncate">{tab === 'dashboard' ? 'Resumen del negocio' : itemOf(tab)?.label}</h2>
        </div>
        {vende && (
          <div className="flex items-center gap-2">
            <button onClick={() => open({ type: 'compra' })} className="hidden sm:flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-crema-300 hover:bg-crema text-tinta text-xs font-bold">
              <PackagePlus className="w-4 h-4 text-bosque-700" aria-hidden /> <span className="hidden xl:inline">Ingreso a almacén</span><span className="xl:hidden">Ingreso</span>
            </button>
            <button onClick={() => open({ type: 'pos' })} className="flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-bosque-950 hover:bg-bosque-800 text-white text-xs font-bold">
              <PlusCircle className="w-4 h-4 text-oro" aria-hidden /> <span className="hidden sm:inline">Nueva venta</span><span className="sm:hidden">Vender</span>
            </button>
          </div>
        )}
      </header>

      {secciones.length > 1 && (
        <nav aria-label={`Secciones de ${area?.label}`} className="px-3 lg:px-8 flex gap-1 overflow-x-auto custom-scrollbar -mb-px">
          {secciones.map(s => {
            const b = s.badge?.(state);
            return (
              <button key={s.id} onClick={() => setTab(s.id)} aria-current={tab === s.id ? 'page' : undefined}
                className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 border-b-2 transition flex items-center gap-1.5 ${tab === s.id ? 'border-bosque-700 text-bosque-800' : 'border-transparent text-tinta-suave hover:text-tinta'}`}>
                {s.label}{b && <span className="px-1.5 rounded-full bg-crema-200 text-tinta text-[10px]">{b}</span>}
              </button>
            );
          })}
        </nav>
      )}

      {sinEmpresa && puedeVer(rol, 'configuracion') && tab !== 'configuracion' && (
        <p className="px-3 lg:px-8 py-2 bg-aviso-fondo text-aviso text-xs font-semibold flex items-center gap-2 border-t border-crema-300">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
          <span>Configura el RUC y la razón social de tu empresa para emitir comprobantes. <button onClick={() => setTab('configuracion')} className="underline font-bold">Ir a Ajustes</button></span>
        </p>
      )}
    </div>
  );
}
