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
  /** EXTERNA: el sistema prepara el modelo y se emite en el portal SOL u otra plataforma. DIRECTA: API (pendiente). */
  modoEmision: 'EXTERNA' | 'DIRECTA';
  /** Último número usado por serie, para seguir la numeración donde se quedó en SUNAT. */
  ultimosNumeros: Record<string, number>;
  serieNcBoleta: string;
  serieNcFactura: string;
  /** % que la empresa cobra al jardinero por cada servicio (sin configurar no se registran servicios). */
  comisionJardineroPct?: number;
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
  visibleTienda?: boolean; // por defecto se muestra en la tienda pública
  valorInventario?: number; // saldo costo total (Kardex valorizado)
  costoPromedio?: number; // saldo costo unitario (promedio ponderado)
  unidadMedida?: string; // SUNAT Tabla 6
  tipoExistencia?: string; // SUNAT Tabla 5
  destacado?: boolean; // aparece en la portada
}

export type MovementType =
  | 'Compra Proveedor'
  | 'Venta Cliente'
  | 'Servicio Jardineria'
  | 'Baja por Perdida'
  | 'Ajuste Inventario'
  | 'Devolucion Cliente'
  | 'Entrada por Produccion'
  | 'Salida a Produccion';

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
  // Formato 13.1 (SUNAT): documento, operación y saldo valorizado al costo promedio ponderado
  fechaEmision?: string;
  tipoComprobante?: string; // Tabla 10
  comprobanteSerie?: string;
  comprobanteNumero?: string;
  tipoOperacion?: string; // Tabla 12
  movimiento?: 'ENTRADA' | 'SALIDA';
  cantidad?: number;
  costoTotal?: number;
  saldoCantidad?: number;
  saldoCostoUnitario?: number;
  saldoCostoTotal?: number;
}

