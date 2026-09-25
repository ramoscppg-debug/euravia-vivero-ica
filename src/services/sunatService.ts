import { ComprobanteSunat, GuiaRemisionSunat, ItemComprobanteSunat, TipoDocumentoIdentidad } from '../types/sunat';

export const EMISOR_AUREVIA = {
  ruc: '20609876541',
  razonSocial: 'AUREVIA BOTANICAL S.A.C.',
  nombreComercial: 'AUREVIA - Plantas • Jardines • Vida Natural',
  direccion: 'Av. Primavera 1280, Chacarilla',
  ubigeo: '150140', // Surco, Lima, Lima
  distrito: 'Santiago de Surco',
  provincia: 'Lima',
  departamento: 'Lima'
};

export const SunatBillingService = {
  // Calcular IGV 18% y base imponible
  calculateTaxes(priceWithIgv: number, quantity: number) {
    const total = priceWithIgv * quantity;
    const baseValue = total / 1.18;
    const igv = total - baseValue;
    const unitBaseValue = priceWithIgv / 1.18;

    return {
      total: Number(total.toFixed(2)),
      subtotal: Number(baseValue.toFixed(2)),
      igv: Number(igv.toFixed(2)),
      unitBaseValue: Number(unitBaseValue.toFixed(2))
    };
  },

  // Generar Boleta o Factura Electrónica SUNAT
  createInvoice(params: {
    tipoComprobante: '01' | '03' | 'NV'; // 01 Factura, 03 Boleta
    serie: string; // 'F001' o 'B001'
    correlativo: number;
    cliente: {
      tipoDoc: TipoDocumentoIdentidad;
      numDoc: string;
      nombre: string;
      direccion?: string;
    };
    items: {
      sku: string;
      name: string;
      quantity: number;
      priceWithIgv: number;
    }[];
  }): ComprobanteSunat {
    let opGravadas = 0;
    let totalIgv = 0;
    let montoTotal = 0;

    const formattedItems: ItemComprobanteSunat[] = params.items.map((it, idx) => {
      const calc = this.calculateTaxes(it.priceWithIgv, it.quantity);
      opGravadas += calc.subtotal;
      totalIgv += calc.igv;
      montoTotal += calc.total;

      return {
        item: idx + 1,
        sku: it.sku,
        codigoSunat: '10161500', // Plantas vivas
        unidadMedida: 'NIU',
        descripcion: it.name,
        cantidad: it.quantity,
        valorUnitario: calc.unitBaseValue,
        precioUnitario: it.priceWithIgv,
        subtotal: calc.subtotal,
        igv: calc.igv,
        total: calc.total,
        tipoAfectacion: '10' // Gravado IGV
      };
    });

    const docId = `${params.serie}-${String(params.correlativo).padStart(8, '0')}`;
    const hash = `h8b+${Math.random().toString(36).substring(2, 8).toUpperCase()}=`;

    return {
      id: docId,
      tipoComprobante: params.tipoComprobante,
      serie: params.serie,
      correlativo: params.correlativo,
      fechaEmision: new Date().toISOString().split('T')[0],
      horaEmision: new Date().toTimeString().split(' ')[0],
      moneda: 'PEN',
      emisor: EMISOR_AUREVIA,
      cliente: {
        tipoDoc: params.cliente.tipoDoc,
        numDoc: params.cliente.numDoc,
        nombreRazonSocial: params.cliente.nombre,
        direccion: params.cliente.direccion
      },
      opGravadas: Number(opGravadas.toFixed(2)),
      opExoneradas: 0,
      opInafectas: 0,
      totalIgv: Number(totalIgv.toFixed(2)),
      montoTotal: Number(montoTotal.toFixed(2)),
      items: formattedItems,
      estadoSunat: 'ACEPTADO',
      codigoRespuestaSunat: '0',
      descripcionRespuestaSunat: 'El comprobante ha sido ACEPTADO por SUNAT (CDR 0000)',
      hashCpe: hash,
      qrUrl: `https://sunat.gob.pe/cpe-validador?ruc=${EMISOR_AUREVIA.ruc}&tipo=${params.tipoComprobante}&serie=${params.serie}&num=${params.correlativo}&total=${montoTotal.toFixed(2)}`
    };
  },

  // Generar Guía de Remisión Remitente (GRE)
  createGre(params: {
    correlativo: number;
    documentoRef: string;
    destinatario: {
      tipoDoc: TipoDocumentoIdentidad;
      numDoc: string;
      nombre: string;
    };
    puntoLlegada: {
      ubigeo: string;
      direccion: string;
    };
    choferNombre: string;
    choferDni: string;
    licencia: string;
    placaVehiculo: string;
    pesoKg: number;
  }): GuiaRemisionSunat {
    return {
      id: `T001-${String(params.correlativo).padStart(8, '0')}`,
      serie: 'T001',
      correlativo: params.correlativo,
      emisor: EMISOR_AUREVIA,
      fechaEmision: new Date().toISOString().split('T')[0],
      fechaTraslado: new Date().toISOString().split('T')[0],
      motivoTraslado: '01', // Venta
      modalidadTransporte: '02', // Privado
      pesoBrutoTotal: params.pesoKg,
      unidadPeso: 'KGM',
      numBultos: 2,
      puntoPartida: {
        ubigeo: EMISOR_AUREVIA.ubigeo,
        direccion: EMISOR_AUREVIA.direccion
      },
      puntoLlegada: {
        ubigeo: params.puntoLlegada.ubigeo,
        direccion: params.puntoLlegada.direccion
      },
      destinatario: params.destinatario,
      conductor: {
        tipoDoc: '1',
        numDoc: params.choferDni,
        nombre: params.choferNombre,
        licenciaConducir: params.licencia
      },
      vehiculo: {
        placa: params.placaVehiculo
      },
      estadoSunat: 'ACEPTADO',
      documentoReferencia: params.documentoRef,
      hashGre: `gre+${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    };
  }
};
