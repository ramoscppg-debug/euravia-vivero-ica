// ==========================================
// COMPONENTES VISUALES COMPARTIDOS (tienda pública y centro de control)
// Usan los tokens de tailwind.config.js: bosque, crema, tinta, terracota, oro y estados.
// ==========================================
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Leaf, Loader2, Sprout } from 'lucide-react';

type Variante = 'primario' | 'secundario' | 'acento' | 'fantasma';
type Tamano = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-bosque-950 text-oro hover:bg-bosque-800 shadow-suave',
  secundario: 'bg-white text-tinta border border-crema-300 hover:border-crema-400 hover:bg-crema-50',
  acento: 'bg-terracota text-white hover:bg-terracota-oscuro shadow-suave',
  fantasma: 'text-tinta hover:bg-crema-200'
};
const TAMANOS: Record<Tamano, string> = {
  sm: 'min-h-[36px] px-3 text-xs',
  md: 'min-h-[44px] px-4 text-sm', // 44px: objetivo táctil cómodo en móvil
  lg: 'min-h-[52px] px-6 text-base'
};

/** Clases de botón: sirven también para enlaces que deben verse como botón. */
export const claseBoton = (variante: Variante = 'primario', tamano: Tamano = 'md', extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-control font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;

export function Boton({ variante = 'primario', tamano = 'md', cargando = false, className = '', children, disabled, ...resto }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamano?: Tamano; cargando?: boolean }) {
  return (
    <button {...resto} disabled={disabled || cargando} aria-busy={cargando || undefined} className={claseBoton(variante, tamano, className)}>
      {cargando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Tarjeta({ children, className = '', as: Etiqueta = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Etiqueta className={`bg-white rounded-tarjeta border border-crema-300 shadow-suave ${className}`}>{children}</Etiqueta>;
}

type Tono = 'neutro' | 'exito' | 'aviso' | 'error' | 'marca' | 'acento';
const TONOS: Record<Tono, string> = {
  neutro: 'bg-crema-200 text-tinta-suave',
  exito: 'bg-exito-fondo text-exito',
  aviso: 'bg-aviso-fondo text-aviso',
  error: 'bg-error-fondo text-error',
  marca: 'bg-bosque-950 text-oro',
  acento: 'bg-terracota-suave text-terracota-oscuro'
};

export function Insignia({ tono = 'neutro', children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 ${TONOS[tono]} ${className}`}>{children}</span>;
}

export function EstadoVacio({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
      <Leaf className="w-8 h-8 text-bosque-600" aria-hidden />
      <p className="font-serif text-lg font-bold text-tinta">{titulo}</p>
      {detalle && <p className="text-sm text-tinta-suave max-w-md">{detalle}</p>}
      {accion}
    </div>
  );
}

export function EstadoError({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-tarjeta bg-error-fondo text-error">
      <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-semibold">{mensaje}</p>
      {reintentar && <Boton variante="secundario" tamano="sm" onClick={reintentar}>Reintentar</Boton>}
    </div>
  );
}

/** Pantalla completa de carga (arranque del panel o de la tienda). */
export function Cargando({ texto }: { texto: string }) {
  return (
    <div role="status" className="min-h-screen bg-bosque-950 flex items-center justify-center text-oro text-sm font-bold gap-2">
      <Sprout className="w-5 h-5 animate-pulse" aria-hidden /> {texto}
    </div>
  );
}

/** Bloque gris mientras llegan los datos (evita saltos de diseño). */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-crema-200 rounded-control ${className}`} />;
}

export type Disponibilidad = 'DISPONIBLE' | 'POCAS' | 'AGOTADO';

/** Disponibilidad pública: nunca el número exacto de stock. */
export function InsigniaDisponibilidad({ valor }: { valor: Disponibilidad }) {
  if (valor === 'AGOTADO') return <Insignia tono="error">Agotado</Insignia>;
  if (valor === 'POCAS') return <Insignia tono="aviso">Últimas unidades</Insignia>;
  return <Insignia tono="exito">Disponible</Insignia>;
}
