// ==========================================
// MENÚ POR ÁREAS DE TRABAJO
// 7 áreas en el menú lateral; cada área muestra sus secciones como pestañas arriba del contenido.
// Ventas → Catálogo y almacén → Servicios → Clientes → Contabilidad → Reportes → Ajustes
// ==========================================
import {
  BarChart3,
  Boxes,
  Calculator,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileText,
  Flower2,
  Inbox,
  Landmark,
  LineChart,
  QrCode,
  Receipt,
  Scissors,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon
} from 'lucide-react';
import type { Rol } from '../domain/types';
import type { ErpState } from '../store/ErpStore';

export type TabId =
  | 'dashboard'
  | 'caja'
  | 'pedidos'
  | 'solicitudes'
  | 'cotizaciones'
  | 'documentos'
  | 'catalogo'
  | 'kardex'
  | 'bajas'
  | 'etiquetas'
  | 'guias'
  | 'almacen'
  | 'jardineria'
  | 'contratos'
  | 'crm'
  | 'finanzas'
  | 'sunat'
  | 'detracciones'
  | 'contabilidad'
  | 'planilla'
  | 'reportes'
  | 'estadisticas'
  | 'configuracion';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** Número o aviso junto a la sección (sólo cuando hay algo que atender). */
  badge?: (s: ErpState) => string | null;
}

export interface NavBlock {
  id: 'ventas' | 'catalogo' | 'servicios' | 'clientes' | 'contable' | 'reportes' | 'ajustes';
  label: string;
  hint: string;
  icon: LucideIcon;
  items: NavItem[];
}

const cuenta = (n: number) => (n > 0 ? String(n) : null);

export const NAV_BLOCKS: NavBlock[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    hint: 'caja, pedidos y tienda web',
    icon: ShoppingCart,
    items: [
      { id: 'caja', label: 'Caja y POS', icon: Wallet },
      { id: 'solicitudes', label: 'Pedidos web', icon: Inbox, badge: s => cuenta(s.solicitudes.filter(x => x.estado === 'NUEVA').length) },
      { id: 'pedidos', label: 'Pedidos y delivery', icon: ClipboardList, badge: s => cuenta(s.pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length) },
      { id: 'cotizaciones', label: 'Cotizaciones y cupones', icon: FileText, badge: s => cuenta(s.cotizaciones.filter(c => c.estado === 'ENVIADA').length) },
      { id: 'documentos', label: 'Documentos y brochure', icon: FileText }
    ]
  },
  {
    id: 'catalogo',
    label: 'Catálogo y almacén',
    hint: 'productos, stock y logística',
    icon: Boxes,
    items: [
      { id: 'catalogo', label: 'Catálogo', icon: Store },
      { id: 'kardex', label: 'Kardex y stock', icon: Boxes, badge: s => cuenta(s.products.filter(p => p.stock <= p.minStock).length) },
      { id: 'bajas', label: 'Mermas y bajas', icon: Scissors },
      { id: 'etiquetas', label: 'Etiquetas QR', icon: QrCode },
      { id: 'guias', label: 'Guías de remisión', icon: Truck },
      { id: 'almacen', label: 'Reportes de almacén', icon: Warehouse }
    ]
  },
  {
    id: 'servicios',
    label: 'Servicios',
    hint: 'jardinería y mantenimiento',
    icon: Flower2,
    items: [
      { id: 'jardineria', label: 'Proyectos de jardinería', icon: Flower2, badge: s => cuenta(s.projects.filter(p => p.status !== 'CONCLUIDO').length) },
      { id: 'contratos', label: 'Contratos de mantenimiento', icon: CalendarCheck, badge: s => cuenta(s.contratos.filter(c => c.activo).length) }
    ]
  },
  {
    id: 'clientes',
    label: 'Clientes',
    hint: 'ficha única y seguimiento',
    icon: Users,
    items: [{ id: 'crm', label: 'Clientes y seguimiento', icon: CalendarClock, badge: s => cuenta(s.tareas.filter(t => !t.hecha).length) }]
  },
  {
    id: 'contable',
    label: 'Contabilidad',
    hint: 'comprobantes, ingresos y egresos',
    icon: Calculator,
    items: [
      { id: 'finanzas', label: 'Ingresos, egresos y por emitir', icon: Wallet, badge: s => cuenta(s.pedidos.filter(p => p.estado === 'pendiente').length) },
      { id: 'sunat', label: 'Comprobantes SUNAT', icon: Receipt },
      { id: 'detracciones', label: 'Detracciones', icon: Landmark, badge: s => cuenta(s.detracciones.filter(d => d.estado === 'PENDIENTE').length) },
      { id: 'contabilidad', label: 'Impuestos y SIRE', icon: Calculator },
      { id: 'planilla', label: 'Planilla', icon: Users }
    ]
  },
  {
    id: 'reportes',
    label: 'Reportes',
    hint: 'decisiones de venta y compra',
    icon: BarChart3,
    items: [
      { id: 'reportes', label: 'Ventas', icon: BarChart3 },
      { id: 'estadisticas', label: 'Productos, servicios y compras', icon: LineChart }
    ]
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    hint: 'empresa, tienda y usuarios',
    icon: Settings,
    items: [{ id: 'configuracion', label: 'Empresa, tienda y usuarios', icon: Settings }]
  }
];

export const ALL_TABS: TabId[] = ['dashboard', ...NAV_BLOCKS.flatMap(b => b.items.map(i => i.id))];

// Qué pantallas ve cada rol (la base aplica las mismas reglas con RLS)
const TODOS: Rol[] = ['dueno', 'vendedor', 'jardinero'];
const VENTAS: Rol[] = ['dueno', 'vendedor'];
const DUENO: Rol[] = ['dueno'];

const PERMISOS: Record<TabId, Rol[]> = {
  dashboard: DUENO,
  caja: VENTAS,
  pedidos: VENTAS,
  solicitudes: VENTAS,
  cotizaciones: VENTAS,
  documentos: VENTAS,
  catalogo: VENTAS,
  kardex: TODOS,
  bajas: TODOS,
  etiquetas: VENTAS,
  guias: VENTAS,
  almacen: DUENO,
  jardineria: TODOS,
  contratos: TODOS,
  crm: TODOS,
  finanzas: DUENO,
  sunat: VENTAS,
  detracciones: DUENO,
  contabilidad: DUENO,
  planilla: DUENO,
  reportes: DUENO,
  estadisticas: DUENO,
  configuracion: DUENO
};

export const ROL_ETIQUETA: Record<Rol, string> = { dueno: 'Dueño', vendedor: 'Vendedor', jardinero: 'Jardinero' };

export function puedeVer(rol: Rol, tab: TabId): boolean {
  return PERMISOS[tab].includes(rol);
}

/** Primera pantalla del rol: el dueño entra al inicio, el vendedor a caja, el jardinero a sus servicios. */
export function tabInicial(rol: Rol): TabId {
  return ALL_TABS.find(t => puedeVer(rol, t)) ?? 'jardineria';
}

export function bloquesPara(rol: Rol): NavBlock[] {
  return NAV_BLOCKS.map(b => ({ ...b, items: b.items.filter(i => puedeVer(rol, i.id)) })).filter(b => b.items.length > 0);
}

export function blockOf(tab: TabId): NavBlock | undefined {
  return NAV_BLOCKS.find(b => b.items.some(i => i.id === tab));
}

export function itemOf(tab: TabId): NavItem | undefined {
  return NAV_BLOCKS.flatMap(b => b.items).find(i => i.id === tab);
}
