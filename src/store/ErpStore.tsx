// ==========================================
// STORE CENTRAL DEL ERP
// Un solo lugar donde vive el estado del negocio y donde cada evento
// (venta, compra, baja, servicio) actualiza stock, Kardex, comprobantes y caja a la vez.
//
// Modo demo: datos semilla guardados en el navegador.
// Modo nube: Supabase es la fuente de verdad; cada acción escribe primero en la base
// y el stock queda con el saldo que devuelve el servidor.
// ==========================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  INITIAL_CASH_REGISTER,
  INITIAL_COMPANY_CONFIG,
  INITIAL_CRM_CLIENTS,
  INITIAL_DETRACCIONES,
  INITIAL_EMPLOYEES,
  INITIAL_GUIAS,
  INITIAL_INTERNAL_CONSUMPTIONS,
  INITIAL_INVOICES,
  INITIAL_KARDEX,
  INITIAL_LOSSES,
  INITIAL_PRODUCTS,
  INITIAL_PROJECTS,
  INITIAL_PURCHASES,
  INITIAL_PEDIDOS,
  INITIAL_NOTAS,
  INITIAL_TAREAS,
  INITIAL_COTIZACIONES,
  INITIAL_CUPONES,
  INITIAL_CONTRATOS,
  INITIAL_PUNTOS
} from '../data/seed';
import type {
  BiologicalLoss,
  CashRegisterState,
  CatalogProduct,
  ComprobanteSunat,
  CrmClient,
  DetraccionRecord,
  EmpresaConfig,
  DescuentoGlobal,
  GardeningMaterialItem,
  GardeningProject,
  GuiaRemisionSunat,
  InternalConsumption,
  KardexMovement,
  LineaCarrito,
  MedioPago,
  MovementType,
  Pago,
  Pedido,
  PedidoItem,
  NotaCliente,
  Tarea,
  Contrato,
  Cotizacion,
  Cupon,
  CanalVenta,
  EstadoPedido,
  ProjectStatus,
  Purchase,
  RegimenTributario,
  TrabajadorAurevia
} from '../domain/types';
import { emisorDe } from '../domain/types';
import { calcularDetraccion, round2, validarDni, validarRuc, vencimientoDetraccion } from '../lib/peru';
import { csvAClientes } from '../lib/crm';
import { descuentoCupon, puntosPorCompra, VALOR_PUNTO } from '../lib/fidelidad';
import { calcularCarrito, resumirPagos } from '../lib/pos';
import * as repo from '../lib/repo';
import { SunatBillingService } from '../services/sunatService';
import { sunatClient } from '../lib/sunatClient';
import { hoyLocal } from '../lib/fechas';

