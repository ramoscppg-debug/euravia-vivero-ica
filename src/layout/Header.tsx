import { PackagePlus, PlusCircle, Sparkles, Wallet } from 'lucide-react';
import { useAuth } from '../store/AuthStore';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';
import { blockOf, bloquesPara, puedeVer } from './navigation';

export default function Header() {
  const { state } = useErp();
  const { tab, setTab, open } = useUi();
  const { company, cashRegister } = state;
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const vende = puedeVer(rol, 'caja');
  const activeBlock = blockOf(tab);

  return (
    <>
      <header className="h-20 bg-white/90 backdrop-blur-md border-b border-[#e8e2d8] px-8 flex items-center justify-between shrink-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold tracking-tight text-[#082017] uppercase">{company.razonSocial}</span>
            <span className="text-[11px] font-semibold text-[#8fa89b] uppercase tracking-widest">• RUC {company.ruc}</span>
          </div>
          <p className="text-xs text-[#5c7367]">{company.direccion}, {company.distrito} — Cta. Detracciones BN: <strong className="font-mono text-[#082017]">{company.cuentaDetraccionesBn}</strong></p>
        </div>

        {vende && (
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setTab('caja')}
            className="flex items-center gap-1.5 bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-[#d5c7b5] transition shadow-sm"
          >
            <Wallet className="w-4 h-4 text-[#134e2e]" />
            <span>Caja: S/ {cashRegister.conteoRealEfectivo.toFixed(2)}</span>
          </button>

          <button
            onClick={() => open({ type: 'compra' })}
            className="flex items-center gap-1.5 bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-[#d5c7b5] transition shadow-sm"
          >
            <PackagePlus className="w-4 h-4 text-[#134e2e]" />
            <span>Ingreso Almacén (+)</span>
          </button>

          <button
            onClick={() => open({ type: 'pos' })}
            className="flex items-center gap-2 bg-[#082017] hover:bg-[#123e2c] text-[#fdfbf7] text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg border border-[#d4af37]/40 transition"
          >
            <PlusCircle className="w-4 h-4 text-[#d4af37]" />
            <span>Nueva Venta (POS & CPE)</span>
          </button>
        </div>
        )}
      </header>

      {/* Selector de flujos */}
      <div className="bg-white border-b border-[#e8e2d8] px-8 py-2.5 flex items-center justify-between gap-3 overflow-x-auto shrink-0 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] font-bold text-[#8fa89b] uppercase tracking-wider mr-1 hidden sm:inline">Flujo:</span>

          {puedeVer(rol, 'dashboard') && (
          <button
            onClick={() => setTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${tab === 'dashboard' ? 'bg-[#082017] text-[#d4af37] shadow-sm' : 'bg-[#f4ede4] text-[#5c7367] hover:bg-[#e8decb]'}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Visión 360°</span>
          </button>
          )}

          {bloquesPara(rol).map(block => (
            <button
              key={block.id}
              onClick={() => { if (activeBlock?.id !== block.id) setTab(block.items[0].id); }}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${activeBlock?.id === block.id ? 'bg-[#123e2c] text-[#fdfbf7] shadow-sm border border-[#d4af37]/40' : 'bg-[#f4ede4] text-[#5c7367] hover:bg-[#e8decb]'}`}
            >
              <block.icon className="w-3.5 h-3.5 text-[#8fa89b]" />
              <span>{block.emoji} {block.label} ({block.items.length})</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] font-bold text-[#134e2e] flex items-center gap-1.5 bg-[#e7f5ed] px-3 py-1 rounded-xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>UBL 2.1 • SPOT BN • SIRE</span>
        </div>
      </div>
    </>
  );
}
