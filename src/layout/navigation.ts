// ==========================================
// MENÚ ORGANIZADO POR FLUJO DE NEGOCIO
// Vender → Servicios → Clientes → Inventario → Administración
// ==========================================
import {
  Boxes,
  Calculator,
  CalendarClock,
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
import type { ErpState } from '../store/ErpStore';

export type TabId =
  | 'dashboard'
  | 'caja'
  | 'catalogo'
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
    hint: 'caja & tienda',
    icon: Store,
    items: [
      { id: 'caja', label: 'Caja del Día', icon: Wallet, iconClass: 'text-[#d4af37]', badge: s => s.cashRegister.estadoCaja },
      { id: 'catalogo', label: 'Tienda & Catálogo POS', icon: Store, badge: s => String(s.products.length) }
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

export function blockOf(tab: TabId): NavBlock | undefined {
  return NAV_BLOCKS.find(b => b.items.some(i => i.id === tab));
}
