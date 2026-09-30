// ==========================================
// TIENDA PÚBLICA (/tienda): blanco y verde, pensada primero para el celular.
// Flujo: elegir → "Mi cotización" (panel lateral) → confirmar datos y comprobante → enviar por WhatsApp.
// ==========================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Leaf, Mail, MapPin, Menu, ShoppingBag, X } from 'lucide-react';
import { Enlace, navegar, useUbicacion } from '../../app/router';
import { EstadoError } from '../../components/ui';
import { soles } from '../../lib/formato';
import { cargarDatosTienda, url, type DatosTienda } from './datos';
import { Contador, Imagen, NotaStock } from './componentes';
import Inicio from './paginas/Inicio';
import Catalogo from './paginas/Catalogo';
import Producto from './paginas/Producto';
import { ServicioDetalle, Servicios } from './paginas/Servicios';
import Contacto from './paginas/Contacto';
import Ofertas from './paginas/Ofertas';
import Cotizar from './paginas/Cotizar';
import NoEncontrado from './paginas/NoEncontrado';

// ---------- Datos y selección compartidos por las páginas ----------
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
  panel: boolean;
  setPanel: (abierto: boolean) => void;
}

const TiendaContexto = createContext<TiendaValor | null>(null);
const CLAVE_CARRITO = 'aurevia.carrito.v1';
export const MAX_CANTIDAD = 999;

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

/** Líneas de la selección con su producto (descarta las que ya no están en el catálogo). */
export function useLineas() {
  const { datos, carrito } = useTienda();
  const lineas = carrito
    .map(l => ({ ...l, p: datos?.productos.find(x => x.sku === l.sku) }))
    .filter((l): l is typeof l & { p: NonNullable<typeof l.p> } => !!l.p);
  return { lineas, total: lineas.reduce((a, l) => a + l.cantidad * l.p.precio, 0), unidades: lineas.reduce((a, l) => a + l.cantidad, 0) };
}

// ---------- Estructura ----------
const NAV = [
  { href: url(), label: 'Inicio' },
  { href: url('/plantas'), label: 'Plantas' },
  { href: url('/productos'), label: 'Productos e insumos' },
  { href: url('/ofertas'), label: 'Ofertas' },
  { href: url('/servicios'), label: 'Servicios' },
  { href: url('/contacto'), label: 'Contacto' }
];

