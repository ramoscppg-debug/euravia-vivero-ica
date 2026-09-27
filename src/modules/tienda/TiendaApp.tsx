import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Mail, MapPin, Menu, ShoppingBag, X } from 'lucide-react';
import { Enlace, useUbicacion } from '../../app/router';
import { EstadoError } from '../../components/ui';
import { cargarDatosTienda, type DatosTienda } from './datos';
import Inicio from './paginas/Inicio';
import Catalogo from './paginas/Catalogo';
import Producto from './paginas/Producto';
import { ServicioDetalle, Servicios } from './paginas/Servicios';
import Contacto from './paginas/Contacto';
import Pedido from './paginas/Pedido';
import NoEncontrado from './paginas/NoEncontrado';

// ---------- Datos y carrito compartidos por las páginas ----------
export interface LineaPedido {
  sku: string;
  cantidad: number;
}

interface TiendaValor {
  datos: DatosTienda | null;
  error: string | null;
  recargar: () => void;
  carrito: LineaPedido[];
  agregar: (sku: string, cantidad?: number) => void;
  cambiarCantidad: (sku: string, cantidad: number) => void;
  vaciar: () => void;
}

const TiendaContexto = createContext<TiendaValor | null>(null);
const CLAVE_CARRITO = 'aurevia.carrito.v1';

function leerCarrito(): LineaPedido[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_CARRITO) ?? '[]');
    return Array.isArray(v) ? v.filter(l => typeof l?.sku === 'string' && Number.isInteger(l?.cantidad) && l.cantidad > 0).slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function useTienda() {
  const ctx = useContext(TiendaContexto);
  if (!ctx) throw new Error('useTienda debe usarse dentro de <TiendaApp>');
  return ctx;
}

// ---------- Estructura ----------
const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/plantas', label: 'Plantas' },
  { href: '/productos', label: 'Productos e insumos' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/contacto', label: 'Contacto' }
];

