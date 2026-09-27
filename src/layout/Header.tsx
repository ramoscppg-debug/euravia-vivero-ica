import { Menu, PackagePlus, PlusCircle, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { blockOf, bloquesPara, puedeVer } from './navigation';

export default function Header() {
  const { state } = useErp();
  const { tab, setTab, open, menuMovil, setMenuMovil } = useUi();
  const { company, cashRegister } = state;
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const vende = puedeVer(rol, 'caja');
  const activeBlock = blockOf(tab);

  return (
    <>
      <header className="h-16 lg:h-20 bg-white/90 backdrop-blur-md border-b border-crema-300 px-3 lg:px-8 flex items-center justify-between gap-2 shrink-0 z-20">
        <button onClick={() => setMenuMovil(!menuMovil)} className="lg:hidden min-w-[44px] min-h-[44px] -ml-1 inline-flex items-center justify-center rounded-xl text-tinta hover:bg-crema-200" aria-label="Abrir menú" aria-expanded={menuMovil} aria-controls="menu-panel">
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold tracking-tight text-tinta uppercase">{company.razonSocial}</span>
            <span className="text-[11px] font-semibold text-tinta-suave uppercase tracking-widest">• RUC {company.ruc}</span>
          </div>
          <p className="text-xs text-tinta-suave truncate">{company.direccion}, {company.distrito} — Cta. Detracciones BN: <strong className="font-mono text-tinta">{company.cuentaDetraccionesBn}</strong></p>
        </div>

        {vende && (
        <div className="flex items-center gap-1.5 lg:gap-2.5 ml-auto">
          <button
            onClick={() => setTab('caja')}
            className="flex items-center gap-1.5 bg-crema-200 hover:bg-[#eae1d5] text-tinta text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-crema-400 transition shadow-sm"
          >
            <Wallet className="w-4 h-4 text-bosque-700" />
            <span className="hidden sm:inline">Caja: S/ {cashRegister.conteoRealEfectivo.toFixed(2)}</span>
          </button>

          <button
            onClick={() => open({ type: 'compra' })}
            className="flex items-center gap-1.5 bg-crema-200 hover:bg-[#eae1d5] text-tinta text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-crema-400 transition shadow-sm"
          >
            <PackagePlus className="w-4 h-4 text-bosque-700" />
            <span className="hidden xl:inline">Ingreso Almacén (+)</span>
          </button>

          <button
            onClick={() => open({ type: 'pos' })}
            className="flex items-center gap-2 bg-bosque-950 hover:bg-bosque-800 text-crema-50 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg border border-oro/40 transition"
          >
            <PlusCircle className="w-4 h-4 text-oro" />
            <span className="hidden sm:inline">Nueva Venta (POS & CPE)</span><span className="sm:hidden">Vender</span>
          </button>
        </div>
        )}
      </header>

      {/* Selector de flujos */}
      <div className="bg-white border-b border-crema-300 px-3 lg:px-8 py-2.5 flex items-center justify-between gap-3 overflow-x-auto shrink-0 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] font-bold text-tinta-suave uppercase tracking-wider mr-1 hidden sm:inline">Flujo:</span>

          {puedeVer(rol, 'dashboard') && (
          <button
            onClick={() => setTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${tab === 'dashboard' ? 'bg-bosque-950 text-oro shadow-sm' : 'bg-crema-200 text-tinta-suave hover:bg-[#e8decb]'}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-oro" />
            <span>Visión 360°</span>
          </button>
          )}

          {bloquesPara(rol).map(block => (
            <button
              key={block.id}
              onClick={() => { if (activeBlock?.id !== block.id) setTab(block.items[0].id); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${activeBlock?.id === block.id ? 'bg-bosque-800 text-crema-50 shadow-sm border border-oro/40' : 'bg-crema-200 text-tinta-suave hover:bg-[#e8decb]'}`}
            >
              <block.icon className="w-3.5 h-3.5 text-tinta-suave" />
              <span>{block.emoji} {block.label} ({block.items.length})</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] font-bold text-bosque-700 flex items-center gap-1.5 bg-bosque-100 px-3 py-1 rounded-xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>UBL 2.1 • SPOT BN • SIRE</span>
        </div>
      </div>
    </>
  );
}