function Encabezado() {
  const { ruta } = useUbicacion();
  const { setPanel } = useTienda();
  const { unidades } = useLineas();
  const [abierto, setAbierto] = useState(false);
  const activo = (href: string) => (href === url() ? ruta === url() : ruta === href || ruta.startsWith(`${href}/`));

  useEffect(() => setAbierto(false), [ruta]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Enlace href={url()} className="flex items-center gap-2.5 shrink-0" aria-label="AUREVIA, ir al inicio">
          <img src="/logo.jpg" alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
          <span className="text-lg font-extrabold tracking-[0.18em] text-hoja-900">AUREVIA</span>
        </Enlace>

        <nav aria-label="Principal" className="hidden md:flex items-center gap-1">
          {NAV.map(n => (
            <Enlace key={n.href} href={n.href} aria-current={activo(n.href) ? 'page' : undefined}
              className={`px-3 py-2 rounded-full text-sm font-semibold transition-colors ${activo(n.href) ? 'text-hoja-800 bg-hoja-50' : 'text-slate-600 hover:text-hoja-800 hover:bg-slate-50'}`}>
              {n.label}
            </Enlace>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => setPanel(true)} className="relative inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-hoja-700 hover:bg-hoja-800 text-white text-sm font-bold transition-colors" aria-label={`Mi cotización: ${unidades} unidad(es)`}>
            <ShoppingBag className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">Mi cotización</span>
            {unidades > 0 && <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-white text-hoja-800 text-[11px] font-extrabold flex items-center justify-center">{unidades}</span>}
          </button>
          <button onClick={() => setAbierto(a => !a)} className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-slate-700 hover:bg-slate-100" aria-expanded={abierto} aria-controls="menu-movil" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}>
            {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {abierto && (
        <nav id="menu-movil" aria-label="Principal (móvil)" className="md:hidden border-t border-slate-200 bg-white px-4 py-2">
          {NAV.map(n => (
            <Enlace key={n.href} href={n.href} aria-current={activo(n.href) ? 'page' : undefined}
              className={`block px-3 py-3 rounded-xl text-base font-semibold ${activo(n.href) ? 'bg-hoja-50 text-hoja-800' : 'text-slate-700'}`}>
              {n.label}
            </Enlace>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Panel lateral "Mi cotización": se revisa y ajusta la selección sin salir de la página. */
function PanelCotizacion() {
  const { panel, setPanel, cambiarCantidad, datos } = useTienda();
  const { lineas, total, unidades } = useLineas();
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!panel) return;
    cerrarRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [panel, setPanel]);

  if (!panel) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPanel(false)} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label="Mi cotización" className="absolute right-0 inset-y-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-[entrar_.25s_ease-out]">
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
          <p className="text-lg font-extrabold text-slate-900">Mi cotización <span className="text-slate-500 font-semibold text-sm">({unidades})</span></p>
          <button ref={cerrarRef} onClick={() => setPanel(false)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full hover:bg-slate-100" aria-label="Cerrar mi cotización"><X className="w-5 h-5" /></button>
        </div>
        {!lineas.length ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Leaf className="w-10 h-10 text-hoja-600" aria-hidden />
            <p className="font-bold text-slate-900">Aún no eliges productos</p>
            <p className="text-sm text-slate-600">Agrega plantas o insumos y aquí verás tu cotización al instante.</p>
            <Enlace href={url('/plantas')} onClick={() => setPanel(false)} className="mt-2 font-bold text-hoja-700 underline">Ver plantas</Enlace>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-5">
              {lineas.map(l => (
                <li key={l.sku} className="py-4 flex gap-3">
                  <Imagen src={l.p.imagen} alt={l.p.nombre} className="w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="font-bold text-slate-900 leading-tight">{l.p.nombre}</p>
                    <p className="text-xs text-slate-600">{soles(l.p.precio)} c/u</p>
                    <Contador valor={l.cantidad} cambiar={n => cambiarCantidad(l.sku, n)} etiqueta={l.p.nombre} permitirCero />
                    <NotaStock stock={l.p.stock} cantidad={l.cantidad} compacta />
                  </div>
                  <span className="font-extrabold text-slate-900 shrink-0">{soles(l.cantidad * l.p.precio)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-200 p-5 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600 text-sm">Total referencial (con IGV)</span>
                <span className="text-2xl font-extrabold text-slate-900">{soles(total)}</span>
              </div>
              {datos?.config.deliveryGratisDesde !== undefined && (
                <p className="text-xs font-semibold text-hoja-900 bg-hoja-50 rounded-xl p-2">
                  {total >= datos.config.deliveryGratisDesde ? '¡Tu pedido tiene delivery gratis!' : `Te faltan ${soles(datos.config.deliveryGratisDesde - total)} para el delivery gratis.`}
                </p>
              )}
              <button onClick={() => { setPanel(false); navegar(url('/cotizar')); }} className="w-full min-h-[52px] rounded-full bg-hoja-700 hover:bg-hoja-800 text-white font-bold inline-flex items-center justify-center gap-2">
                Confirmar pedido <ArrowRight className="w-5 h-5" aria-hidden />
              </button>
              <p className="text-xs text-slate-500 text-center">El pago se coordina por WhatsApp; aquí no se cobra nada.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/** Barra fija en el celular con el resumen de la selección. */
function BarraMovil() {
  const { ruta } = useUbicacion();
  const { setPanel } = useTienda();
  const { lineas, total, unidades } = useLineas();
  if (!lineas.length || ruta.startsWith(url('/cotizar'))) return null;
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-white/95 backdrop-blur border-t border-slate-200">
      <button onClick={() => setPanel(true)} className="w-full min-h-[52px] rounded-full bg-hoja-700 text-white font-bold flex items-center justify-between px-5">
        <span>{unidades} u. · {soles(total)}</span>
        <span className="inline-flex items-center gap-1">Ver cotización <ArrowRight className="w-4 h-4" aria-hidden /></span>
      </button>
    </div>
  );
}

function Aviso({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div role="status" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 px-4 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-2xl flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-hoja-300" aria-hidden /> {texto}
    </div>
  );
}

function Pie() {
  const { datos } = useTienda();
  const c = datos?.config;
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-3 text-sm text-slate-600">
        <div className="space-y-2">
          <p className="text-lg font-extrabold tracking-[0.18em] text-hoja-900">AUREVIA</p>
          <p>Plantas, insumos y servicios de jardinería.</p>
          <p className="text-xs">Precios con IGV. Pagos coordinados por WhatsApp con nuestro equipo de ventas.</p>
        </div>
        <nav aria-label="Pie de página" className="space-y-2">
          {NAV.slice(1).map(n => <Enlace key={n.href} href={n.href} className="block hover:text-hoja-800">{n.label}</Enlace>)}
        </nav>
        <div className="space-y-2">
          {c?.direccion && <p className="flex gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> {c.direccion}</p>}
          {c?.email && <p className="flex gap-2"><Mail className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> <a href={`mailto:${c.email}`} className="hover:text-hoja-800 underline">{c.email}</a></p>}
          {c?.horario && <p>{c.horario}</p>}
        </div>
      </div>
    </footer>
  );
}

function Rutas() {
  const { ruta } = useUbicacion();
  const partes = ruta.slice(url().length).split('/').filter(Boolean);
  if (!partes.length) return <Inicio />;
  if (partes[0] === 'plantas' && partes.length === 1) return <Catalogo grupo="plantas" />;
  if (partes[0] === 'productos' && partes.length === 1) return <Catalogo grupo="insumos" />;
  if (partes[0] === 'producto' && partes[1]) return <Producto sku={decodeURIComponent(partes[1])} />;
  if (partes[0] === 'servicios' && partes.length === 1) return <Servicios />;
  if (partes[0] === 'servicios' && partes[1]) return <ServicioDetalle slug={decodeURIComponent(partes[1])} />;
  if (partes[0] === 'contacto') return <Contacto />;
  if (partes[0] === 'ofertas') return <Ofertas />;
  if (partes[0] === 'cotizar' || partes[0] === 'pedido') return <Cotizar />;
  return <NoEncontrado />;
}

export default function TiendaApp() {
  const [datos, setDatos] = useState<DatosTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<LineaPedido[]>(leerCarrito);
  const [panel, setPanel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const recargar = useCallback(() => {
    setError(null);
    cargarDatosTienda().then(setDatos, e => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(recargar, [recargar]);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch {
      // sin almacenamiento: la selección vive mientras la pestaña esté abierta
    }
  }, [carrito]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const agregar = useCallback((sku: string, cantidad = 1) => {
    setCarrito(c => {
      const previo = c.find(l => l.sku === sku);
      if (previo) return c.map(l => (l.sku === sku ? { ...l, cantidad: Math.min(MAX_CANTIDAD, l.cantidad + cantidad) } : l));
      return c.length >= 30 ? c : [...c, { sku, cantidad: Math.min(MAX_CANTIDAD, cantidad) }];
    });
    setAviso('Agregado a tu cotización');
  }, []);
  const cambiarCantidad = useCallback((sku: string, cantidad: number) =>
    setCarrito(c => (cantidad <= 0 ? c.filter(l => l.sku !== sku) : c.map(l => (l.sku === sku ? { ...l, cantidad: Math.min(MAX_CANTIDAD, cantidad) } : l)))), []);
  const vaciar = useCallback(() => setCarrito([]), []);

  const valor = useMemo(() => ({ datos, error, recargar, carrito, agregar, cambiarCantidad, vaciar, panel, setPanel }),
    [datos, error, recargar, carrito, agregar, cambiarCantidad, vaciar, panel]);

  return (
    <TiendaContexto.Provider value={valor}>
      <div className="min-h-screen flex flex-col bg-white text-slate-800 pb-20 md:pb-0">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:rounded-xl focus:shadow-elevada">Saltar al contenido</a>
        <Encabezado />
        <main id="contenido" className="flex-1">
          {error ? (
            <div className="max-w-3xl mx-auto px-4 py-16"><EstadoError mensaje={`No pudimos cargar la tienda: ${error}`} reintentar={recargar} /></div>
          ) : (
            <Rutas />
          )}
        </main>
        <Pie />
        <BarraMovil />
        <PanelCotizacion />
        <Aviso texto={aviso} />
      </div>
    </TiendaContexto.Provider>
  );
}

/** Contenedor de página con ancho y márgenes consistentes. */
export function Pagina({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}