export interface ErpState {
  company: EmpresaConfig;
  products: CatalogProduct[];
  employees: TrabajadorAurevia[];
  projects: GardeningProject[];
  detracciones: DetraccionRecord[];
  crmClients: CrmClient[];
  losses: BiologicalLoss[];
  consumptions: InternalConsumption[];
  cashRegister: CashRegisterState;
  regimenTributario: RegimenTributario;
  invoices: ComprobanteSunat[];
  guiasRemision: GuiaRemisionSunat[];
  purchases: Purchase[];
  kardex: KardexMovement[];
  pedidos: Pedido[];
  notasClientes: NotaCliente[];
  tareas: Tarea[];
  cotizaciones: Cotizacion[];
  cupones: Cupon[];
  contratos: Contrato[];
  puntosSaldo: Record<string, number>; // saldo de puntos por DNI/RUC
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface VentaInput {
  lineas: LineaCarrito[];
  descuentoGlobal: DescuentoGlobal;
  tipoComprobante: '01' | '03';
  docIdentidad: string;
  clientName: string;
  pagos: Pago[];
  generarGre: boolean;
  direccionEntrega?: string;
  cupon?: string;
  puntosCanjear?: number;
  cotizacionId?: string;
}

export interface DevolucionInput {
  invoiceId: string;
  items: { sku: string; qty: number }[];
  motivo: string;
  medioReembolso: MedioPago;
}

export type FichaClienteInput = Pick<CrmClient, 'name' | 'phone' | 'district' | 'plantsOwned' | 'seasonalAlert' | 'recommendedAction' | 'urgency'> &
  Partial<Pick<CrmClient, 'doc' | 'email' | 'address' | 'canal'>>;

export interface PedidoInput {
  canal: CanalVenta;
  cliente: { nombre: string; telefono: string; doc?: string };
  direccion: string;
  distrito: string;
  referencia?: string;
  fechaEntrega: string;
  franja?: string;
  items: PedidoItem[];
  costoDelivery: number;
  notas?: string;
}

export interface CobroPedidoInput {
  pedidoId: string;
  tipoComprobante: '01' | '03';
  docIdentidad: string;
  clientName: string;
  pagos: Pago[];
  generarGre: boolean;
}

interface VentaCore {
  lineas: { sku: string; name: string; qty: number; precioUnitNeto: number; esProducto: boolean }[];
  total: number;
  descuentoTotal: number;
  tipoComprobante: '01' | '03';
  docIdentidad: string;
  clientName: string;
  pagos: Pago[];
  generarGre: boolean;
  direccionEntrega?: string;
  pedidoId?: string;
  canal?: string;
  cupon?: { codigo: string; base: number; descuento: number };
  puntosCanjear?: number;
  cotizacionId?: string;
}

export interface CotizacionInput {
  cliente: { nombre: string; doc?: string; telefono?: string };
  lineas: LineaCarrito[];
  descuentoGlobal: DescuentoGlobal;
  diasVigencia: number;
  notas?: string;
}

export type ContratoInput = Omit<Contrato, 'id' | 'activo' | 'ultimoPeriodo'>;

interface MovimientoCaja {
  tipo: 'INGRESO' | 'EGRESO';
  medioPago: string;
  monto: number;
  concepto: string;
}

export interface CompraInput {
  ruc: string;
  proveedor: string;
  numeroFactura: string;
  sku: string;
  qty: number;
  costoUnitario: number;
}

export interface BajaInput {
  sku: string;
  type: BiologicalLoss['type'];
  qty: number;
  reason: string;
}

export interface GreInput {
  destinatario: string;
  docDestinatario: string;
  placa: string;
  direccionLlegada: string;
  sku: string;
  qty: number;
}

export interface ProyectoInput {
  client: string;
  doc: string;
  phone: string;
  address: string;
  type: GardeningProject['type'];
  materials: GardeningMaterialItem[];
  laborHours: number;
  laborRatePerHour: number;
}

const STORAGE_KEY = 'aurevia.erp.v1';
const PROJECT_FLOW: ProjectStatus[] = ['COTIZADO', 'APROBADO', 'EN_EJECUCION', 'CONCLUIDO'];

const today = () => hoyLocal();
/** Id corto y único entre cajas: prefijo-año-sufijo base36 del reloj. */
const nuevoId = (prefijo: string) => `${prefijo}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

function seedState(): ErpState {
  return {
    company: INITIAL_COMPANY_CONFIG,
    products: INITIAL_PRODUCTS,
    employees: INITIAL_EMPLOYEES,
    projects: INITIAL_PROJECTS,
    detracciones: INITIAL_DETRACCIONES,
    crmClients: INITIAL_CRM_CLIENTS,
    losses: INITIAL_LOSSES,
    consumptions: INITIAL_INTERNAL_CONSUMPTIONS,
    cashRegister: INITIAL_CASH_REGISTER,
    regimenTributario: 'RMT',
    invoices: INITIAL_INVOICES,
    guiasRemision: INITIAL_GUIAS,
    purchases: INITIAL_PURCHASES,
    kardex: INITIAL_KARDEX,
    pedidos: INITIAL_PEDIDOS,
    notasClientes: INITIAL_NOTAS,
    tareas: INITIAL_TAREAS,
    cotizaciones: INITIAL_COTIZACIONES,
    cupones: INITIAL_CUPONES,
    contratos: INITIAL_CONTRATOS,
    puntosSaldo: INITIAL_PUNTOS
  };
}

/** Estado mientras llegan los datos de Supabase: nada de datos demo mezclados con los reales. */
function nubeVacia(): ErpState {
  return {
    ...seedState(),
    products: [],
    projects: [],
    detracciones: [],
    crmClients: [],
    losses: [],
    consumptions: [],
    cashRegister: { aperturaEfectivo: 0, ventasEfectivo: 0, ventasBilleteras: 0, ventasTarjetas: 0, ventasTransferencias: 0, egresos: [], conteoRealEfectivo: 0, estadoCaja: 'ABIERTA' },
    invoices: [],
    guiasRemision: [],
    purchases: [],
    kardex: [],
    pedidos: [],
    notasClientes: [],
    tareas: [],
    cotizaciones: [],
    cupones: [],
    contratos: [],
    puntosSaldo: {}
  };
}

// La Clave SOL nunca se guarda en el navegador.
function loadState(): ErpState {
  const seed = seedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const stored = JSON.parse(raw) as Partial<ErpState>;
    return {
      ...seed,
      ...stored,
      company: { ...seed.company, ...stored.company, claveSol: seed.company.claveSol }
    };
  } catch {
    return seed;
  }
}

function saveState(state: ErpState) {
  try {
    const { claveSol: _omit, ...company } = state.company;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, company }));
  } catch {
    // almacenamiento no disponible (modo privado): la app sigue en memoria
  }
}

/** Mueve stock de un producto y deja la huella en el Kardex (modo demo). Función pura. */
function moverStock(s: ErpState, m: repo.MovimientoNuevo): ErpState {
  const prod = s.products.find(p => p.sku === m.sku);
  if (!prod) return s;
  const balance = Math.max(0, prod.stock + m.qtyIn - m.qtyOut);
  const movement: KardexMovement = {
    id: `KDX-${String(s.kardex.length + 1).padStart(5, '0')}`,
    date: today(),
    productSku: m.sku,
    productName: prod.name,
    movementType: m.type,
    quantityIn: m.qtyIn,
    quantityOut: prod.stock + m.qtyIn - balance,
    balance,
    unitCost: m.unitCost,
    referenceDoc: m.doc,
    responsibleUser: m.user
  };
  return {
    ...s,
    products: s.products.map(p => (p.sku === m.sku ? { ...p, stock: balance } : p)),
    kardex: [movement, ...s.kardex]
  };
}

const nuevoIdPedido = () => `PED-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

/** Unidades comprometidas en pedidos que aún no se cobran (el stock recién baja al cobrar). */
export function reservadoEnPedidos(pedidos: Pedido[]): Map<string, number> {
  const r = new Map<string, number>();
  pedidos.filter(p => p.estado === 'pendiente').forEach(p => p.items.forEach(it => r.set(it.sku, (r.get(it.sku) ?? 0) + it.qty)));
  return r;
}

/**
 * Descuento manual + cupón + canje de puntos sobre el carrito.
 * El cupón se calcula sobre el total ya con descuentos manuales (misma base que valida el servidor).
 */
export function aplicarPromociones(lineas: LineaCarrito[], manual: DescuentoGlobal, cupon: string | undefined, puntos: number, s: Pick<ErpState, 'products' | 'cupones'>):
  Result<{ carrito: ReturnType<typeof calcularCarrito>; cupon?: { codigo: string; base: number; descuento: number }; descuentoPuntos: number }> {
  const conManual = calcularCarrito(lineas, s.products, manual);
  const base = conManual.total;
  let cup: { codigo: string; base: number; descuento: number } | undefined;
  if (cupon?.trim()) {
    const codigo = cupon.trim().toUpperCase();
    const r = descuentoCupon(s.cupones.find(c => c.codigo === codigo), base);
    if (r.error) return { ok: false, error: r.error };
    cup = { codigo, base, descuento: r.descuento };
  }
  const restante = round2(base - (cup?.descuento ?? 0));
  const descuentoPuntos = round2(Math.max(0, Math.floor(puntos)) * VALOR_PUNTO);
  if (descuentoPuntos > restante) return { ok: false, error: `Los puntos (S/ ${descuentoPuntos.toFixed(2)}) superan el total a pagar.` };
  const extra = (cup?.descuento ?? 0) + descuentoPuntos;
  const carrito = extra > 0
    ? calcularCarrito(lineas, s.products, { tipo: 'MONTO', valor: round2(conManual.descuentoGlobal + extra) })
    : conManual;
  return { ok: true, carrito, cupon: cup, descuentoPuntos };
}

/** Refleja cobros y reembolsos en la caja del día. */
function aplicarCaja(caja: CashRegisterState, movs: MovimientoCaja[], responsable: string): CashRegisterState {
  const c = { ...caja, egresos: [...caja.egresos] };
  for (const m of movs) {
    const signo = m.tipo === 'INGRESO' ? 1 : -1;
    if (m.medioPago === 'Efectivo') {
      c.conteoRealEfectivo = round2(c.conteoRealEfectivo + signo * m.monto);
      if (m.tipo === 'INGRESO') c.ventasEfectivo = round2(c.ventasEfectivo + m.monto);
      else c.egresos.push({ id: `EG-${String(c.egresos.length + 1).padStart(2, '0')}`, motivo: m.concepto, monto: m.monto, hora: new Date().toTimeString().slice(0, 5), responsable });
    } else if (m.medioPago === 'Yape' || m.medioPago === 'Plin') c.ventasBilleteras = round2(c.ventasBilleteras + signo * m.monto);
    else if (m.medioPago === 'Tarjeta') c.ventasTarjetas = round2(c.ventasTarjetas + signo * m.monto);
    else c.ventasTransferencias = round2(c.ventasTransferencias + signo * m.monto);
  }
  return c;
}

/** Traduce los errores de Supabase a algo que entienda quien está en caja. */
function errorNube(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('stock_actual_check')) return '⚠️ Stock insuficiente: otra venta o servicio acaba de usar esas unidades. Actualiza la pantalla.';
  if (msg.includes('row-level security')) return '⛔ Tu rol no tiene permiso para esta operación.';
  if (msg.includes('duplicate key')) return '⚠️ Ese número de documento ya está registrado.';
  if (msg.includes('Failed to fetch')) return '📡 Sin conexión con el servidor. Revisa tu internet y vuelve a intentar.';
  return `No se pudo guardar en la nube: ${msg}`;
}

/** Emite el CPE en SUNAT y sella la CDR de respuesta. */
async function emitirCpe(
  company: EmpresaConfig,
  tipo: '01' | '03' | '07' | 'NV',
  serie: string,
  correlativo: number,
  cliente: { numDoc: string; nombre: string; direccion: string },
  items: { sku: string; name: string; quantity: number; priceWithIgv: number }[]
): Promise<ComprobanteSunat> {
  const inv = SunatBillingService.createInvoice({
    tipoComprobante: tipo,
    serie,
    correlativo,
    cliente: { tipoDoc: tipo === '01' ? '6' : validarDni(cliente.numDoc) ? '1' : '0', numDoc: cliente.numDoc, nombre: cliente.nombre, direccion: cliente.direccion },
    items
  });
  inv.emisor = emisorDe(company);
  const cdr = await sunatClient.sendCpeToSunat(inv);
  inv.estadoSunat = cdr.estado;
  inv.codigoRespuestaSunat = cdr.cdrCode;
  inv.descripcionRespuestaSunat = cdr.cdrMessage;
  inv.hashCpe = cdr.hash;
  return inv;
}

async function emitirGre(
  company: EmpresaConfig,
  guias: GuiaRemisionSunat[],
  data: { tipoDoc: '1' | '6'; numDoc: string; nombre: string; direccionLlegada: string; placa: string; motivo: string; items: { sku: string; descripcion: string; cantidad: number }[] }
): Promise<GuiaRemisionSunat> {
  const correlativo = Math.max(0, ...guias.filter(g => g.serie === company.serieGre).map(g => g.correlativo)) + 1;
  const gre: GuiaRemisionSunat = {
    id: `${company.serieGre}-${String(correlativo).padStart(8, '0')}`,
    serie: company.serieGre,
    correlativo,
    fechaEmision: today(),
    motivoTraslado: '01',
    descripcionMotivo: data.motivo,
    emisor: emisorDe(company),
    destinatario: { tipoDoc: data.tipoDoc, numDoc: data.numDoc, nombreRazonSocial: data.nombre },
    puntoPartida: { ubigeo: company.ubigeo, direccion: `Vivero ${company.nombreComercial}, ${company.direccion}` },
    puntoLlegada: { ubigeo: '150122', direccion: data.direccionLlegada },
    datosEnvio: {
      pesoBrutoTotal: data.items.reduce((a, it) => a + it.cantidad, 0) * 4.5,
      unidadMedidaPeso: 'KGM',
      modalidadTraslado: '02',
      fechaInicioTraslado: today(),
      placaVehiculo: data.placa,
      conductorDni: '71234567',
      conductorNombre: 'Raúl Morales Alva'
    },
    items: data.items.map((it, i) => ({ item: i + 1, sku: it.sku, descripcion: it.descripcion, cantidad: it.cantidad, unidadMedida: 'NIU' })),
    estadoSunat: 'ACEPTADO',
    hashGre: 'R1JFLUF1cmV2aWEtQVBJ'
  };
  const resp = await sunatClient.sendGreToSunat(gre);
  gre.estadoSunat = resp.estado;
  gre.hashGre = resp.ticketGre;
  return gre;
}

