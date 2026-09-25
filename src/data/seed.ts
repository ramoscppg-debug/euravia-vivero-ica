// ==========================================
// DATOS DEMO (SEMILLA) - AUREVIA
// Estado inicial del ERP cuando no hay datos guardados.
// ==========================================
import { SPOT_TASA_SERVICIOS } from '../lib/peru';
import type {
  BiologicalLoss,
  CashRegisterState,
  CatalogProduct,
  ComprobanteSunat,
  CrmClient,
  DetraccionRecord,
  EmpresaConfig,
  GardeningProject,
  GuiaRemisionSunat,
  InternalConsumption,
  KardexMovement,
  Purchase,
  TrabajadorAurevia
} from '../domain/types';

export const INITIAL_COMPANY_CONFIG: EmpresaConfig = {
  ruc: '20609876541',
  razonSocial: 'AUREVIA BOTANICAL S.A.C.',
  nombreComercial: 'AUREVIA - Plantas, Jardines & Vida Natural',
  direccion: 'Av. Primavera 1280, Chacarilla',
  ubigeo: '150140', // Surco, Lima, Lima
  distrito: 'Santiago de Surco',
  provincia: 'Lima',
  departamento: 'Lima',
  telefono: '+51 987 654 321',
  email: 'contacto@aurevia.pe',
  actividadCiiu: '0130 - Propagación de plantas y actividades de viveros',
  codigoEstablecimiento: '0000',
  sunatAmbiente: 'PRODUCCION',
  usuarioSol: 'AUREVIASOL',
  claveSol: '••••••••••••',
  certificadoCdtNombre: 'CDT_AUREVIA_2026_2029.pfx',
  certificadoVencimiento: '2029-08-15',
  serieBoleta: 'B001',
  serieFactura: 'F001',
  serieGre: 'T001',
  formatoTicket: '80mm',
  pieDePaginaTicket: '¡Gracias por cultivar vida con Aurevia! Garantía botánica de 15 días con asesoría personalizada.',
  afpnetUsuario: '20609876541_ADMIN',
  afpnetCodigoEmpresa: 'AFP-AUR-9921',
  cuentaDetraccionesBn: '00-068-091823',
  cuentaBcpSoles: '193-9821456-0-12',
  cuentaBbvaSoles: '0011-0182-0200847291',
  tasaDetraccionServicios: SPOT_TASA_SERVICIOS // 12% — "Demás servicios gravados con IGV" (Anexo 3, cód. 037)
};

