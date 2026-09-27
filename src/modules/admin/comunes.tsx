import type { ReactNode } from 'react';
import { PERIODOS, type Periodo } from '../../lib/reportes';

/** Filtro de periodo compartido por los reportes. */
export function SelectorPeriodo({ valor, cambiar }: { valor: Periodo; cambiar: (p: Periodo) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs" role="radiogroup" aria-label="Periodo">
      {PERIODOS.map(p => (
        <button key={p.id} role="radio" aria-checked={valor === p.id} onClick={() => cambiar(p.id)}
          className={`px-3 py-1.5 rounded-full font-bold border ${valor === p.id ? 'bg-bosque-950 text-white border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Cifra({ titulo, valor, nota, tono = 'neutro' }: { titulo: string; valor: string; nota?: string; tono?: 'neutro' | 'bien' | 'mal' }) {
  const color = tono === 'bien' ? 'text-exito' : tono === 'mal' ? 'text-error' : 'text-tinta';
  return (
    <div className="bg-white p-4 rounded-2xl border border-crema-300">
      <p className="text-[11px] font-bold uppercase text-tinta-suave">{titulo}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{valor}</p>
      {nota && <p className="text-[11px] text-tinta-suave">{nota}</p>}
    </div>
  );
}

export function Bloque({ titulo, accion, children, className = '' }: { titulo: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={`bg-white rounded-3xl border border-crema-300 p-5 space-y-3 text-sm min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-tinta">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Barra horizontal proporcional (el valor siempre va escrito al lado). */
export function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  return (
    <div className="h-2 rounded-full bg-crema-200" aria-hidden>
      <div className="h-2 rounded-full bg-bosque-700" style={{ width: `${maximo > 0 ? Math.max(2, (Math.max(0, valor) / maximo) * 100) : 0}%` }} />
    </div>
  );
}