function Encabezado() {
  const { ruta } = useUbicacion();
  const { carrito } = useTienda();
  const [abierto, setAbierto] = useState(false);
  const unidades = carrito.reduce((a, l) => a + l.cantidad, 0);
  const activo = (href: string) => (href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(`${href}/`));

  useEffect(() => setAbierto(false), [ruta]);

  return (
    <header className="sticky top-0 z-40 bg-crema-50/95 backdrop-blur border-b border-crema-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Enlace href="/" className="flex items-center gap-2.5 shrink-0" aria-label="AUREVIA, ir al inicio">
          <img src="/logo.jpg" alt="" className="w-9 h-9 rounded-xl object-cover border border-crema-300" />
          <span className="font-serif text-xl font-bold tracking-wide text-bosque-950">AUREVIA</span>
        </Enlace>

        <nav aria-label="Principal" className="hidden md:flex items-center gap-1">
          {NAV.map(n => (
            <Enlace key={n.href} href={n.href} aria-current={activo(n.href) ? 'page' : undefined}
              className={`px-3 py-2 rounded-control text-sm font-semibold transition-colors ${activo(n.href) ? 'text-bosque-950 bg-crema-200' : 'text-tinta-suave hover:text-bosque-950 hover:bg-crema-200'}`}>
              {n.label}
            </Enlace>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Enlace href="/pedido" className="relative inline-flex items-center gap-2 min-h-[44px] px-3 rounded-control bg-bosque-950 text-oro text-sm font-bold" aria-label={`Mi pedido: ${unidades} producto(s)`}>
            <ShoppingBag className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">Mi pedido</span>
            {unidades > 0 && <span className="min-w-[20px] h-5 px-1 rounded-full bg-terracota text-white text-[11px] font-bold flex items-center justify-center">{unidades}</span>}
          </Enlace>
          <button onClick={() => setAbierto(a => !a)} className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-control text-bosque-950 hover:bg-crema-200" aria-expanded={abierto} aria-controls="menu-movil" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}>
            {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {abierto && (
        <nav id="menu-movil" aria-label="Principal (móvil)" className="md:hidden border-t border-crema-300 bg-crema-50 px-4 py-2">
          {NAV.map(n => (
            <Enlace key={n.href} href={n.href} aria-current={activo(n.href) ? 'page' : undefined}
              className={`block px-3 py-3 rounded-control text-base font-semibold ${activo(n.href) ? 'bg-crema-200 text-bosque-950' : 'text-tinta'}`}>
              {n.label}
            </Enlace>
          ))}
        </nav>
      )}
    </header>
  );
}

function Pie() {
  const { datos } = useTienda();
  const c = datos?.config;
  return (
    <footer className="mt-20 bg-bosque-950 text-bosque-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-3 text-sm">
        <div className="space-y-2">
          <p className="font-serif text-2xl font-bold text-crema-50">AUREVIA</p>
          <p>Plantas, insumos y jardinería.</p>
        </div>
        <nav aria-label="Pie de página" className="space-y-2">
          {NAV.slice(1).map(n => <Enlace key={n.href} href={n.href} className="block hover:text-oro">{n.label}</Enlace>)}
        </nav>
        <div className="space-y-2">
          {c?.direccion && <p className="flex gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> {c.direccion}</p>}
          {c?.email && <p className="flex gap-2"><Mail className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> <a href={`mailto:${c.email}`} className="hover:text-oro underline">{c.email}</a></p>}
          {c?.horario && <p>{c.horario}</p>}
          <Enlace href="/panel" className="inline-block pt-4 text-xs text-bosque-200/80 hover:text-oro">Acceso del equipo</Enlace>
        </div>
      </div>
    </footer>
  );
}

function Rutas() {
  const { ruta } = useUbicacion();
  const partes = ruta.split('/').filter(Boolean);
  if (ruta === '/') return <Inicio />;
  if (ruta === '/plantas') return <Catalogo grupo="plantas" />;
  if (ruta === '/productos') return <Catalogo grupo="insumos" />;
  if (partes[0] === 'producto' && partes[1]) return <Producto sku={decodeURIComponent(partes[1])} />;
  if (ruta === '/servicios') return <Servicios />;
  if (partes[0] === 'servicios' && partes[1]) return <ServicioDetalle slug={decodeURIComponent(partes[1])} />;
  if (ruta === '/contacto') return <Contacto />;
  if (ruta === '/pedido') return <Pedido />;
  return <NoEncontrado />;
}

export default function TiendaApp() {
  const [datos, setDatos] = useState<DatosTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<LineaPedido[]>(leerCarrito);

  const recargar = useCallback(() => {
    setError(null);
    cargarDatosTienda().then(setDatos, e => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(recargar, [recargar]);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch {
      // sin almacenamiento: el carrito vive mientras la pestaña esté abierta
    }
  }, [carrito]);

  const agregar = useCallback((sku: string, cantidad = 1) => setCarrito(c => {
    const previo = c.find(l => l.sku === sku);
    if (previo) return c.map(l => (l.sku === sku ? { ...l, cantidad: Math.min(99, l.cantidad + cantidad) } : l));
    return c.length >= 30 ? c : [...c, { sku, cantidad: Math.min(99, cantidad) }];
  }), []);
  const cambiarCantidad = useCallback((sku: string, cantidad: number) =>
    setCarrito(c => (cantidad <= 0 ? c.filter(l => l.sku !== sku) : c.map(l => (l.sku === sku ? { ...l, cantidad: Math.min(99, cantidad) } : l)))), []);
  const vaciar = useCallback(() => setCarrito([]), []);

  const valor = useMemo(() => ({ datos, error, recargar, carrito, agregar, cambiarCantidad, vaciar }), [datos, error, recargar, carrito, agregar, cambiarCantidad, vaciar]);

  return (
    <TiendaContexto.Provider value={valor}>
      <div className="min-h-screen flex flex-col bg-crema-50 text-tinta">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:rounded-control focus:shadow-elevada">Saltar al contenido</a>
        <Encabezado />
        <main id="contenido" className="flex-1">
          {error ? (
            <div className="max-w-3xl mx-auto px-4 py-16"><EstadoError mensaje={`No pudimos cargar la tienda: ${error}`} reintentar={recargar} /></div>
          ) : (
            <Rutas />
          )}
        </main>
        <Pie />
      </div>
    </TiendaContexto.Provider>
  );
}

/** Contenedor de página con ancho y márgenes consistentes. */
export function Pagina({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