// ============================================================================
// PRODUCTOS & ESPECIES BOTÁNICAS
// ============================================================================
export const INITIAL_PRODUCTS: CatalogProduct[] = [
  {
    sku: 'AUR-001',
    name: 'Monstera Deliciosa',
    scientificName: 'Monstera deliciosa Liebm.',
    botanicalFamily: 'Araceae',
    category: 'interior',
    categoryName: 'Planta de Interior',
    price: 85.00,
    cost: 35.00,
    stock: 28,
    minStock: 6,
    location: 'Zona Tropical B-03',
    careLight: 'Luz Indirecta Brillante',
    careWater: 'Riego semanal moderado',
    size: 'Mediana (65 cm)',
    isLivePlant: true,
    fullImage: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600&auto=format&fit=crop&q=80',
    description: 'Hojas esculturales con fenestraciones naturales que purifican y transforman cualquier espacio contemporáneo en un santuario botánico.'
  },
  {
    sku: 'AUR-002',
    name: 'Sansevieria Laurentii',
    scientificName: 'Dracaena trifasciata',
    botanicalFamily: 'Asparagaceae',
    category: 'interior',
    categoryName: 'Planta Purificadora',
    price: 48.00,
    cost: 18.00,
    stock: 35,
    minStock: 8,
    location: 'Zona Purificadora B-01',
    careLight: 'Tolera baja a alta luz',
    careWater: 'Cada 15 a 20 días',
    size: 'Mediana (50 cm)',
    isLivePlant: true,
    fullImage: 'https://images.unsplash.com/photo-1593482892290-f54927ae1bf6?w=600&auto=format&fit=crop&q=80',
    description: 'Líneas arquitectónicas verticales con bordes dorados, campeona certificada en purificación de aire y oxigenación nocturna.'
  },
  {
    sku: 'AUR-003',
    name: 'Ficus Lyrata Pandurata',
    scientificName: 'Ficus lyrata',
    botanicalFamily: 'Moraceae',
    category: 'interior',
    categoryName: 'Árbol Ornamental Interior',
    price: 120.00,
    cost: 50.00,
    stock: 14,
    minStock: 4,
    location: 'Pabellón Central C-02',
    careLight: 'Luz filtrada abundante',
    careWater: '2 veces por semana',
    size: 'Grande (1.10 m)',
    isLivePlant: true,
    fullImage: 'https://images.unsplash.com/photo-1597055181300-e3633a917c9c?w=600&auto=format&fit=crop&q=80',
    description: 'La reina indiscutible del interiorismo botánico. Hojas lustrosas en forma de lira y tronco leñoso estilizado.'
  },
  {
    sku: 'AUR-004',
    name: 'Palmera Areca Palma de Salón',
    scientificName: 'Dypsis lutescens',
    botanicalFamily: 'Arecaceae',
    category: 'interior',
    categoryName: 'Planta Tropical',
    price: 95.00,
    cost: 40.00,
    stock: 19,
    minStock: 5,
    location: 'Invernadero A-04',
    careLight: 'Luz brillante tamizada',
    careWater: '3 veces por semana',
    size: 'Grande (1.20 m)',
    isLivePlant: true,
    fullImage: 'https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600&auto=format&fit=crop&q=80',
    description: 'Follaje plumoso y elegante que aporta frescura, humedad y un ambiente zen a salas de estar y oficinas corporativas.'
  },
  {
    sku: 'MAC-001',
    name: 'Maceta Cerámica Arena Mate 28cm',
    scientificName: 'Artesanía en Terracota',
    botanicalFamily: 'Accesorios & Alfarería',
    category: 'macetas',
    categoryName: 'Maceta Artesanal',
    price: 55.00,
    cost: 22.00,
    stock: 24,
    minStock: 10,
    location: 'Boutique Macetas D-01',
    careLight: 'Interior y terraza cubierta',
    careWater: 'Incluye plato de drenaje',
    size: 'Diámetro 28cm x Alto 30cm',
    isLivePlant: false,
    fullImage: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80',
    description: 'Cerámica cocida a alta temperatura con textura arenosa mate, líneas suaves y plato de contención hermético.'
  },
  {
    sku: 'SUB-001',
    name: 'Sustrato Premium Orgánico 10L',
    scientificName: 'Humus + Perlita + Fibra de Coco',
    botanicalFamily: 'Nutrición Botánica',
    category: 'sustratos',
    categoryName: 'Sustratos & Abonos',
    price: 28.00,
    cost: 11.00,
    stock: 45,
    minStock: 15,
    location: 'Almacén Insumos E-02',
    careLight: 'Conservar en lugar fresco',
    careWater: 'Aireado y drenante',
    size: 'Bolsa de 10 Litros',
    isLivePlant: false,
    fullImage: 'https://images.unsplash.com/photo-1585336261026-7f83a45c2253?w=600&auto=format&fit=crop&q=80',
    description: 'Mezcla balanceada enriquecida con micorrizas, humus de lombriz seleccionado y perlita para oxigenación radicular.'
  }
];

// ============================================================================
// NÓMINA DE TRABAJADORES (PLANILLA MYPE AUREVIA & AFPNET)
// ============================================================================
export const INITIAL_EMPLOYEES: TrabajadorAurevia[] = [
  { 
    id: 'EMP-01', 
    dni: '45678912', 
    nombres: 'José', 
    apellidos: 'Paredes Quispe', 
    cargo: 'Jardinero & Paisajista Senior', 
    fechaIngreso: '2025-03-01', 
    sueldoBasico: 1450.00, 
    asignacionFamiliar: true, 
    regimenLaboral: 'MYPE_MICRO', 
    sistemaPension: 'INTEGRA', 
    cuspp: '567891JPQU01', 
    diasTrabajados: 30 
  },
  { 
    id: 'EMP-02', 
    dni: '71234567', 
    nombres: 'Raúl', 
    apellidos: 'Morales Alva', 
    cargo: 'Chofer Reparto & Logística', 
    fechaIngreso: '2025-06-15', 
    sueldoBasico: 1250.00, 
    asignacionFamiliar: false, 
    regimenLaboral: 'MYPE_MICRO', 
    sistemaPension: 'PRIMA', 
    cuspp: '712345RMAL02', 
    diasTrabajados: 30 
  },
  { 
    id: 'EMP-03', 
    dni: '74561238', 
    nombres: 'Sofía', 
    apellidos: 'Castillo Vega', 
    cargo: 'Asesora Botánica & Vendedora', 
    fechaIngreso: '2026-01-10', 
    sueldoBasico: 1200.00, 
    asignacionFamiliar: false, 
    regimenLaboral: 'MYPE_MICRO', 
    sistemaPension: 'ONP', 
    diasTrabajados: 30 
  }
];

