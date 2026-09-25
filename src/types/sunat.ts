// ========================================================
// TIPOS Y MODELOS SUNAT - FACTURACIÓN Y GUÍAS (UBL 2.1)
// ========================================================

export type TipoComprobanteSunat = 
  | '01' // Factura Electrónica
  | '03' // Boleta de Venta Electrónica
  | '07' // Nota de Crédito
  | '08' // Nota de Débito
  | '09' // Guía de Remisión Remitente (GRE)
  | 'NV'; // Nota de Venta Interna

export type TipoDocumentoIdentidad = 
  | '1' // DNI (8 dígitos)
  | '6' // RUC (11 dígitos)
  | '4' // Carné de Extranjería
  | '7' // Pasaporte
  | '0'; // Sin documento / Consumidor Final

export type TipoAfectacionIgv = 
  | '10' // Gravado - Operación Onerosa (18%)
  | '20' // Exonerado - Operación Onerosa
  | '30'; // Inafecto - Operación Onerosa

export interface ItemComprobanteSunat {
  item: number;
  sku: string;
  codigoSunat?: string; // Catálogo UNSPSC (ej: 10161500 - Plantas vivas)
  unidadMedida: 'NIU' | 'KGM' | 'BX'; // NIU = Unidades, KGM = Kilogramos
  descripcion: string;
  cantidad: number;
  valorUnitario: number; // Precio sin IGV
  precioUnitario: number; // Precio con IGV (18%)
  subtotal: number;
  igv: number;
  total: number;
  tipoAfectacion: TipoAfectacionIgv;
}

export interface EmisorSunat {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  ubigeo: string;
  distrito: string;
  provincia: string;
  departamento: string;
}

export interface ComprobanteSunat {
  id: string; // ej: 'F001-0000124' o 'B001-0000350'
  tipoComprobante: TipoComprobanteSunat;
  serie: string; // 'F001', 'B001', 'T001'
  correlativo: number;
  fechaEmision: string;
  horaEmision: string;
  moneda: 'PEN' | 'USD';
  
  // Datos Emisor (Aurevia)
  emisor: EmisorSunat;

  // Datos Cliente / Receptor
  cliente: {
    tipoDoc: TipoDocumentoIdentidad;
    numDoc: string; // DNI o RUC
    nombreRazonSocial: string;
    direccion?: string;
    email?: string;
  };

  // Montos
  opGravadas: number;
  opExoneradas: number;
  opInafectas: number;
  totalIgv: number; // 18%
  montoTotal: number;
  
  // Items
  items: ItemComprobanteSunat[];
  
  // Estado SUNAT
  estadoSunat: 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO' | 'ANULADO';
  codigoRespuestaSunat?: string;
  descripcionRespuestaSunat?: string;
  hashCpe?: string; // Código Hash de la firma digital
  qrUrl?: string;

  // Datos comerciales del POS
  descuentoTotal?: number; // descuento aplicado (inc. IGV), ya prorrateado en los ítems
  pagos?: { medio: string; monto: number }[]; // pago mixto
  referencia?: string; // nota de crédito: comprobante que modifica
  motivo?: string; // nota de crédito: motivo de la devolución
}

// GUÍA DE REMISIÓN REMITENTE ELECTRÓNICA (GRE - SUNAT)
export interface GuiaRemisionItem {
  item: number;
  sku: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
}

export interface GuiaRemisionSunat {
  id: string; // 'T001-0000045'
  serie: string; // 'T001'
  correlativo: number;
  fechaEmision: string;
  fechaTraslado?: string;
  motivoTraslado: '01' | '04' | '13' | string;
  descripcionMotivo?: string;
  modalidadTransporte?: '01' | '02';
  pesoBrutoTotal?: number;
  unidadPeso?: 'KGM';
  numBultos?: number;
  documentoReferencia?: string;

  emisor: EmisorSunat;
  
  destinatario: {
    tipoDoc: TipoDocumentoIdentidad;
    numDoc: string;
    nombreRazonSocial?: string;
    nombre?: string;
  };

  puntoPartida: {
    ubigeo: string;
    direccion: string;
  };
  puntoLlegada: {
    ubigeo: string;
    direccion: string;
  };

  datosEnvio?: {
    pesoBrutoTotal: number;
    unidadMedidaPeso: 'KGM';
    modalidadTraslado: '01' | '02';
    fechaInicioTraslado: string;
    placaVehiculo: string;
    conductorDni: string;
    conductorNombre: string;
  };

  conductor?: {
    tipoDoc: TipoDocumentoIdentidad;
    numDoc: string;
    nombre: string;
    licenciaConducir?: string;
  };

  vehiculo?: {
    placa: string;
  };

  items?: GuiaRemisionItem[];
  estadoSunat: 'ACEPTADO' | 'PENDIENTE' | 'RECHAZADO';
  hashGre?: string;
}
