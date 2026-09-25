// ==========================================
// MODELO DE DOMINIO ÚNICO - AUREVIA / VIVERO 360
// Todas las pantallas y el store importan sus tipos desde aquí.
// ==========================================
import type { EmisorSunat } from '../types/sunat';

export type { ComprobanteSunat, GuiaRemisionSunat, EmisorSunat } from '../types/sunat';
export type { TrabajadorAurevia } from '../types/payroll';
export type { RegimenTributario } from '../lib/peru';

// ---------- Empresa ----------
export interface EmpresaConfig extends EmisorSunat {
  telefono: string;
  email: string;
  actividadCiiu: string;
  codigoEstablecimiento: string;
  sunatAmbiente: 'BETA' | 'PRODUCCION';
  usuarioSol: string;
  claveSol: string;
  certificadoCdtNombre: string;
  certificadoVencimiento: string;
  serieBoleta: string;
  serieFactura: string;
  serieGre: string;
  formatoTicket: '80mm' | 'A4' | 'A5';
  pieDePaginaTicket: string;
  afpnetUsuario: string;
  afpnetCodigoEmpresa: string;
  cuentaDetraccionesBn: string;
  cuentaBcpSoles: string;
  cuentaBbvaSoles: string;
  tasaDetraccionServicios: number; // e.g. 0.12 (12%)
}

// ---------- Catálogo & Kardex ----------
export type Category = 'interior' | 'exterior' | 'suculentas' | 'macetas' | 'fertilizantes' | 'sustratos' | 'accesorios';

export interface Product {
  sku: string;
  name: string;
  scientificName?: string;
  category: Category;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  location: string; // e.g. "Zona B - Estante 03"
  careLight?: string;
  careWater?: string;
  size?: string;
  isLivePlant: boolean;
  imageIcon?: string;
}

export interface CatalogProduct extends Product {
  fullImage: string;
  description: string;
  botanicalFamily: string;
  categoryName: string;
}

export type MovementType =
  | 'Compra Proveedor'
  | 'Venta Cliente'
  | 'Servicio Jardineria'
  | 'Baja por Perdida'
  | 'Ajuste Inventario'
  | 'Devolucion Cliente';

export interface KardexMovement {
  id: string;
  date: string;
  productSku: string;
  productName: string;
  movementType: MovementType;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  unitCost: number;
  referenceDoc?: string;
  responsibleUser: string;
}

export interface BiologicalLoss {
  id: string;
  sku: string;
  productName: string;
  type: 'MERMA_NATURAL' | 'DESMEDRO_PLAGA' | 'CUARENTENA_FITOSANITARIA' | 'ROTURA_MECANICA';
  qty: number;
  unitCost: number;
  totalLoss: number;
  reason: string;
  date: string;
  status: 'ACREDITADO_CONTABLE' | 'EN_OBSERVACION';
}

export interface InternalConsumption {
  id: string;
  date: string;
  itemSku: string;
  itemName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  destination: string;
  responsible: string;
}

export interface Purchase {
  id: string; // N° factura del proveedor
  proveedor: string;
  ruc: string;
  fecha: string;
  gravada: number;
  igv: number;
  total: number;
  items: string;
}

// ---------- Ventas & Caja ----------
export type PaymentMethod = 'Yape' | 'Plin' | 'Efectivo' | 'Tarjeta' | 'Transferencia';
export type MarketingChannel = 'Facebook Ads' | 'Instagram Ads' | 'TikTok Ads' | 'Google' | 'Directo / Vivero';

export interface EgresoCajaChica {
  id: string;
  motivo: string;
  monto: number;
  hora: string;
  responsable: string;
}

export interface CashRegisterState {
  aperturaEfectivo: number;
  ventasEfectivo: number;
  ventasBilleteras: number; // Yape / Plin
  ventasTarjetas: number; // POS Niubiz / Izipay
  ventasTransferencias: number; // BCP / BBVA
  egresos: EgresoCajaChica[];
  conteoRealEfectivo: number;
  estadoCaja: 'ABIERTA' | 'CUADRADA' | 'CERRADA';
}

// ---------- Servicios de jardinería ----------
export interface GardeningMaterialItem {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export type ProjectStatus = 'COTIZADO' | 'APROBADO' | 'EN_EJECUCION' | 'CONCLUIDO';

export interface GardeningProject {
  id: string;
  client: string;
  doc: string;
  phone: string;
  type: 'Diseño Paisajista' | 'Mantenimiento Residencial' | 'Jardín Vertical' | 'Riego Automatizado';
  address: string;
  status: ProjectStatus;
  materials: GardeningMaterialItem[];
  laborHours: number;
  laborRatePerHour: number;
  total: number;
  date: string;
  stockDeducted: boolean;
  aplicaDetraccion: boolean; // factura por servicios > S/ 700 → SPOT 12%
  montoDetraccion: number;
  montoNetoACobrar: number;
  invoiceId?: string; // comprobante emitido (evita facturar dos veces)
}

export interface DetraccionRecord {
  id: string;
  facturaId: string;
  cliente: string;
  rucCliente: string;
  fechaEmision: string;
  fechaVencimientoBn: string; // 5to día hábil del mes siguiente
  montoFactura: number;
  tasa: number;
  montoDetraccion: number;
  estado: 'PENDIENTE' | 'DEPOSITADO';
  constanciaBn?: string;
  fechaDeposito?: string;
}

// ---------- Clientes ----------
export interface CrmClient {
  id: string;
  name: string;
  doc?: string; // DNI o RUC (clientes registrados en la nube)
  phone: string;
  district: string;
  plantsOwned: string[];
  lastPurchaseDate: string;
  seasonalAlert: string;
  recommendedAction: string;
  urgency: 'ALTA' | 'MEDIA' | 'ESTACIONAL';
}

// ---------- Usuarios ----------
export type Rol = 'dueno' | 'vendedor' | 'jardinero';

/** Sólo los datos públicos del emisor viajan en comprobantes y guías (nunca la Clave SOL ni cuentas). */
export function emisorDe(c: EmisorSunat): EmisorSunat {
  const { ruc, razonSocial, nombreComercial, direccion, ubigeo, distrito, provincia, departamento } = c;
  return { ruc, razonSocial, nombreComercial, direccion, ubigeo, distrito, provincia, departamento };
}

// ---------- POS ----------
export const MEDIOS_PAGO = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export interface Pago {
  medio: MedioPago;
  monto: number;
}

export interface LineaCarrito {
  sku: string;
  qty: number;
  descuentoPct: number; // 0-100, descuento de la línea
}

export interface DescuentoGlobal {
  tipo: 'PCT' | 'MONTO';
  valor: number;
}