export const INITIAL_PROJECTS: GardeningProject[] = [
  {
    id: 'JAR-2026-001',
    client: 'Residencia Familia Ugarte',
    doc: '41238974', // DNI — consumidor final → Boleta, sin detracción
    phone: '+51 984 123 456',
    type: 'Diseño Paisajista',
    address: 'Av. Las Casuarinas 450, Surco',
    status: 'EN_EJECUCION',
    materials: [
      { sku: 'AUR-003', name: 'Ficus Lyrata Pandurata', qty: 6, unitPrice: 120.00 },
      { sku: 'AUR-001', name: 'Monstera Deliciosa', qty: 12, unitPrice: 85.00 },
      { sku: 'SUB-001', name: 'Sustrato Premium Orgánico 10L', qty: 15, unitPrice: 28.00 },
      { sku: 'MAC-001', name: 'Maceta Cerámica Arena Mate 28cm', qty: 6, unitPrice: 55.00 }
    ],
    laborHours: 28,
    laborRatePerHour: 35.00,
    total: 3450.00,
    date: '2026-09-04',
    stockDeducted: true,
    aplicaDetraccion: false, // cliente con DNI → Boleta: la detracción SPOT no aplica
    montoDetraccion: 0,
    montoNetoACobrar: 3450.00
  },
  {
    id: 'JAR-2026-002',
    client: 'Boutique Hotel Miraflores SAC',
    doc: '20601122333', // RUC válido (módulo 11) → Factura con detracción SPOT
    phone: '+51 998 765 432',
    type: 'Jardín Vertical',
    address: 'Calle Alcanfores 280, Miraflores',
    status: 'APROBADO',
    materials: [
      { sku: 'AUR-001', name: 'Monstera Deliciosa', qty: 25, unitPrice: 85.00 },
      { sku: 'AUR-002', name: 'Sansevieria Laurentii', qty: 20, unitPrice: 48.00 },
      { sku: 'SUB-001', name: 'Sustrato Premium Orgánico 10L', qty: 30, unitPrice: 28.00 }
    ],
    laborHours: 45,
    laborRatePerHour: 35.00,
    total: 5800.00,
    date: '2026-09-05',
    stockDeducted: false,
    aplicaDetraccion: true,
    montoDetraccion: 696.00, // 12% SPOT "demás servicios" (Anexo 3, cód. 037)
    montoNetoACobrar: 5104.00
  }
];

export const INITIAL_DETRACCIONES: DetraccionRecord[] = [
  {
    id: 'DET-2026-001',
    facturaId: 'F001-00000088',
    cliente: 'Boutique Hotel Miraflores SAC',
    rucCliente: '20601122333',
    fechaEmision: '2026-09-05',
    fechaVencimientoBn: '2026-10-07',
    montoFactura: 5800.00,
    tasa: 0.12,
    montoDetraccion: 696.00,
    estado: 'PENDIENTE'
  },
  {
    id: 'DET-2026-002',
    facturaId: 'F001-00000075',
    cliente: 'Club Residencial Los Álamos',
    rucCliente: '20551239846',
    fechaEmision: '2026-08-20',
    fechaVencimientoBn: '2026-09-05',
    montoFactura: 3450.00,
    tasa: 0.12,
    montoDetraccion: 414.00,
    estado: 'DEPOSITADO',
    constanciaBn: 'BN-99218273',
    fechaDeposito: '2026-09-03'
  }
];