/** Parte de producción propia (doc. 00): insumos consumidos (op. 10) y producto obtenido (op. 19). */
export interface ParteProduccion {
  numero: string;
  fecha: string;
  sku: string;
  cantidad: number;
  costoInsumos: number;
  costoAdicional: number;
  costoUnitario: number;
  insumos: { sku: string; cantidad: number }[];
  notas?: string;
  responsable: string;
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

/** Gasto menor pagado con efectivo de caja (historial para el libro de egresos). */
export interface GastoCaja {
  id: string;
  fecha: string; // YYYY-MM-DD (hora de Lima)
  motivo: string;
  monto: number;
  responsable: string;
  cuenta?: string; // cuenta PCGE del gasto (Elemento 6)
}

/** Gasto con comprobante (luz, agua, alquiler, contador…): provisión 6x (+ IGV) a 4212 y, si se pagó, 4212 a caja/bancos. */
export interface Gasto {
  id: string;
  fecha: string;
  cuenta: string;
  descripcion: string;
  proveedorRuc?: string;
  proveedor?: string;
  tipoComprobante: '00' | '01' | '02' | '03' | '12' | '14'; // 14: recibo por servicios públicos (luz, agua, teléfono)
  serie?: string;
  numero?: string;
  base: number;
  igv: number;
  total: number;
  medioPago?: string; // sin medio = por pagar
  operacion?: string;
  fechaPago?: string;
  retencion?: number; // recibo por honorarios: renta de 4ta retenida (8% si supera S/ 1 500)
}

/** Jardinero independiente: cobra con recibo por honorarios y la empresa le cobra una comisión. */
export interface Jardinero {
  id: string;
  nombre: string;
  ruc?: string;
  dni?: string;
  telefono?: string;
  comisionPct?: number; // vacío = la comisión general de Ajustes
  suspension4ta: boolean; // tiene constancia de suspensión de retenciones de 4ta
  activo: boolean;
}

/**
 * Servicio hecho por un jardinero.
 * RXH_CLIENTE: el jardinero cobra al cliente con su recibo por honorarios; la empresa le cobra la comisión (+ IGV).
 * FACTURA: la empresa factura al cliente (+ IGV) y el jardinero le emite su recibo por (valor − comisión).
 */
export interface ServicioJardinero {
  id: string;
  fecha: string;
  jardineroId: string;
  descripcion: string;
  clienteNombre: string;
  clienteDoc?: string;
  valor: number; // precio acordado, sin IGV
  modalidad: 'RXH_CLIENTE' | 'FACTURA';
  comisionPct: number;
  comision: number;
  rxhSerie?: string;
  rxhNumero?: string;
  comprobanteId?: string; // factura al cliente (FACTURA) o comprobante de la comisión (RXH_CLIENTE)
  gastoId?: string; // recibo del jardinero a la empresa (FACTURA)
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
  email?: string;
  address?: string;
  canal?: string; // canal de origen (Instagram Ads, WhatsApp, Directo...)
}

export interface NotaCliente {
  id: string;
  clienteId: string;
  texto: string;
  autor: string;
  fecha: string; // ISO
}

export interface Tarea {
  id: string;
  clienteId?: string;
  titulo: string;
  vence: string; // YYYY-MM-DD
  asignadoA?: string;
  hecha: boolean;
  creadoPor: string;
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
  operacion?: string; // N° de operación de Yape/Plin/transferencia, confirmado a mano por ventas
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

// ---------- Pedidos & Delivery ----------
export const CANALES_VENTA = ['WhatsApp', 'Instagram Ads', 'Facebook Ads', 'TikTok Ads', 'Google', 'Web', 'Directo / Vivero'] as const;
export type CanalVenta = (typeof CANALES_VENTA)[number];

export const ESTADOS_PEDIDO = ['pendiente', 'pagado', 'preparando', 'en-reparto', 'entregado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number] | 'cancelado';

export interface PedidoItem {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number; // inc. IGV
}

export interface Pedido {
  id: string;
  createdAt: string;
  canal: CanalVenta;
  estado: EstadoPedido;
  cliente: { nombre: string; telefono: string; doc?: string };
  direccion: string;
  distrito: string;
  referencia?: string;
  fechaEntrega: string; // YYYY-MM-DD
  franja?: string;
  items: PedidoItem[];
  costoDelivery: number;
  total: number;
  notas?: string;
  repartidor?: string;
  metodoPago?: string;
  comprobanteId?: string;
  guiaId?: string;
  fotoEvidencia?: string; // ruta en Storage (nube) o nombre del archivo (demo)
  entregadoAt?: string;
  tipoComprobante?: '01' | '03'; // lo que pidió el cliente (factura o boleta); se emite al cobrar
  razonSocial?: string; // para factura
}

// ---------- Crecer ventas ----------
export interface Cotizacion {
  id: string;
  fecha: string;
  vence: string;
  cliente: { nombre: string; doc?: string; telefono?: string };
  lineas: LineaCarrito[];
  descuentoGlobal: DescuentoGlobal;
  total: number;
  estado: 'ENVIADA' | 'ACEPTADA' | 'CONVERTIDA' | 'RECHAZADA';
  comprobanteId?: string;
  notas?: string;
  creadoPor: string;
}

export interface Cupon {
  codigo: string;
  descripcion?: string;
  tipo: 'PCT' | 'MONTO';
  valor: number;
  minimoCompra: number;
  vence?: string;
  usosMax?: number;
  usos: number;
  activo: boolean;
}

export interface Contrato {
  id: string;
  cliente: { nombre: string; doc: string; telefono?: string };
  direccion?: string;
  servicio: string;
  montoMensual: number;
  diaCobro: number; // 1-28
  visitasMes: number;
  jardinero?: string;
  inicio: string;
  activo: boolean;
  ultimoPeriodo?: string; // 'YYYY-MM'
}

// ---------- Tienda pública (sólo datos de vitrina: sin costos) ----------
export type DisponibilidadPublica = 'DISPONIBLE' | 'POCAS' | 'AGOTADO';

export interface ProductoPublico {
  sku: string;
  nombre: string;
  nombreCientifico?: string;
  categoria: Category;
  categoriaNombre: string;
  familia?: string;
  descripcion?: string;
  imagen?: string;
  precio: number;
  disponibilidad: DisponibilidadPublica;
  stock: number; // unidades disponibles; si el cliente pide más, lo atiende un asesor
  luz?: string;
  riego?: string;
  esPlantaViva: boolean;
  destacado: boolean;
}

export interface ServicioPublico {
  slug: string;
  nombre: string;
  resumen: string;
  descripcion?: string;
  imagen?: string;
  orden: number;
  visible: boolean;
  precioDesde?: number; // referencial, lo fija el dueño; vacío = "a cotizar"
}

/** Contacto que muestra la tienda. Vacío hasta que el dueño lo complete (no se inventan datos). */
export interface ConfigTienda {
  whatsapp?: string;
  email?: string;
  direccion?: string;
  horario?: string;
  mensajePortada?: string;
}

/** Tarifa fija de delivery por distrito (la tienda la muestra y el servidor la aplica). */
export interface TarifaDelivery {
  distrito: string;
  costo: number;
  activo: boolean;
}

/** Aviso al WhatsApp del dueño cuando llega un pedido web (CallMeBot). */
export interface AvisosWhatsapp {
  whatsapp?: string;
  apikey?: string;
  activo: boolean;
  ultimoEnvio?: string;
}

export interface SolicitudTienda {
  id: string;
  tipo: 'PEDIDO' | 'SERVICIO' | 'CONSULTA';
  nombre: string;
  telefono: string;
  email?: string;
  distrito?: string;
  mensaje?: string;
  servicioSlug?: string;
  items: { sku: string; nombre: string; cantidad: number; precio: number; stock?: number }[];
  totalReferencial: number;
  comprobante: 'BOLETA' | 'FACTURA' | 'RXH'; // RXH: servicio cobrado por el jardinero con recibo por honorarios
  docCliente?: string; // DNI (boleta, opcional) o RUC (factura)
  igvReferencial?: number; // IGV incluido en el total referencial (el catálogo es sin IGV)
  razonSocial?: string;
  entrega: 'RECOJO' | 'DELIVERY';
  direccion?: string;
  requiereAsesor: boolean; // pidió más cantidad que el stock
  costoDelivery?: number; // tarifa del distrito; vacío = a coordinar
  estado: 'NUEVA' | 'EN_PROCESO' | 'ATENDIDA' | 'DESCARTADA';
  pedidoId?: string;
  createdAt: string;
}

/** Plantas vs. productos e insumos (agrupa las categorías existentes para la tienda). */
export const CATEGORIAS_PLANTAS: Category[] = ['interior', 'exterior', 'suculentas'];

export function disponibilidadDe(stock: number, minimo: number): DisponibilidadPublica {
  if (stock <= 0) return 'AGOTADO';
  if (stock <= minimo) return 'POCAS';
  return 'DISPONIBLE';
}
