// ==========================================
// MENÚ ORGANIZADO POR FLUJO DE NEGOCIO
// Vender → Servicios → Clientes → Inventario → Administración
// ==========================================
import {
  Boxes,
  Calculator,
  CalendarClock,
  ClipboardList,
  Flower2,
  Landmark,
  Receipt,
  Scissors,
  Settings,
  Store,
  Truck,
  Users,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import type { Rol } from '../domain/types';
import type { ErpState } from '../store/ErpStore';

export type TabId =
  | 'dashboard'
  | 'caja'
  | 'catalogo'
  | 'pedidos'
  | 'jardineria'
  | 'crm'
  | 'kardex'
  | 'bajas'
  | 'guias'
  | 'sunat'
  | 'detracciones'
  | 'contabilidad'
  | 'planilla'
  | 'configuracion';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  iconClass?: string;
  badge: (s: ErpState) => string;
  badgeClass?: string;
}

export interface NavBlock {
  id: 'vender' | 'servicios' | 'clientes' | 'inventario' | 'admin';
  label: string;
  emoji: string;
  hint: string;
  icon: LucideIcon;
  items: NavItem[];
}

const alerta = 'bg-[#fee2e2] text-[#b91c1c]';

export const NAV_BLOCKS: NavBlock[] = [
  {
    id: 'vender',
    label: 'Vender',
    emoji: '🛍️',
    hint: 'caja, tienda, pedidos',
    icon: Store,
    items: [
      { id: 'caja', label: 'Caja del Día', icon: Wallet, iconClass: 'text-[#d4af37]', badge: s => s.cashRegister.estadoCaja },
      { id: 'catalogo', label: 'Tienda & Catálogo POS', icon: Store, badge: s => String(s.products.length) },
      {
        id: 'pedidos',
        label: 'Pedidos & Delivery',
        icon: ClipboardList,
        iconClass: 'text-[#d4af37]',
        badge: s => String(s.pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length)
      }
    ]
  },
  {
    id: 'servicios',
    label: 'Servicios',
    emoji: '🌿',
    hint: 'jardinería',
    icon: Flower2,
    items: [
      {
        id: 'jardineria',
        label: 'Jardines & Paisajismo VIP',
        icon: Flower2,
        badge: s => String(s.projects.filter(p => p.status !== 'CONCLUIDO').length)
      }
    ]
  },
  {
    id: 'clientes',
    label: 'Clientes',
    emoji: '🤝',
    hint: 'ficha única',
    icon: Users,
    items: [
      { id: 'crm', label: 'CRM Botánico & Alertas', icon: CalendarClock, iconClass: 'text-[#d4af37]', badge: s => String(s.crmClients.length) }
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    emoji: '📦',
    hint: 'stock & mermas',
    icon: Boxes,
    items: [
      {
        id: 'kardex',
        label: 'Kardex & Almacén Físico',
        icon: Boxes,
        badge: s => {
          const bajos = s.products.filter(p => p.stock <= p.minStock).length;
          return bajos ? `${bajos} ⚠️` : 'OK';
        }
      },
      { id: 'bajas', label: 'Bajas & Cuarentena', icon: Scissors, iconClass: 'text-[#e05780]', badge: () => 'Mermas', badgeClass: alerta }
    ]
  },
  {
    id: 'admin',
    label: 'Administración',
    emoji: '📑',
    hint: 'sunat & rr.hh.',
    icon: Calculator,
    items: [
      { id: 'sunat', label: 'Facturación SUNAT SEE', icon: Receipt, badge: s => String(s.invoices.length) },
      { id: 'guias', label: 'Guías de Remisión GRE', icon: Truck, badge: s => s.company.serieGre },
      {
        id: 'detracciones',
        label: 'Detracciones SPOT (BN)',
        icon: Landmark,
        iconClass: 'text-[#d4af37]',
        badge: s => `${Math.round(s.company.tasaDetraccionServicios * 100)}%`,
        badgeClass: alerta
      },
      { id: 'contabilidad', label: 'Contabilidad & SIRE', icon: Calculator, iconClass: 'text-[#d4af37]', badge: () => '621' },
      { id: 'planilla', label: 'Planilla & Provisiones', icon: Users, iconClass: 'text-[#e05780]', badge: () => 'AFP' },
      { id: 'configuracion', label: 'Ajustes & RUC Empresa', icon: Settings, iconClass: 'text-[#d4af37]', badge: () => 'RUC' }
    ]
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
  catalogo: VENTAS,
  pedidos: VENTAS,
  jardineria: TODOS,
  crm: TODOS,
  kardex: TODOS,
  bajas: TODOS,
  sunat: VENTAS,
  guias: VENTAS,
  detracciones: DUENO,
  contabilidad: DUENO,
  planilla: DUENO,
  configuracion: DUENO
};

export const ROL_ETIQUETA: Record<Rol, string> = { dueno: 'Dueño', vendedor: 'Vendedor', jardinero: 'Jardinero' };

export function puedeVer(rol: Rol, tab: TabId): boolean {
  return PERMISOS[tab].includes(rol);
}

/** Primera pantalla del rol: el dueño entra al panel, el vendedor a caja, el jardinero a sus servicios. */
export function tabInicial(rol: Rol): TabId {
  return ALL_TABS.find(t => puedeVer(rol, t)) ?? 'jardineria';
}

export function bloquesPara(rol: Rol): NavBlock[] {
  return NAV_BLOCKS.map(b => ({ ...b, items: b.items.filter(i => puedeVer(rol, i.id)) })).filter(b => b.items.length > 0);
}

export function blockOf(tab: TabId): NavBlock | undefined {
  return NAV_BLOCKS.find(b => b.items.some(i => i.id === tab));
}