export const INITIAL_CRM_CLIENTS: CrmClient[] = [
  {
    id: 'CRM-01',
    name: 'Valeria Benavides',
    phone: '+51 987 654 321',
    district: 'Miraflores',
    plantsOwned: ['Monstera Deliciosa', 'Ficus Lyrata Pandurata'],
    lastPurchaseDate: '2026-09-06',
    seasonalAlert: '🌱 Temporada de fertilización primaveral y limpieza de follaje con paño húmedo.',
    recommendedAction: 'Aplicación de humus líquido + tutor de musgo para crecimiento vertical.',
    urgency: 'ESTACIONAL'
  },
  {
    id: 'CRM-02',
    name: 'Carlos Mendoza Paredes',
    phone: '+51 976 543 210',
    district: 'San Isidro',
    plantsOwned: ['Sansevieria Laurentii'],
    lastPurchaseDate: '2026-09-06',
    seasonalAlert: '☀️ Riego quincenal moderado y rotación de maceta para luz solar homogénea.',
    recommendedAction: 'Control preventivo de sustrato y oxigenación con palito de bambú.',
    urgency: 'MEDIA'
  },
  {
    id: 'CRM-03',
    name: 'Boutique Hotel Miraflores SAC',
    phone: '+51 998 765 432',
    district: 'Miraflores',
    plantsOwned: ['40 Helechos Boston', '30 Filodendros', 'Jardín Vertical'],
    lastPurchaseDate: '2026-09-05',
    seasonalAlert: '💧 Mantenimiento de boquillas de riego por goteo y poda de hojas senescentes.',
    recommendedAction: 'Visita técnica programada con jardinero senior.',
    urgency: 'ALTA'
  }
];

export const INITIAL_LOSSES: BiologicalLoss[] = [
  {
    id: 'BAJ-2026-001',
    sku: 'AUR-001',
    productName: 'Monstera Deliciosa',
    type: 'DESMEDRO_PLAGA',
    qty: 2,
    unitCost: 35.00,
    totalLoss: 70.00,
    reason: 'Presencia de cochinilla algodonosa en pecíolos. Aislada de venta y destruida según acta.',
    date: '2026-09-02',
    status: 'ACREDITADO_CONTABLE'
  },
  {
    id: 'BAJ-2026-002',
    sku: 'AUR-004',
    productName: 'Palmera Areca',
    type: 'CUARENTENA_FITOSANITARIA',
    qty: 3,
    unitCost: 40.00,
    totalLoss: 120.00,
    reason: 'Tratamiento preventivo con aceite de neem y jabón potásico en túnel de cuarentena.',
    date: '2026-09-05',
    status: 'EN_OBSERVACION'
  }
];

export const INITIAL_INTERNAL_CONSUMPTIONS: InternalConsumption[] = [
  {
    id: 'CON-2026-001',
    date: '2026-09-03',
    itemSku: 'SUB-001',
    itemName: 'Sustrato Premium Orgánico 10L',
    qty: 4,
    unitCost: 11.00,
    totalCost: 44.00,
    destination: 'Re-macetado de Monsteras en Exhibición (Zona B)',
    responsible: 'José Paredes'
  }
];


export const INITIAL_CASH_REGISTER: CashRegisterState = {
  aperturaEfectivo: 200.00,
  ventasEfectivo: 85.00,
  ventasBilleteras: 145.00,
  ventasTarjetas: 290.00,
  ventasTransferencias: 120.00,
  egresos: [
    { id: 'EG-01', motivo: 'Compra de agua bidón para invernadero', monto: 18.00, hora: '10:30', responsable: 'Sofía Castillo' },
    { id: 'EG-02', motivo: 'Combustible camioneta de reparto', monto: 35.00, hora: '14:15', responsable: 'Raúl Morales' }
  ],
  conteoRealEfectivo: 232.00,
  estadoCaja: 'ABIERTA'
};

const company = INITIAL_COMPANY_CONFIG;