function useErpActions(get: () => ErpState, commit: (next: ErpState) => void, nube: boolean, usuario: string) {
  return useMemo(() => {
    const responsable = (etiquetaDemo: string) => (nube ? usuario : etiquetaDemo);

    /** Aplica movimientos de stock: en la nube los confirma el servidor, en demo se calculan aquí. */
    async function moverInventario(movs: repo.MovimientoNuevo[]): Promise<ErpState> {
      if (!nube) return movs.reduce(moverStock, get());
      const nombres = new Map(get().products.map(p => [p.sku, p.name]));
      const filas = await repo.insertarKardex(movs, nombres);
      const saldos = new Map<string, number>();
      filas.forEach(f => { if (!saldos.has(f.productSku)) saldos.set(f.productSku, f.balance); }); // filas: más reciente primero
      const cur = get();
      return {
        ...cur,
        products: cur.products.map(p => (saldos.has(p.sku) ? { ...p, stock: saldos.get(p.sku)! } : p)),
        kardex: [...filas, ...cur.kardex]
      };
    }

    /** Guarda un comprobante con su stock, caja, guía y cliente. En la nube es una sola transacción. */
    async function persistirComprobante(c: repo.ComprobanteAtomico): Promise<ErpState> {
      if (!nube) return c.movimientos.reduce(moverStock, get());
      const nombres = new Map(get().products.map(p => [p.sku, p.name]));
      const filas = await repo.registrarComprobanteAtomico(c, nombres);
      const saldos = new Map<string, number>();
      filas.forEach(f => { if (!saldos.has(f.productSku)) saldos.set(f.productSku, f.balance); });
      const cur = get();
      return {
        ...cur,
        products: cur.products.map(p => (saldos.has(p.sku) ? { ...p, stock: saldos.get(p.sku)! } : p)),
        kardex: [...filas, ...cur.kardex]
      };
    }

    async function correlativo(serie: string): Promise<number> {
      if (nube) return repo.siguienteCorrelativo(serie);
      return get().invoices.filter(i => i.serie === serie).length + 101;
    }

    /** La ficha del cliente se crea sola al vender o cotizar (sólo con DNI/RUC válido). */
    function registrarClienteEnNube(c: { nombre: string; numDoc: string; telefono?: string; direccion?: string }) {
      if (!nube) return;
      const tipoDoc = validarRuc(c.numDoc) ? '6' : validarDni(c.numDoc) ? '1' : null;
      if (!tipoDoc) return;
      void repo.guardarCliente({ ...c, tipoDoc }).catch(() => {});
    }

    /**
     * Corazón de toda venta (POS o cobro de pedido): valida stock, documento y pagos,
     * emite el CPE y lo guarda con Kardex, caja, guía y cliente. No hace commit: devuelve el estado nuevo.
     */
    async function venderYGuardar(v: VentaCore): Promise<Result<{ invoice: ComprobanteSunat; vuelto: number; next: ErpState; guia: GuiaRemisionSunat | null }>> {
      const s = get();
      const productos = v.lineas.filter(l => l.esProducto);

      // Stock por producto (un mismo SKU puede estar en varias líneas)
      const pedido = new Map<string, number>();
      productos.forEach(l => pedido.set(l.sku, (pedido.get(l.sku) ?? 0) + l.qty));
      for (const [sku, qty] of pedido) {
        const prod = s.products.find(p => p.sku === sku);
        if (!prod) return { ok: false, error: `Producto ${sku} no encontrado.` };
        if (prod.stock < qty) return { ok: false, error: `¡Stock insuficiente! Disponible: ${prod.stock} unidades de ${prod.name}` };
      }
      // Validación del documento del adquirente según tipo de comprobante (SUNAT)
      if (v.tipoComprobante === '01' && !validarRuc(v.docIdentidad)) {
        return { ok: false, error: '⚠️ La Factura Electrónica requiere un RUC válido de 11 dígitos (módulo 11). Verifique el documento del cliente.' };
      }
      if (v.tipoComprobante === '03' && v.total > 700 && !validarDni(v.docIdentidad)) {
        return { ok: false, error: '⚠️ En Boletas por importes mayores a S/ 700 es obligatorio identificar al cliente con DNI (8 dígitos).' };
      }
      const pagos = resumirPagos(v.total, v.pagos);
      if (pagos.error) return { ok: false, error: pagos.error };
      const canje = Math.max(0, Math.floor(v.puntosCanjear ?? 0));
      if (canje > 0) {
        if (!validarDni(v.docIdentidad) && !validarRuc(v.docIdentidad)) return { ok: false, error: 'Para canjear puntos el cliente debe identificarse con DNI o RUC.' };
        const saldo = s.puntosSaldo[v.docIdentidad] ?? 0;
        if (canje > saldo) return { ok: false, error: `El cliente sólo tiene ${saldo} puntos.` };
      }

      const serie = v.tipoComprobante === '01' ? s.company.serieFactura : s.company.serieBoleta;
      const emitir = async () => {
        const invoice = await emitirCpe(
          s.company,
          v.tipoComprobante,
          serie,
          await correlativo(serie),
          { numDoc: v.docIdentidad, nombre: v.clientName, direccion: v.direccionEntrega || 'Lima, Perú' },
          v.lineas.map(l => ({ sku: l.sku, name: l.name, quantity: l.qty, priceWithIgv: l.precioUnitNeto }))
        );
        invoice.descuentoTotal = v.descuentoTotal;
        invoice.pagos = pagos.ingresos;
        invoice.vendedor = responsable('Caja Principal');
        invoice.canal = v.canal ?? 'Directo / Vivero';
        invoice.cupon = v.cupon?.codigo;
        invoice.puntosCanjeados = canje;
        invoice.puntosGanados = puntosPorCompra(invoice.montoTotal, v.docIdentidad);
        invoice.cotizacionId = v.cotizacionId;
        return invoice;
      };

      try {
        let invoice = await emitir();
        const guia = v.generarGre && productos.length
          ? await emitirGre(s.company, s.guiasRemision, {
              tipoDoc: v.tipoComprobante === '01' ? '6' : '1',
              numDoc: v.docIdentidad,
              nombre: v.clientName,
              direccionLlegada: v.direccionEntrega || 'Dirección de Entrega Lima',
              placa: 'BZF-412',
              motivo: `Despacho Venta ${invoice.id}`,
              items: productos.map(l => ({ sku: l.sku, descripcion: l.name, cantidad: l.qty }))
            })
          : null;

        const movimientos = (id: string): repo.MovimientoNuevo[] =>
          [...pedido].map(([sku, qty]) => ({
            sku, qtyIn: 0, qtyOut: qty, type: 'Venta Cliente', doc: id, user: responsable('POS Aurevia'),
            unitCost: s.products.find(p => p.sku === sku)!.cost
          }));
        const caja = (id: string): MovimientoCaja[] =>
          pagos.ingresos.map(p => ({ tipo: 'INGRESO', medioPago: p.medio, monto: p.monto, concepto: `Venta ${id}` }));
        const tipoDoc = validarRuc(v.docIdentidad) ? '6' : validarDni(v.docIdentidad) ? '1' : null;

        // Si otra caja tomó el mismo correlativo, se vuelve a numerar una vez
        let next: ErpState | null = null;
        for (let intento = 0; !next; intento++) {
          try {
            next = await persistirComprobante({
              invoice,
              medioPago: pagos.ingresos.map(p => p.medio).join(' + '),
              movimientos: movimientos(invoice.id),
              caja: caja(invoice.id),
              guia,
              cliente: tipoDoc ? { nombre: v.clientName, tipoDoc, numDoc: v.docIdentidad } : null,
              responsable: usuario,
              pedidoId: v.pedidoId,
              cupon: v.cupon
            });
          } catch (e) {
            if (intento === 0 && nube && String(e instanceof Error ? e.message : e).includes('duplicate key')) invoice = await emitir();
            else throw e;
          }
        }

        return {
          ok: true,
          invoice,
          vuelto: pagos.vuelto,
          guia,
          next: {
            ...next,
            cashRegister: aplicarCaja(next.cashRegister, caja(invoice.id), responsable('POS Aurevia')),
            invoices: [invoice, ...next.invoices],
            guiasRemision: guia ? [guia, ...next.guiasRemision] : next.guiasRemision,
            cupones: v.cupon ? next.cupones.map(c => (c.codigo === v.cupon!.codigo ? { ...c, usos: c.usos + 1 } : c)) : next.cupones,
            cotizaciones: v.cotizacionId
              ? next.cotizaciones.map(c => (c.id === v.cotizacionId ? { ...c, estado: 'CONVERTIDA', comprobanteId: invoice.id } : c))
              : next.cotizaciones,
            puntosSaldo: invoice.puntosGanados || canje
              ? { ...next.puntosSaldo, [v.docIdentidad]: (next.puntosSaldo[v.docIdentidad] ?? 0) + (invoice.puntosGanados ?? 0) - canje }
              : next.puntosSaldo
          }
        };
      } catch (e) {
        return { ok: false, error: errorNube(e) };
      }
    }

    /** Cantidades ya devueltas de un comprobante (sumando sus notas de crédito). */
    function devueltoDe(invoiceId: string): Map<string, number> {
      const dev = new Map<string, number>();
      get().invoices
        .filter(i => i.tipoComprobante === '07' && i.referencia === invoiceId)
        .forEach(n => n.items.forEach(it => dev.set(it.sku, (dev.get(it.sku) ?? 0) + it.cantidad)));
      return dev;
    }

    return {
      async recargar(): Promise<Result> {
        if (!nube) return { ok: true };
        try {
          const datos = await repo.cargarTodo();
          commit({ ...get(), ...datos });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- VENDER ----------------
      async registrarVenta(v: VentaInput): Promise<Result<{ invoice: ComprobanteSunat; vuelto: number }>> {
        const s = get();
        const r1 = aplicarPromociones(v.lineas, v.descuentoGlobal, v.cupon, v.puntosCanjear ?? 0, s);
        if (!r1.ok) return r1;
        const carrito = r1.carrito;
        if (!carrito.lineas.length) return { ok: false, error: 'Agrega al menos un producto al carrito.' };
        const r = await venderYGuardar({
          lineas: carrito.lineas.map(l => ({ sku: l.sku, name: l.name, qty: l.qty, precioUnitNeto: l.precioUnitNeto, esProducto: true })),
          total: carrito.total,
          descuentoTotal: carrito.descuentoTotal,
          tipoComprobante: v.tipoComprobante,
          docIdentidad: v.docIdentidad,
          clientName: v.clientName,
          pagos: v.pagos,
          generarGre: v.generarGre,
          direccionEntrega: v.direccionEntrega,
          cupon: r1.cupon,
          puntosCanjear: v.puntosCanjear,
          cotizacionId: v.cotizacionId
        });
        if (!r.ok) return r;
        commit(r.next);
        return { ok: true, invoice: r.invoice, vuelto: r.vuelto };
      },

      // ---------------- COTIZACIONES, CUPONES Y CONTRATOS ----------------
      async crearCotizacion(c: CotizacionInput): Promise<Result<{ cotizacion: Cotizacion }>> {
        if (!c.cliente.nombre.trim()) return { ok: false, error: 'Indica el nombre del cliente.' };
        const s = get();
        const carrito = calcularCarrito(c.lineas, s.products, c.descuentoGlobal);
        if (!carrito.lineas.length) return { ok: false, error: 'Agrega al menos un producto a la cotización.' };
        const hoy = today();
        const cot: Cotizacion = {
          id: nuevoId('COT'),
          fecha: hoy,
          vence: new Date(Date.parse(hoy) + Math.max(1, c.diasVigencia) * 86_400_000).toISOString().slice(0, 10),
          cliente: { nombre: c.cliente.nombre.trim(), doc: c.cliente.doc?.trim() || undefined, telefono: c.cliente.telefono?.trim() || undefined },
          lineas: c.lineas.filter(l => l.qty > 0),
          descuentoGlobal: c.descuentoGlobal,
          total: carrito.total,
          estado: 'ENVIADA',
          notas: c.notas?.trim() || undefined,
          creadoPor: responsable('Caja Principal')
        };
        try {
          if (nube) await repo.guardarCotizacion(cot);
          const cur = get();
          commit({ ...cur, cotizaciones: [cot, ...cur.cotizaciones] });
          return { ok: true, cotizacion: cot };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async marcarCotizacion(id: string, estado: 'ACEPTADA' | 'RECHAZADA'): Promise<Result> {
        const cot = get().cotizaciones.find(c => c.id === id);
        if (!cot || cot.estado === 'CONVERTIDA') return { ok: false, error: 'Esa cotización ya fue convertida en venta.' };
        try {
          if (nube) await repo.marcarCotizacion(id, estado);
          const s = get();
          commit({ ...s, cotizaciones: s.cotizaciones.map(c => (c.id === id ? { ...c, estado } : c)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async crearCupon(c: Omit<Cupon, 'usos' | 'activo'>): Promise<Result> {
        const codigo = c.codigo.trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) return { ok: false, error: 'El código debe tener de 3 a 30 letras, números, guion o guion bajo (sin espacios).' };
        if (!(c.valor > 0) || (c.tipo === 'PCT' && c.valor > 100)) return { ok: false, error: 'El valor del cupón no es válido.' };
        if (get().cupones.some(x => x.codigo === codigo)) return { ok: false, error: `Ya existe el cupón ${codigo}.` };
        const cupon: Cupon = { ...c, codigo, minimoCompra: Math.max(0, c.minimoCompra || 0), usos: 0, activo: true };
        try {
          if (nube) await repo.guardarCupon(cupon);
          const s = get();
          commit({ ...s, cupones: [cupon, ...s.cupones] });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async activarCupon(codigo: string, activo: boolean): Promise<Result> {
        try {
          if (nube) await repo.activarCupon(codigo, activo);
          const s = get();
          commit({ ...s, cupones: s.cupones.map(c => (c.codigo === codigo ? { ...c, activo } : c)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async crearContrato(c: ContratoInput): Promise<Result> {
        if (!c.cliente.nombre.trim()) return { ok: false, error: 'Indica el cliente.' };
        if (!validarDni(c.cliente.doc) && !validarRuc(c.cliente.doc)) return { ok: false, error: 'El contrato necesita un DNI o RUC válido para facturar cada mes.' };
        if (!c.servicio.trim()) return { ok: false, error: 'Describe el servicio.' };
        if (!(c.montoMensual > 0)) return { ok: false, error: 'El monto mensual debe ser mayor a cero.' };
        if (c.diaCobro < 1 || c.diaCobro > 28) return { ok: false, error: 'El día de cobro va del 1 al 28.' };
        const contrato: Contrato = { ...c, id: nuevoId('CON'), activo: true };
        try {
          if (nube) await repo.guardarContrato(contrato, usuario);
          const s = get();
          commit({ ...s, contratos: [...s.contratos, contrato] });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async activarContrato(id: string, activo: boolean): Promise<Result> {
        try {
          if (nube) await repo.activarContrato(id, activo);
          const s = get();
          commit({ ...s, contratos: s.contratos.map(c => (c.id === id ? { ...c, activo } : c)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      /** Emite el comprobante del mes (sin caja: se cobra por transferencia) y agenda las visitas. */
      async facturarContrato(id: string): Promise<Result<{ invoice: ComprobanteSunat }>> {
        const s = get();
        const con = s.contratos.find(c => c.id === id);
        if (!con || !con.activo) return { ok: false, error: 'El contrato no existe o está inactivo.' };
        const periodo = today().slice(0, 7);
        if (con.ultimoPeriodo && con.ultimoPeriodo >= periodo) return { ok: false, error: `El contrato ya se facturó en ${periodo}.` };
        const esFactura = validarRuc(con.cliente.doc);
        const serie = esFactura ? s.company.serieFactura : s.company.serieBoleta;
        const mes = new Date(`${periodo}-01T12:00:00`).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
        try {
          const invoice = await emitirCpe(
            s.company, esFactura ? '01' : '03', serie, await correlativo(serie),
            { numDoc: con.cliente.doc, nombre: con.cliente.nombre, direccion: con.direccion ?? 'Lima, Perú' },
            [{ sku: 'SRV-MANT', name: `${con.servicio} - ${mes}`, quantity: 1, priceWithIgv: con.montoMensual }]
          );
          invoice.vendedor = responsable('Caja Principal');
          invoice.canal = 'Contrato';
          invoice.contratoId = con.id;
          invoice.puntosGanados = puntosPorCompra(invoice.montoTotal, con.cliente.doc);

          const det = calcularDetraccion(con.montoMensual, s.company.tasaDetraccionServicios);
          const fecha = today();
          const detraccion: DetraccionRecord | null = esFactura && det.aplica
            ? { id: nuevoId('DET'), facturaId: invoice.id, cliente: con.cliente.nombre, rucCliente: con.cliente.doc, fechaEmision: fecha,
                fechaVencimientoBn: vencimientoDetraccion(fecha), montoFactura: con.montoMensual, tasa: s.company.tasaDetraccionServicios,
                montoDetraccion: det.montoDetraccion, estado: 'PENDIENTE' }
            : null;

          const next = await persistirComprobante({
            invoice, medioPago: 'Por cobrar', movimientos: [], caja: [], responsable: usuario,
            cliente: { nombre: con.cliente.nombre, tipoDoc: esFactura ? '6' : '1', numDoc: con.cliente.doc }
          });
          if (nube && detraccion) await repo.guardarDetraccion(detraccion);
          const visitas: Tarea = {
            id: `TAR-${Date.now().toString(36).toUpperCase()}`,
            titulo: `${con.visitasMes} visita(s) de mantenimiento ${mes} · ${con.cliente.nombre}`,
            vence: `${periodo}-28`, asignadoA: con.jardinero, hecha: false, creadoPor: responsable('Administración')
          };
          const tarea = nube ? await repo.crearTarea(visitas).catch(() => visitas) : visitas;
          commit({
            ...next,
            invoices: [invoice, ...next.invoices],
            detracciones: detraccion ? [detraccion, ...next.detracciones] : next.detracciones,
            contratos: next.contratos.map(c => (c.id === id ? { ...c, ultimoPeriodo: periodo } : c)),
            tareas: [...next.tareas, tarea],
            puntosSaldo: invoice.puntosGanados
              ? { ...next.puntosSaldo, [con.cliente.doc]: (next.puntosSaldo[con.cliente.doc] ?? 0) + invoice.puntosGanados }
              : next.puntosSaldo
          });
          return { ok: true, invoice };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- CLIENTES (CRM) ----------------
      async guardarCliente(f: FichaClienteInput, id?: string): Promise<Result<{ cliente: CrmClient }>> {
        const name = f.name.trim();
        if (!name) return { ok: false, error: 'El nombre del cliente es obligatorio.' };
        const doc = f.doc?.trim() || undefined;
        if (doc && !validarDni(doc) && !validarRuc(doc)) return { ok: false, error: '⚠️ El documento debe ser un DNI de 8 dígitos o un RUC válido.' };
        const s = get();
        if (doc && s.crmClients.some(c => c.doc === doc && c.id !== id)) return { ok: false, error: `⚠️ Ya existe un cliente con el documento ${doc}.` };
        const datos = { ...f, name, doc, plantsOwned: f.plantsOwned.map(x => x.trim()).filter(Boolean) };
        try {
          const previo = id ? s.crmClients.find(c => c.id === id) : undefined;
          const cliente: CrmClient = nube
            ? await repo.guardarFichaCliente(datos, id)
            : { ...(previo ?? { id: `CRM-${Date.now().toString(36).toUpperCase()}`, lastPurchaseDate: '' }), ...datos } as CrmClient;
          const cur = get();
          commit({ ...cur, crmClients: id ? cur.crmClients.map(c => (c.id === id ? cliente : c)) : [...cur.crmClients, cliente] });
          return { ok: true, cliente };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async importarClientes(csv: string): Promise<Result<{ creados: number; actualizados: number }>> {
        const filas = csvAClientes(csv);
        if (!filas.length) return { ok: false, error: 'El archivo no tiene filas válidas. Debe tener una columna "nombre" (y opcionales: documento, telefono, email, direccion, distrito, canal).' };
        const invalidos = filas.filter(r => r.doc && !validarDni(r.doc) && !validarRuc(r.doc));
        if (invalidos.length) return { ok: false, error: `⚠️ Documentos inválidos en: ${invalidos.slice(0, 5).map(r => r.nombre).join(', ')}${invalidos.length > 5 ? '…' : ''}` };
        const fichas: Partial<CrmClient>[] = filas.map(r => ({
          name: r.nombre, doc: r.doc, phone: r.telefono ?? '', email: r.email, address: r.direccion, district: r.distrito ?? '', canal: r.canal
        }));
        try {
          const s = get();
          const existentes = new Set(s.crmClients.map(c => c.doc).filter(Boolean));
          const actualizados = fichas.filter(f => f.doc && existentes.has(f.doc)).length;
          let lista = s.crmClients;
          if (nube) {
            const guardados = await repo.importarClientes(fichas);
            const porId = new Map(guardados.map(c => [c.id, c]));
            lista = [...lista.map(c => porId.get(c.id) ?? c), ...guardados.filter(g => !lista.some(c => c.id === g.id))];
          } else {
            fichas.forEach((f, i) => {
              const previo = f.doc ? lista.find(c => c.doc === f.doc) : undefined;
              if (previo) lista = lista.map(c => (c.id === previo.id ? { ...c, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) } : c));
              else lista = [...lista, {
                id: `CRM-${Date.now().toString(36).toUpperCase()}-${i}`, name: f.name!, doc: f.doc, phone: f.phone ?? '', email: f.email, address: f.address,
                district: f.district ?? '', canal: f.canal, plantsOwned: [], lastPurchaseDate: '',
                seasonalAlert: '🌱 Aún sin alerta de temporada registrada.', recommendedAction: 'Registrar las plantas del cliente para personalizar sus cuidados.', urgency: 'ESTACIONAL'
              }];
            });
          }
          commit({ ...get(), crmClients: lista });
          return { ok: true, creados: fichas.length - actualizados, actualizados };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async agregarNota(clienteId: string, texto: string): Promise<Result> {
        if (!texto.trim()) return { ok: false, error: 'Escribe la nota.' };
        try {
          const nota: NotaCliente = nube
            ? await repo.agregarNota(clienteId, texto.trim(), usuario)
            : { id: `NOTA-${Date.now().toString(36).toUpperCase()}`, clienteId, texto: texto.trim(), autor: responsable('Administración'), fecha: new Date().toISOString() };
          const s = get();
          commit({ ...s, notasClientes: [nota, ...s.notasClientes] });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async crearTarea(t: { clienteId?: string; titulo: string; vence: string; asignadoA?: string }): Promise<Result> {
        if (!t.titulo.trim()) return { ok: false, error: 'Escribe qué hay que hacer.' };
        if (!t.vence) return { ok: false, error: 'Indica la fecha.' };
        const base = { clienteId: t.clienteId, titulo: t.titulo.trim(), vence: t.vence, asignadoA: t.asignadoA?.trim() || undefined, creadoPor: responsable('Administración') };
        try {
          const tarea: Tarea = nube ? await repo.crearTarea(base) : { ...base, id: `TAR-${Date.now().toString(36).toUpperCase()}`, hecha: false };
          const s = get();
          commit({ ...s, tareas: [...s.tareas, tarea] });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async marcarTarea(id: string, hecha: boolean): Promise<Result> {
        try {
          if (nube) await repo.marcarTarea(id, hecha);
          const s = get();
          commit({ ...s, tareas: s.tareas.map(t => (t.id === id ? { ...t, hecha } : t)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- PEDIDOS & DELIVERY ----------------
      async crearPedido(p: PedidoInput): Promise<Result<{ pedido: Pedido }>> {
        if (!p.cliente.nombre.trim()) return { ok: false, error: 'Indica el nombre del cliente.' };
        if (!p.cliente.telefono.trim()) return { ok: false, error: 'Indica el teléfono o WhatsApp del cliente.' };
        if (!p.direccion.trim()) return { ok: false, error: 'Indica la dirección de entrega.' };
        if (!p.fechaEntrega) return { ok: false, error: 'Indica la fecha de entrega.' };
        const s = get();
        const items = p.items.filter(it => it.qty > 0);
        if (!items.length) return { ok: false, error: 'Agrega al menos un producto al pedido.' };
        // Stock disponible = stock actual − lo comprometido en otros pedidos por cobrar
        const reservado = reservadoEnPedidos(s.pedidos);
        for (const it of items) {
          const prod = s.products.find(x => x.sku === it.sku);
          const libre = (prod?.stock ?? 0) - (reservado.get(it.sku) ?? 0);
          if (it.qty > libre) return { ok: false, error: `⚠️ Solo hay ${Math.max(0, libre)} u. libres de ${it.name} (el resto está comprometido en otros pedidos).` };
        }
        const costoDelivery = Math.max(0, p.costoDelivery || 0);
        const pedido: Pedido = {
          id: nuevoIdPedido(),
          createdAt: new Date().toISOString(),
          canal: p.canal,
          estado: 'pendiente',
          cliente: { nombre: p.cliente.nombre.trim(), telefono: p.cliente.telefono.trim(), doc: p.cliente.doc?.trim() || undefined },
          direccion: p.direccion.trim(),
          distrito: p.distrito.trim(),
          referencia: p.referencia?.trim() || undefined,
          fechaEntrega: p.fechaEntrega,
          franja: p.franja || undefined,
          items,
          costoDelivery,
          total: round2(items.reduce((a, it) => a + it.qty * it.unitPrice, 0) + costoDelivery),
          notas: p.notas?.trim() || undefined
        };
        try {
          if (nube) await repo.guardarPedidoNuevo(pedido, usuario);
          const cur = get();
          commit({ ...cur, pedidos: [pedido, ...cur.pedidos] });
          return { ok: true, pedido };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      /** Cobra el pedido: emite comprobante, descuenta stock y registra caja en una sola operación. */
      async cobrarPedido(c: CobroPedidoInput): Promise<Result<{ invoice: ComprobanteSunat; vuelto: number }>> {
        const s = get();
        const pedido = s.pedidos.find(p => p.id === c.pedidoId);
        if (!pedido) return { ok: false, error: 'Pedido no encontrado.' };
        if (pedido.estado !== 'pendiente') return { ok: false, error: `El pedido ${pedido.id} ya fue cobrado.` };
        const lineas = pedido.items.map(it => ({ sku: it.sku, name: it.name, qty: it.qty, precioUnitNeto: it.unitPrice, esProducto: true }));
        if (pedido.costoDelivery > 0) lineas.push({ sku: 'SRV-DELIVERY', name: `Servicio de delivery - ${pedido.distrito || pedido.direccion}`, qty: 1, precioUnitNeto: pedido.costoDelivery, esProducto: false });
        const r = await venderYGuardar({
          lineas,
          total: pedido.total,
          descuentoTotal: 0,
          tipoComprobante: c.tipoComprobante,
          docIdentidad: c.docIdentidad,
          clientName: c.clientName,
          pagos: c.pagos,
          generarGre: c.generarGre,
          direccionEntrega: [pedido.direccion, pedido.distrito].filter(Boolean).join(', '),
          pedidoId: pedido.id,
          canal: pedido.canal
        });
        if (!r.ok) return r;
        commit({
          ...r.next,
          pedidos: r.next.pedidos.map(p => (p.id === pedido.id
            ? { ...p, estado: 'pagado', comprobanteId: r.invoice.id, metodoPago: r.invoice.pagos?.map(x => x.medio).join(' + '), guiaId: r.guia?.id ?? p.guiaId }
            : p))
        });
        return { ok: true, invoice: r.invoice, vuelto: r.vuelto };
      },

      async moverPedido(id: string, estado: EstadoPedido, extra: { repartidor?: string } = {}): Promise<Result> {
        const pedido = get().pedidos.find(p => p.id === id);
        if (!pedido) return { ok: false, error: 'Pedido no encontrado.' };
        const permitido: Record<string, EstadoPedido[]> = {
          pendiente: ['cancelado'],
          pagado: ['preparando'],
          preparando: ['en-reparto', 'pagado'],
          'en-reparto': ['preparando']
        };
        if (!permitido[pedido.estado]?.includes(estado)) return { ok: false, error: `No se puede pasar de "${pedido.estado}" a "${estado}".` };
        if (estado === 'en-reparto' && !extra.repartidor?.trim()) return { ok: false, error: 'Indica quién lleva el pedido.' };
        try {
          if (nube) await repo.actualizarPedido(id, { estado, repartidor: extra.repartidor?.trim() });
          const s = get();
          commit({ ...s, pedidos: s.pedidos.map(p => (p.id === id ? { ...p, estado, repartidor: extra.repartidor?.trim() ?? p.repartidor } : p)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      /** Cierra la entrega; en la nube la foto va a la carpeta privada de evidencias. */
      async entregarPedido(id: string, foto?: File): Promise<Result> {
        const pedido = get().pedidos.find(p => p.id === id);
        if (!pedido || pedido.estado !== 'en-reparto') return { ok: false, error: 'Sólo se entrega un pedido que está en ruta.' };
        if (foto && foto.size > 5 * 1024 * 1024) return { ok: false, error: 'La foto pesa más de 5 MB.' };
        const entregadoAt = new Date().toISOString();
        try {
          let fotoEvidencia = foto?.name;
          if (nube) {
            if (foto) fotoEvidencia = await repo.subirEvidencia(id, foto);
            await repo.actualizarPedido(id, { estado: 'entregado', fotoEvidencia, entregadoAt });
          }
          const s = get();
          commit({ ...s, pedidos: s.pedidos.map(p => (p.id === id ? { ...p, estado: 'entregado', fotoEvidencia, entregadoAt } : p)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      devueltoDe,

      async registrarDevolucion(d: DevolucionInput): Promise<Result<{ invoice: ComprobanteSunat }>> {
        const s = get();
        const original = s.invoices.find(i => i.id === d.invoiceId);
        if (!original || (original.tipoComprobante !== '01' && original.tipoComprobante !== '03')) {
          return { ok: false, error: 'Sólo se puede devolver sobre una factura o boleta.' };
        }
        if (!d.motivo.trim()) return { ok: false, error: 'Indica el motivo de la devolución.' };
        const items = d.items.filter(i => i.qty > 0);
        if (!items.length) return { ok: false, error: 'Indica al menos una cantidad a devolver.' };

        const yaDevuelto = devueltoDe(original.id);
        for (const it of items) {
          const vendido = original.items.filter(x => x.sku === it.sku).reduce((a, x) => a + x.cantidad, 0);
          const disponible = vendido - (yaDevuelto.get(it.sku) ?? 0);
          if (it.qty > disponible) return { ok: false, error: `⚠️ Sólo quedan ${disponible} u. de ${it.sku} por devolver en ${original.id}.` };
        }

        const lineas = items.map(it => {
          const orig = original.items.find(x => x.sku === it.sku)!;
          return { sku: it.sku, name: orig.descripcion, quantity: it.qty, priceWithIgv: orig.precioUnitario };
        });
        const montoReembolso = round2(lineas.reduce((a, l) => a + l.quantity * l.priceWithIgv, 0));
        if (d.medioReembolso === 'Efectivo' && montoReembolso > s.cashRegister.conteoRealEfectivo) {
          return { ok: false, error: `⚠️ No hay suficiente efectivo en gaveta (S/ ${s.cashRegister.conteoRealEfectivo.toFixed(2)}) para reembolsar S/ ${montoReembolso.toFixed(2)}.` };
        }

        // Serie de nota de crédito: BC01 para boletas, FC01 para facturas
        const serie = `${original.serie.charAt(0)}C01`;
        try {
          const nota = await emitirCpe(
            s.company,
            '07',
            serie,
            await correlativo(serie),
            { numDoc: original.cliente.numDoc, nombre: original.cliente.nombreRazonSocial, direccion: original.cliente.direccion ?? 'Lima, Perú' },
            lineas
          );
          nota.cliente.tipoDoc = original.cliente.tipoDoc;
          nota.referencia = original.id;
          nota.motivo = d.motivo.trim();
          nota.pagos = [{ medio: d.medioReembolso, monto: nota.montoTotal }];
          nota.vendedor = responsable('Caja Principal');
          nota.canal = original.canal;
          nota.puntosGanados = -puntosPorCompra(nota.montoTotal, original.cliente.numDoc);

          const caja: MovimientoCaja[] = [{ tipo: 'EGRESO', medioPago: d.medioReembolso, monto: nota.montoTotal, concepto: `Devolución ${nota.id} (${original.id})` }];
          const next = await persistirComprobante({
            invoice: nota,
            medioPago: d.medioReembolso,
            movimientos: items.map(it => ({
              sku: it.sku, qtyIn: it.qty, qtyOut: 0, type: 'Devolucion Cliente', doc: nota.id, user: responsable('POS Aurevia'),
              unitCost: s.products.find(p => p.sku === it.sku)?.cost ?? 0
            })),
            caja,
            responsable: usuario
          });
          commit({
            ...next,
            cashRegister: aplicarCaja(next.cashRegister, caja, responsable('POS Aurevia')),
            invoices: [nota, ...next.invoices],
            puntosSaldo: nota.puntosGanados
              ? { ...next.puntosSaldo, [original.cliente.numDoc]: (next.puntosSaldo[original.cliente.numDoc] ?? 0) + nota.puntosGanados }
              : next.puntosSaldo
          });
          return { ok: true, invoice: nota };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async abrirCaja(monto: number): Promise<Result> {
        if (monto < 0) return { ok: false, error: 'El monto de apertura no puede ser negativo.' };
        try {
          if (nube) await repo.guardarCaja({ tipo: 'APERTURA', monto, medioPago: 'Efectivo', concepto: 'Apertura de caja', responsable: usuario });
          const s = get();
          commit({
            ...s,
            cashRegister: {
              ...s.cashRegister,
              aperturaEfectivo: s.cashRegister.aperturaEfectivo + monto,
              conteoRealEfectivo: s.cashRegister.conteoRealEfectivo + monto
            }
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async registrarEgreso(motivo: string, monto: number): Promise<Result> {
        if (!motivo || monto <= 0) return { ok: false, error: 'Indica el motivo y un monto mayor a cero.' };
        if (monto > get().cashRegister.conteoRealEfectivo) {
          return { ok: false, error: `⚠️ No hay suficiente efectivo en gaveta (S/ ${get().cashRegister.conteoRealEfectivo.toFixed(2)}) para ese gasto.` };
        }
        try {
          if (nube) await repo.guardarCaja({ tipo: 'EGRESO', monto, medioPago: 'Efectivo', concepto: motivo, responsable: usuario });
          const s = get();
          const caja = s.cashRegister;
          commit({
            ...s,
            cashRegister: {
              ...caja,
              egresos: [
                ...caja.egresos,
                { id: `EG-${String(caja.egresos.length + 1).padStart(2, '0')}`, motivo, monto, hora: new Date().toTimeString().slice(0, 5), responsable: responsable('Administración') }
              ],
              conteoRealEfectivo: caja.conteoRealEfectivo - monto
            }
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      setConteoCaja(conteoRealEfectivo: number) {
        const s = get();
        commit({ ...s, cashRegister: { ...s.cashRegister, conteoRealEfectivo } });
      },

      async cuadrarCaja(): Promise<Result> {
        try {
          const s = get();
          if (nube) await repo.guardarCaja({ tipo: 'CIERRE', monto: s.cashRegister.conteoRealEfectivo, medioPago: 'Efectivo', concepto: 'Arqueo / cuadre de caja', responsable: usuario });
          const cur = get();
          commit({ ...cur, cashRegister: { ...cur.cashRegister, estadoCaja: 'CUADRADA' } });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- INVENTARIO ----------------
      async registrarCompra(c: CompraInput): Promise<Result<{ igv: number; productName: string }>> {
        const s = get();
        const prod = s.products.find(p => p.sku === c.sku);
        if (!prod) return { ok: false, error: 'Producto no encontrado.' };
        // El crédito fiscal (RCE / SIRE) sólo procede con un RUC de proveedor válido
        if (!validarRuc(c.ruc)) {
          return { ok: false, error: '⚠️ El RUC del proveedor no es válido (11 dígitos, módulo 11). Sin RUC válido la compra no genera crédito fiscal en el RCE.' };
        }
        if (!(c.qty > 0) || !(c.costoUnitario > 0)) return { ok: false, error: 'La cantidad y el costo unitario deben ser mayores a cero.' };
        if (s.purchases.some(p => p.id === c.numeroFactura.trim() && p.ruc === c.ruc)) {
          return { ok: false, error: `⚠️ La factura ${c.numeroFactura} de este proveedor ya está registrada.` };
        }
        const gravada = c.qty * c.costoUnitario;
        const igv = round2(gravada * 0.18);
        const compra: Purchase = { id: c.numeroFactura, proveedor: c.proveedor, ruc: c.ruc, fecha: today(), gravada, igv, total: gravada + igv, items: `${c.qty}x ${prod.name}` };
        try {
          if (nube) await repo.guardarCompra(compra); // primero: rechaza facturas duplicadas antes de mover stock
          const next = await moverInventario([
            { sku: c.sku, qtyIn: c.qty, qtyOut: 0, type: 'Compra Proveedor', doc: c.numeroFactura, user: responsable('Almacén Aurevia'), unitCost: c.costoUnitario }
          ]);
          commit({ ...next, purchases: [compra, ...next.purchases] });
          return { ok: true, igv, productName: prod.name };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async registrarBaja(b: BajaInput): Promise<Result<{ loss: BiologicalLoss }>> {
        const s = get();
        const prod = s.products.find(p => p.sku === b.sku);
        if (!prod) return { ok: false, error: 'Producto no encontrado.' };
        if (!(b.qty > 0)) return { ok: false, error: 'La cantidad debe ser mayor a cero.' };
        if (prod.stock < b.qty) {
          return { ok: false, error: `¡No puedes dar de baja más unidades de las disponibles! Stock actual: ${prod.stock}` };
        }
        const cuarentena = b.type === 'CUARENTENA_FITOSANITARIA';
        const loss: BiologicalLoss = {
          id: nuevoId('BAJ'),
          sku: prod.sku,
          productName: prod.name,
          type: b.type,
          qty: b.qty,
          unitCost: prod.cost,
          totalLoss: b.qty * prod.cost,
          reason: b.reason,
          date: today(),
          status: cuarentena ? 'EN_OBSERVACION' : 'ACREDITADO_CONTABLE'
        };
        try {
          if (nube) await repo.guardarBaja(loss);
          // La cuarentena aísla la planta pero no la saca del inventario
          const next = cuarentena
            ? get()
            : await moverInventario([{ sku: b.sku, qtyIn: 0, qtyOut: b.qty, type: 'Baja por Perdida', doc: loss.id, user: responsable('Almacén Aurevia'), unitCost: prod.cost }]);
          commit({ ...next, losses: [loss, ...next.losses] });
          return { ok: true, loss };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async emitirGuia(g: GreInput): Promise<Result<{ gre: GuiaRemisionSunat }>> {
        const s = get();
        const prod = s.products.find(p => p.sku === g.sku);
        if (!prod) return { ok: false, error: 'Producto no encontrado.' };
        try {
          const gre = await emitirGre(s.company, s.guiasRemision, {
            tipoDoc: g.docDestinatario.length === 11 ? '6' : '1',
            numDoc: g.docDestinatario,
            nombre: g.destinatario,
            direccionLlegada: g.direccionLlegada,
            placa: g.placa,
            motivo: 'Venta y Entrega Botánica a Domicilio',
            items: [{ sku: prod.sku, descripcion: prod.name, cantidad: g.qty }]
          });
          if (nube) await repo.guardarGuia(gre);
          const cur = get();
          commit({ ...cur, guiasRemision: [gre, ...cur.guiasRemision] });
          return { ok: true, gre };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- SERVICIOS ----------------
      async crearProyecto(p: ProyectoInput): Promise<Result<{ project: GardeningProject }>> {
        if (!p.client.trim()) return { ok: false, error: 'Indica el nombre del cliente.' };
        if (!validarRuc(p.doc) && !validarDni(p.doc)) {
          return { ok: false, error: '⚠️ El documento del cliente debe ser un DNI (8 dígitos) o un RUC válido (11 dígitos).' };
        }
        const materiales = p.materials.filter(m => m.qty > 0);
        const total = round2(materiales.reduce((a, m) => a + m.qty * m.unitPrice, 0) + p.laborHours * p.laborRatePerHour);
        if (total <= 0) return { ok: false, error: 'La cotización debe tener materiales o mano de obra.' };
        const s = get();
        // La detracción sólo aplica si se factura (RUC) por más de S/ 700
        const det = calcularDetraccion(total, s.company.tasaDetraccionServicios);
        const aplica = validarRuc(p.doc) && det.aplica;
        const project: GardeningProject = {
          id: nuevoId('JAR'),
          client: p.client.trim(),
          doc: p.doc,
          phone: p.phone,
          type: p.type,
          address: p.address,
          status: 'COTIZADO',
          materials: materiales,
          laborHours: p.laborHours,
          laborRatePerHour: p.laborRatePerHour,
          total,
          date: today(),
          stockDeducted: false,
          aplicaDetraccion: aplica,
          montoDetraccion: aplica ? det.montoDetraccion : 0,
          montoNetoACobrar: aplica ? det.netoACobrar : total
        };
        try {
          if (nube) {
            await repo.guardarProyectoNuevo(project);
            registrarClienteEnNube({ nombre: project.client, numDoc: project.doc, telefono: project.phone, direccion: project.address });
          }
          const cur = get();
          commit({ ...cur, projects: [project, ...cur.projects] });
          return { ok: true, project };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async avanzarProyecto(id: string): Promise<Result> {
        const proj = get().projects.find(p => p.id === id);
        if (!proj) return { ok: false, error: 'Proyecto no encontrado.' };
        const estado = PROJECT_FLOW[Math.min(PROJECT_FLOW.indexOf(proj.status) + 1, PROJECT_FLOW.length - 1)];
        try {
          if (nube) await repo.actualizarProyecto(id, { estado });
          const s = get();
          commit({ ...s, projects: s.projects.map(p => (p.id === id ? { ...p, status: estado } : p)) });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async descargarMaterialesProyecto(id: string): Promise<Result<{ project: GardeningProject }>> {
        const s = get();
        const proj = s.projects.find(p => p.id === id);
        if (!proj || proj.stockDeducted) return { ok: false, error: 'Los insumos de este proyecto ya fueron descargados.' };
        const faltantes = proj.materials.filter(m => (s.products.find(p => p.sku === m.sku)?.stock ?? 0) < m.qty);
        if (faltantes.length) {
          return { ok: false, error: `⚠️ Stock insuficiente para: ${faltantes.map(m => `${m.name} (necesita ${m.qty})`).join(', ')}. Registra la compra antes de descargar.` };
        }
        try {
          const next = await moverInventario(
            proj.materials.map(mat => ({
              sku: mat.sku,
              qtyIn: 0,
              qtyOut: mat.qty,
              type: 'Servicio Jardineria' as MovementType,
              doc: proj.id,
              user: responsable('Jardinería Aurevia'),
              unitCost: s.products.find(p => p.sku === mat.sku)?.cost ?? 0
            }))
          );
          if (nube) await repo.actualizarProyecto(id, { stockDescontado: true });
          commit({ ...next, projects: next.projects.map(p => (p.id === id ? { ...p, stockDeducted: true } : p)) });
          return { ok: true, project: proj };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async facturarProyecto(id: string): Promise<Result<{ invoice: ComprobanteSunat }>> {
        const s = get();
        const proj = s.projects.find(p => p.id === id);
        if (!proj) return { ok: false, error: 'Proyecto no encontrado.' };
        if (proj.invoiceId) return { ok: false, error: `El proyecto ${proj.id} ya fue facturado con ${proj.invoiceId}.` };
        if (proj.status === 'COTIZADO') return { ok: false, error: `El proyecto ${proj.id} aún es una cotización. Apruébalo antes de facturar.` };
        // RUC válido → Factura (01) · DNI → Boleta (03). No se sustituye por el RUC del emisor.
        const esFactura = validarRuc(proj.doc);
        if (!esFactura && !validarDni(proj.doc)) {
          return { ok: false, error: `⚠️ El documento del cliente "${proj.doc}" no es un RUC ni un DNI válido. Corrige la cotización antes de facturar.` };
        }

        try {
          const serie = esFactura ? s.company.serieFactura : s.company.serieBoleta;
          const invoice = await emitirCpe(
            s.company,
            esFactura ? '01' : '03',
            serie,
            await correlativo(serie),
            { numDoc: proj.doc, nombre: proj.client, direccion: proj.address },
            [{ sku: 'SRV-PAIS', name: `Servicio de ${proj.type} - ${proj.address}`, quantity: 1, priceWithIgv: proj.total }]
          );

          // Detracción SPOT: sólo en facturas por servicios cuyo importe supera S/ 700
          const det = calcularDetraccion(proj.total, s.company.tasaDetraccionServicios);
          const fecha = today();
          const detraccion: DetraccionRecord | null =
            esFactura && det.aplica
              ? {
                  id: nuevoId('DET'),
                  facturaId: invoice.id,
                  cliente: proj.client,
                  rucCliente: proj.doc,
                  fechaEmision: fecha,
                  fechaVencimientoBn: vencimientoDetraccion(fecha),
                  montoFactura: proj.total,
                  tasa: s.company.tasaDetraccionServicios,
                  montoDetraccion: det.montoDetraccion,
                  estado: 'PENDIENTE'
                }
              : null;

          if (nube) {
            await repo.guardarComprobante(invoice, { servicioId: proj.id });
            await repo.actualizarProyecto(proj.id, { comprobanteId: invoice.id });
            if (detraccion) await repo.guardarDetraccion(detraccion);
          }

          const cur = get();
          commit({
            ...cur,
            invoices: [invoice, ...cur.invoices],
            detracciones: detraccion ? [detraccion, ...cur.detracciones] : cur.detracciones,
            projects: cur.projects.map(p => (p.id === id ? { ...p, invoiceId: invoice.id } : p))
          });
          return { ok: true, invoice };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      // ---------------- ADMINISTRACIÓN ----------------
      async registrarConstanciaDetraccion(id: string): Promise<Result> {
        const constanciaBn = `BN-${Math.floor(10000000 + Math.random() * 90000000)}`;
        const fechaDeposito = today();
        try {
          if (nube) await repo.marcarDetraccionPagada(id, constanciaBn, fechaDeposito);
          const s = get();
          commit({
            ...s,
            detracciones: s.detracciones.map(d => (d.id === id ? { ...d, estado: 'DEPOSITADO', constanciaBn, fechaDeposito } : d))
          });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      async setRegimen(regimenTributario: RegimenTributario): Promise<Result> {
        try {
          if (nube) await repo.guardarEmpresa(get().company, regimenTributario);
          commit({ ...get(), regimenTributario });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      updateCompany(patch: Partial<EmpresaConfig>) {
        const s = get();
        commit({ ...s, company: { ...s.company, ...patch } });
      },

      async guardarEmpresa(): Promise<Result> {
        const { company, regimenTributario } = get();
        // Propagar credenciales al conector SUNAT sin recargar la app
        sunatClient.updateConfig({
          ruc: company.ruc,
          razonSocial: company.razonSocial,
          usuarioSol: company.usuarioSol,
          claveSol: company.claveSol,
          modo: company.sunatAmbiente
        });
        try {
          if (nube) await repo.guardarEmpresa(company, regimenTributario);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errorNube(e) };
        }
      },

      restablecerDemo() {
        if (nube) return;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // sin almacenamiento: basta con reiniciar el estado
        }
        commit(seedState());
      }
    };
  }, [get, commit, nube, usuario]);
}

export type ErpActions = ReturnType<typeof useErpActions>;

interface ErpValue {
  state: ErpState;
  actions: ErpActions;
  nube: boolean;
  cargando: boolean;
  errorCarga: string | null;
}

const ErpContext = createContext<ErpValue | null>(null);

export function ErpProvider({ children, nube = false, usuario = '' }: { children: ReactNode; nube?: boolean; usuario?: string }) {
  const [state, setState] = useState<ErpState>(() => (nube ? nubeVacia() : loadState()));
  const [cargando, setCargando] = useState(nube);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const stateRef = useRef(state);

  const get = useCallback(() => stateRef.current, []);
  const commit = useCallback((next: ErpState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const actions = useErpActions(get, commit, nube, usuario);

  useEffect(() => {
    if (!nube) return;
    void actions.recargar().then(r => {
      setErrorCarga(r.ok ? null : r.error);
      setCargando(false);
    });
  }, [nube, actions]);

  useEffect(() => {
    if (!nube) saveState(state);
  }, [state, nube]);

  const value = useMemo(() => ({ state, actions, nube, cargando, errorCarga }), [state, actions, nube, cargando, errorCarga]);
  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp debe usarse dentro de <ErpProvider>');
  return ctx;
}