export const INITIAL_INVOICES: ComprobanteSunat[] = [
  {
    id: 'B001-00000342',
    tipoComprobante: '03',
    serie: 'B001',
    correlativo: 342,
    fechaEmision: '2026-09-06',
    horaEmision: '18:30:15',
    moneda: 'PEN',
    emisor: company,
    cliente: { tipoDoc: '1', numDoc: '47891234', nombreRazonSocial: 'Valeria Benavides' },
    opGravadas: 72.03,
    opExoneradas: 0,
    opInafectas: 0,
    totalIgv: 12.97,
    montoTotal: 85.00,
    items: [
      { item: 1, sku: 'AUR-001', unidadMedida: 'NIU', descripcion: 'Monstera Deliciosa Mediana', cantidad: 1, valorUnitario: 72.03, precioUnitario: 85.00, subtotal: 72.03, igv: 12.97, total: 85.00, tipoAfectacion: '10' }
    ],
    estadoSunat: 'ACEPTADO',
    descripcionRespuestaSunat: 'La Boleta Electrónica B001-00000342 ha sido aceptada por SUNAT (CDR 0000).',
    hashCpe: 'Qk8xMjN4OTkxMmE='
  },
  {
    id: 'F001-00000089',
    tipoComprobante: '01',
    serie: 'F001',
    correlativo: 89,
    fechaEmision: '2026-09-06',
    horaEmision: '16:15:00',
    moneda: 'PEN',
    emisor: company,
    cliente: { tipoDoc: '6', numDoc: '20601234567', nombreRazonSocial: 'Arquitectura & Paisajes Modernos SAC' },
    opGravadas: 245.76,
    opExoneradas: 0,
    opInafectas: 0,
    totalIgv: 44.24,
    montoTotal: 290.00,
    items: [
      { item: 1, sku: 'AUR-003', unidadMedida: 'NIU', descripcion: 'Ficus Lyrata Pandurata Grande', cantidad: 2, valorUnitario: 101.69, precioUnitario: 120.00, subtotal: 203.39, igv: 36.61, total: 240.00, tipoAfectacion: '10' },
      { item: 2, sku: 'MAC-001', unidadMedida: 'NIU', descripcion: 'Maceta Cerámica Arena Mate', cantidad: 1, valorUnitario: 42.37, precioUnitario: 50.00, subtotal: 42.37, igv: 7.63, total: 50.00, tipoAfectacion: '10' }
    ],
    estadoSunat: 'ACEPTADO',
    descripcionRespuestaSunat: 'La Factura Electrónica F001-00000089 ha sido aceptada por SUNAT (CDR 0000).',
    hashCpe: 'RmFjdC0yMDI2LTAwODk='
  }
];

export const INITIAL_GUIAS: GuiaRemisionSunat[] = [
  {
    id: 'T001-00000014',
    serie: 'T001',
    correlativo: 14,
    fechaEmision: '2026-09-06',
    motivoTraslado: '01',
    descripcionMotivo: 'Venta y Entrega Botánica a Domicilio',
    emisor: company,
    destinatario: { tipoDoc: '1', numDoc: '47891234', nombreRazonSocial: 'Valeria Benavides' },
    puntoPartida: { ubigeo: company.ubigeo, direccion: `Vivero ${company.nombreComercial}, ${company.direccion}` },
    puntoLlegada: { ubigeo: '150122', direccion: 'Calle Las Orquídeas 340, Miraflores' },
    datosEnvio: {
      pesoBrutoTotal: 25.5,
      unidadMedidaPeso: 'KGM',
      modalidadTraslado: '02',
      fechaInicioTraslado: '2026-09-06',
      placaVehiculo: 'BZF-412',
      conductorDni: '71234567',
      conductorNombre: 'Raúl Morales Alva'
    },
    items: [
      { item: 1, sku: 'AUR-001', descripcion: 'Monstera Deliciosa Mediana en maceta', cantidad: 1, unidadMedida: 'NIU' }
    ],
    estadoSunat: 'ACEPTADO',
    hashGre: 'R1JFLVRyYW5zcG9ydGUtMDEwMQ=='
  }
];

export const INITIAL_PURCHASES: Purchase[] = [
  { id: 'FC01-0004512', proveedor: 'Viveros Mayoristas del Sur SAC', ruc: '20556677881', fecha: '2026-09-01', gravada: 1250.00, igv: 225.00, total: 1475.00, items: '30 Monsteras, 15 Ficus Lyrata' },
  { id: 'FC01-0008921', proveedor: 'Artesanías & Macetas Perú EIRL', ruc: '20443322119', fecha: '2026-09-03', gravada: 680.00, igv: 122.40, total: 802.40, items: '30 Macetas Cerámica Arena' },
  { id: 'FC02-0001290', proveedor: 'Sustratos y Abonos Orgánicos SAC', ruc: '20609988112', fecha: '2026-09-05', gravada: 420.00, igv: 75.60, total: 495.60, items: '50 Bolsas Sustrato Premium 10L' }
];

// Kardex de apertura: un saldo inicial por producto, para que cada movimiento posterior tenga historia
export const INITIAL_KARDEX: KardexMovement[] = INITIAL_PRODUCTS.map((p, i) => ({
  id: `KDX-${String(i + 1).padStart(5, '0')}`,
  date: '2026-09-01',
  productSku: p.sku,
  productName: p.name,
  movementType: 'Ajuste Inventario',
  quantityIn: p.stock,
  quantityOut: 0,
  balance: p.stock,
  unitCost: p.cost,
  referenceDoc: 'INV-INICIAL',
  responsibleUser: 'Almacén Aurevia'
}));
