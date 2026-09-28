// ==========================================
// REPOSITORIO SUPABASE
// Traduce entre las tablas de la base (snake_case, español) y el modelo de la app.
// Sólo se usa en modo nube; RLS decide qué puede leer o escribir cada rol.
// ==========================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BiologicalLoss,
  CashRegisterState,
  CatalogProduct,
  GastoCaja,
  ComprobanteSunat,
  CrmClient,
  DetraccionRecord,
  EmpresaConfig,
  GardeningProject,
  GuiaRemisionSunat,
  KardexMovement,
  MovementType,
  ConfigTienda,
  ServicioPublico,
  SolicitudTienda,
  TarifaDelivery,
  AvisosWhatsapp,
  Contrato,
  Cotizacion,
  Cupon,
  NotaCliente,
  Tarea,
  ParteProduccion,
  Pedido,
  ProjectStatus,
  Purchase,
  RegimenTributario
} from '../domain/types';
import { emisorDe } from '../domain/types';
import { EMPRESA_VACIA } from '../data/seed';
import type { Rol } from '../domain/types';
import { round2 } from './peru';
import { getSupabase } from './supabase';
import type { Asiento, Cuenta, CuentasExistencia, LineaAsiento } from './contabilidad';
import { hoyLocal } from './fechas';

/** Fecha local (YYYY-MM-DD) de una marca de tiempo del servidor. */
const hoyLima = (iso: string) => hoyLocal(new Date(iso));

type Row = Record<string, any>;

const IMAGEN_POR_DEFECTO = 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=600&auto=format&fit=crop&q=80';

async function db() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase no está configurado.');
  return sb;
}

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

const num = (v: unknown) => Number(v ?? 0);
const horaLocal = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const inicioDelDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// ---------------- LECTURA ----------------

export interface DatosNube {
  company: EmpresaConfig;
  regimenTributario: RegimenTributario;
  products: CatalogProduct[];
  kardex: KardexMovement[];
  invoices: ComprobanteSunat[];
  purchases: Purchase[];
  losses: BiologicalLoss[];
  detracciones: DetraccionRecord[];
  crmClients: CrmClient[];
  projects: GardeningProject[];
  guiasRemision: GuiaRemisionSunat[];
  cashRegister: CashRegisterState;
  pedidos: Pedido[];
  notasClientes: NotaCliente[];
  tareas: Tarea[];
  cotizaciones: Cotizacion[];
  cupones: Cupon[];
  contratos: Contrato[];
  puntosSaldo: Record<string, number>;
  solicitudes: SolicitudTienda[];
  tiendaConfig: ConfigTienda;
  serviciosPublicos: ServicioPublico[];
  gastosCaja: GastoCaja[];
  tarifasDelivery: TarifaDelivery[];
  avisos: AvisosWhatsapp;
}

export async function cargarTodo(): Promise<DatosNube> {
  const sb = await db();
  const [empresa, productos, kardex, comprobantes, compras, bajas, detracciones, clientes, servicios, guias, caja, pedidos, notas, tareas, cotizaciones, cupones, contratos, puntos, solicitudes, tiendaCfg, serviciosTienda, gastos, tarifas, avisos] = await Promise.all([
    sb.from('empresa_config').select('*').limit(1).maybeSingle(),
    sb.from('productos').select('*').eq('activo', true).order('sku'),
    sb.from('kardex_movimientos').select('*').order('id', { ascending: false }).limit(500),
    sb.from('comprobantes').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('compras').select('*').order('fecha', { ascending: false }),
    sb.from('bajas_biologicas').select('*').order('fecha', { ascending: false }),
    sb.from('detracciones').select('*').order('fecha_vencimiento_bn'),
    sb.from('clientes').select('*').order('nombre'),
    sb.from('servicios_jardineria').select('*, servicios_materiales(*)').order('fecha_programada', { ascending: false }),
    sb.from('guias_remision').select('*').order('created_at', { ascending: false }),
    sb.from('caja_movimientos').select('*').gte('fecha', inicioDelDia()).order('id'),
    sb.from('pedidos').select('*, pedidos_detalle(*)').order('created_at', { ascending: false }).limit(300),
    sb.from('cliente_notas').select('*').order('created_at', { ascending: false }).limit(1000),
    sb.from('tareas').select('*').order('vence').limit(500),
    sb.from('cotizaciones').select('*').order('created_at', { ascending: false }).limit(300),
    sb.from('cupones').select('*').order('created_at', { ascending: false }),
    sb.from('contratos').select('*').order('created_at'),
    sb.from('puntos_saldos').select('*'),
    sb.from('solicitudes_tienda').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('tienda_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('servicios_publicos').select('*').order('orden'),
    // Gastos de caja chica de los últimos 13 meses (las devoluciones ya cuentan como notas de crédito)
    sb.from('caja_movimientos').select('id, fecha, concepto, monto, responsable').eq('tipo', 'EGRESO').is('comprobante_id', null)
      .gte('fecha', new Date(Date.now() - 400 * 86_400_000).toISOString()).order('fecha', { ascending: false }).limit(2000),
    sb.from('tarifas_delivery').select('*').order('distrito'),
    sb.from('notificaciones_config').select('whatsapp, apikey, activo, ultimo_envio').eq('id', 1).maybeSingle() // sólo el dueño la ve (RLS)
  ]);

  const empresaRow = ok<Row | null>(empresa);
  const company = empresaDesdeFila(empresaRow);
  const products = ok<Row[]>(productos).map(productoDesdeFila);
  const nombres = new Map(products.map(p => [p.sku, p.name]));

  return {
    company,
    regimenTributario: (empresaRow?.regimen_tributario ?? 'RMT') as RegimenTributario,
    products,
    kardex: ok<Row[]>(kardex).map(r => kardexDesdeFila(r, nombres)),
    invoices: ok<Row[]>(comprobantes).map(r => comprobanteDesdeFila(r, company)),
    purchases: ok<Row[]>(compras).map(compraDesdeFila),
    losses: ok<Row[]>(bajas).map(r => bajaDesdeFila(r, nombres)),
    detracciones: ok<Row[]>(detracciones).map(detraccionDesdeFila),
    crmClients: ok<Row[]>(clientes).map(clienteDesdeFila),
    projects: ok<Row[]>(servicios).map(r => proyectoDesdeFila(r, nombres)),
    guiasRemision: ok<Row[]>(guias).map(r => r.datos as GuiaRemisionSunat),
    cashRegister: cajaDesdeFilas(ok<Row[]>(caja)),
    pedidos: ok<Row[]>(pedidos).map(r => pedidoDesdeFila(r, nombres)),
    notasClientes: ok<Row[]>(notas).map(notaDesdeFila),
    tareas: ok<Row[]>(tareas).map(tareaDesdeFila),
    cotizaciones: ok<Row[]>(cotizaciones).map(cotizacionDesdeFila),
    cupones: ok<Row[]>(cupones).map(cuponDesdeFila),
    contratos: ok<Row[]>(contratos).map(contratoDesdeFila),
    puntosSaldo: Object.fromEntries(ok<Row[]>(puntos).map(r => [r.cliente_doc, r.saldo])),
    solicitudes: ok<Row[]>(solicitudes).map(solicitudDesdeFila),
    tiendaConfig: configTiendaDesdeFila(ok<Row | null>(tiendaCfg)),
    serviciosPublicos: ok<Row[]>(serviciosTienda).map(servicioPublicoDesdeFila),
    gastosCaja: ok<Row[]>(gastos).map(r => ({ id: String(r.id), fecha: hoyLima(r.fecha), motivo: r.concepto ?? '', monto: num(r.monto), responsable: r.responsable ?? '' })),
    tarifasDelivery: ok<Row[]>(tarifas).map(tarifaDesdeFila),
    avisos: avisosDesdeFila(ok<Row | null>(avisos)),
  };
}

function empresaDesdeFila(r: Row | null): EmpresaConfig {
  const base = EMPRESA_VACIA;
  if (!r) return base;
  return {
    ...base,
    ruc: r.ruc ?? base.ruc,
    razonSocial: r.razon_social ?? base.razonSocial,
    nombreComercial: r.nombre_comercial ?? base.nombreComercial,
    direccion: r.direccion ?? base.direccion,
    ubigeo: r.ubigeo ?? base.ubigeo,
    sunatAmbiente: r.sunat_ambiente ?? base.sunatAmbiente,
    serieBoleta: r.serie_boleta ?? base.serieBoleta,
    serieFactura: r.serie_factura ?? base.serieFactura,
    serieGre: r.serie_gre ?? base.serieGre,
    cuentaDetraccionesBn: r.cuenta_detracciones_bn ?? base.cuentaDetraccionesBn,
    cuentaBcpSoles: r.cuenta_bcp_soles ?? base.cuentaBcpSoles,
    tasaDetraccionServicios: r.tasa_detraccion != null ? num(r.tasa_detraccion) : base.tasaDetraccionServicios,
    modoEmision: r.modo_emision ?? base.modoEmision,
    ultimosNumeros: r.ultimos_numeros ?? {},
    serieNcBoleta: r.serie_nc_boleta ?? base.serieNcBoleta,
    serieNcFactura: r.serie_nc_factura ?? base.serieNcFactura
  };
}

function productoDesdeFila(r: Row): CatalogProduct {
  return {
    sku: r.sku,
    name: r.nombre,
    scientificName: r.nombre_cientifico ?? undefined,
    category: r.categoria,
    price: num(r.precio_venta),
    cost: num(r.costo_unitario),
    stock: num(r.stock_actual),
    minStock: r.stock_minimo,
    location: r.ubicacion_estante ?? '',
    careLight: r.cuidado_luz ?? undefined,
    careWater: r.cuidado_riego ?? undefined,
    isLivePlant: !!r.es_planta_viva,
    fullImage: r.imagen_url ?? IMAGEN_POR_DEFECTO,
    description: r.descripcion ?? '',
    botanicalFamily: r.familia_botanica ?? '',
    categoryName: r.categoria_nombre ?? r.categoria,
    visibleTienda: r.visible_tienda ?? true,
    destacado: !!r.destacado,
    valorInventario: r.valor_inventario != null ? num(r.valor_inventario) : undefined,
    costoPromedio: r.costo_promedio != null ? num(r.costo_promedio) : undefined,
    unidadMedida: r.unidad_medida ?? undefined,
    tipoExistencia: r.tipo_existencia ?? undefined
  };
}

function kardexDesdeFila(r: Row, nombres: Map<string, string>): KardexMovement {
  return {
    id: `KDX-${String(r.id).padStart(5, '0')}`,
    date: String(r.fecha).slice(0, 10),
    productSku: r.producto_sku,
    productName: nombres.get(r.producto_sku) ?? r.producto_sku,
    movementType: r.tipo_movimiento as MovementType,
    quantityIn: num(r.cantidad_entrada),
    quantityOut: num(r.cantidad_salida),
    balance: num(r.saldo_resultante),
    unitCost: num(r.costo_unitario),
    referenceDoc: r.documento_referencia ?? undefined,
    responsibleUser: r.usuario_responsable,
    fechaEmision: r.fecha_emision ?? undefined,
    tipoComprobante: r.sunat_tipo_comprobante ?? undefined,
    comprobanteSerie: r.comprobante_serie ?? undefined,
    comprobanteNumero: r.comprobante_numero ?? undefined,
    tipoOperacion: r.sunat_tipo_operacion ?? undefined,
    movimiento: r.movimiento ?? undefined,
    cantidad: r.cantidad != null ? num(r.cantidad) : undefined,
    costoTotal: r.costo_total != null ? num(r.costo_total) : undefined,
    saldoCantidad: r.saldo_cantidad != null ? num(r.saldo_cantidad) : undefined,
    saldoCostoUnitario: r.saldo_costo_unitario != null ? num(r.saldo_costo_unitario) : undefined,
    saldoCostoTotal: r.saldo_costo_total != null ? num(r.saldo_costo_total) : undefined
  };
}

function comprobanteDesdeFila(r: Row, company: EmpresaConfig): ComprobanteSunat {
  return {
    id: r.id,
    tipoComprobante: r.tipo_comprobante,
    serie: r.serie,
    correlativo: r.correlativo,
    fechaEmision: r.fecha_emision,
    horaEmision: r.hora_emision ?? '',
    moneda: 'PEN',
    emisor: emisorDe(company),
    cliente: { tipoDoc: r.cliente_tipo_doc ?? '1', numDoc: r.cliente_num_doc ?? '', nombreRazonSocial: r.cliente },
    opGravadas: num(r.op_gravadas),
    opExoneradas: 0,
    opInafectas: 0,
    totalIgv: num(r.total_igv),
    montoTotal: num(r.monto_total),
    items: r.items ?? [],
    estadoSunat: r.estado_sunat ?? 'PENDIENTE',
    codigoRespuestaSunat: r.codigo_respuesta ?? undefined,
    descripcionRespuestaSunat: r.descripcion_respuesta ?? undefined,
    hashCpe: r.hash_cpe ?? undefined,
    descuentoTotal: num(r.descuento_total),
    pagos: r.pagos ?? [],
    referencia: r.comprobante_referencia ?? undefined,
    motivo: r.motivo ?? undefined,
    vendedor: r.vendedor ?? undefined,
    canal: r.canal ?? undefined,
    cupon: r.cupon ?? undefined,
    puntosGanados: r.puntos_ganados ?? 0,
    puntosCanjeados: r.puntos_canjeados ?? 0,
    cotizacionId: r.cotizacion_id ?? undefined,
    numeroSunat: r.numero_sunat ?? undefined,
    emitidoAt: r.emitido_at ?? undefined,
    enviadoClienteAt: r.enviado_cliente_at ?? undefined,
    contratoId: r.contrato_id ?? undefined
  };
}

function compraDesdeFila(r: Row): Purchase {
  return {
    id: r.id,
    proveedor: r.proveedor_razon_social,
    ruc: r.proveedor_ruc,
    fecha: r.fecha,
    gravada: num(r.gravada),
    igv: num(r.igv),
    total: num(r.total),
    items: r.detalle ?? ''
  };
}

function bajaDesdeFila(r: Row, nombres: Map<string, string>): BiologicalLoss {
  return {
    id: r.id,
    sku: r.producto_sku,
    productName: nombres.get(r.producto_sku) ?? r.producto_sku,
    type: r.tipo,
    qty: r.cantidad,
    unitCost: num(r.costo_unitario),
    totalLoss: r.cantidad * num(r.costo_unitario),
    reason: r.motivo ?? '',
    date: r.fecha,
    status: r.estado
  };
}

function detraccionDesdeFila(r: Row): DetraccionRecord {
  return {
    id: r.id,
    facturaId: r.comprobante_id,
    cliente: r.cliente ?? '',
    rucCliente: r.ruc_cliente ?? '',
    fechaEmision: r.fecha_emision ?? '',
    fechaVencimientoBn: r.fecha_vencimiento_bn,
    montoFactura: num(r.monto_factura),
    tasa: num(r.tasa),
    montoDetraccion: num(r.monto),
    estado: r.estado,
    constanciaBn: r.constancia_bn ?? undefined,
    fechaDeposito: r.fecha_deposito ?? undefined
  };
}

function clienteDesdeFila(r: Row): CrmClient {
  return {
    id: String(r.id),
    name: r.nombre,
    doc: r.num_doc ?? undefined,
    phone: r.telefono ?? '',
    district: r.distrito ?? '',
    plantsOwned: r.plantas ?? [],
    lastPurchaseDate: String(r.created_at ?? '').slice(0, 10),
    seasonalAlert: r.alerta_estacional ?? '🌱 Aún sin alerta de temporada registrada.',
    recommendedAction: r.accion_recomendada ?? 'Registrar las plantas del cliente para personalizar sus cuidados.',
    urgency: r.urgencia ?? 'ESTACIONAL',
    email: r.email ?? undefined,
    address: r.direccion ?? undefined,
    canal: r.canal_origen ?? undefined
  };
}

function proyectoDesdeFila(r: Row, nombres: Map<string, string>): GardeningProject {
  return {
    id: r.id,
    client: r.cliente_nombre ?? '',
    doc: r.cliente_doc ?? '',
    phone: r.cliente_telefono ?? '',
    type: r.tipo_servicio,
    address: r.direccion ?? '',
    status: r.estado as ProjectStatus,
    materials: (r.servicios_materiales ?? []).map((m: Row) => ({
      sku: m.producto_sku,
      name: nombres.get(m.producto_sku) ?? m.producto_sku,
      qty: m.cantidad_utilizada,
      unitPrice: num(m.precio_unitario)
    })),
    laborHours: num(r.horas_mano_obra),
    laborRatePerHour: num(r.tarifa_hora),
    total: num(r.precio_servicio),
    date: String(r.fecha_programada ?? '').slice(0, 10),
    stockDeducted: !!r.stock_descontado,
    aplicaDetraccion: !!r.aplica_detraccion,
    montoDetraccion: num(r.monto_detraccion),
    montoNetoACobrar: r.monto_neto != null ? num(r.monto_neto) : num(r.precio_servicio),
    invoiceId: r.comprobante_id ?? undefined
  };
}

function pedidoDesdeFila(r: Row, nombres: Map<string, string>): Pedido {
  return {
    id: r.id,
    createdAt: r.created_at,
    canal: r.canal_venta,
    estado: r.estado,
    cliente: { nombre: r.cliente_nombre ?? '', telefono: r.cliente_telefono ?? '', doc: r.cliente_doc ?? undefined },
    direccion: r.direccion ?? '',
    distrito: r.distrito ?? '',
    referencia: r.referencia ?? undefined,
    fechaEntrega: r.fecha_entrega ?? '',
    franja: r.franja_horaria ?? undefined,
    items: (r.pedidos_detalle ?? []).map((d: Row) => ({
      sku: d.producto_sku,
      name: nombres.get(d.producto_sku) ?? d.producto_sku,
      qty: d.cantidad,
      unitPrice: num(d.precio_unitario)
    })),
    costoDelivery: num(r.costo_delivery),
    total: num(r.total),
    notas: r.notas ?? undefined,
    repartidor: r.repartidor_asignado ?? undefined,
    metodoPago: r.metodo_pago ?? undefined,
    comprobanteId: r.comprobante_id ?? undefined,
    guiaId: r.guia_id ?? undefined,
    fotoEvidencia: r.foto_evidencia_url ?? undefined,
    entregadoAt: r.entregado_at ?? undefined,
    tipoComprobante: r.tipo_comprobante ?? undefined,
    razonSocial: r.razon_social ?? undefined
  };
}

function notaDesdeFila(r: Row): NotaCliente {
  return { id: String(r.id), clienteId: String(r.cliente_id), texto: r.texto, autor: r.autor, fecha: r.created_at };
}

function tareaDesdeFila(r: Row): Tarea {
  return {
    id: String(r.id),
    clienteId: r.cliente_id != null ? String(r.cliente_id) : undefined,
    titulo: r.titulo,
    vence: r.vence,
    asignadoA: r.asignado_a ?? undefined,
    hecha: !!r.hecha,
    creadoPor: r.creado_por
  };
}

function cotizacionDesdeFila(r: Row): Cotizacion {
  return {
    id: r.id,
    fecha: r.fecha,
    vence: r.vence,
    cliente: { nombre: r.cliente_nombre, doc: r.cliente_doc ?? undefined, telefono: r.cliente_telefono ?? undefined },
    lineas: r.items ?? [],
    descuentoGlobal: r.descuento_global ?? { tipo: 'PCT', valor: 0 },
    total: num(r.total),
    estado: r.estado,
    comprobanteId: r.comprobante_id ?? undefined,
    notas: r.notas ?? undefined,
    creadoPor: r.creado_por
  };
}

function cuponDesdeFila(r: Row): Cupon {
  return {
    codigo: r.codigo,
    descripcion: r.descripcion ?? undefined,
    tipo: r.tipo,
    valor: num(r.valor),
    minimoCompra: num(r.minimo_compra),
    vence: r.vence ?? undefined,
    usosMax: r.usos_max ?? undefined,
    usos: r.usos,
    activo: !!r.activo
  };
}

function contratoDesdeFila(r: Row): Contrato {
  return {
    id: r.id,
    cliente: { nombre: r.cliente_nombre, doc: r.cliente_doc, telefono: r.cliente_telefono ?? undefined },
    direccion: r.direccion ?? undefined,
    servicio: r.servicio,
    montoMensual: num(r.monto_mensual),
    diaCobro: r.dia_cobro,
    visitasMes: r.visitas_mes,
    jardinero: r.jardinero ?? undefined,
    inicio: r.inicio,
    activo: !!r.activo,
    ultimoPeriodo: r.ultimo_periodo ?? undefined
  };
}

export function servicioPublicoDesdeFila(r: Row): ServicioPublico {
  return { slug: r.slug, nombre: r.nombre, resumen: r.resumen, descripcion: r.descripcion ?? undefined, imagen: r.imagen_url ?? undefined, orden: r.orden ?? 0, visible: !!r.visible, precioDesde: r.precio_desde != null ? num(r.precio_desde) : undefined };
}

export function configTiendaDesdeFila(r: Row | null): ConfigTienda {
  if (!r) return {};
  return { whatsapp: r.whatsapp ?? undefined, email: r.email ?? undefined, direccion: r.direccion ?? undefined, horario: r.horario ?? undefined, mensajePortada: r.mensaje_portada ?? undefined };
}

function solicitudDesdeFila(r: Row): SolicitudTienda {
  return {
    id: String(r.id), tipo: r.tipo, nombre: r.nombre, telefono: r.telefono, email: r.email ?? undefined, distrito: r.distrito ?? undefined,
    mensaje: r.mensaje ?? undefined, servicioSlug: r.servicio_slug ?? undefined, items: r.items ?? [], totalReferencial: num(r.total_referencial),
    estado: r.estado, pedidoId: r.pedido_id ?? undefined, createdAt: r.created_at,
    comprobante: r.comprobante ?? 'BOLETA', docCliente: r.doc_cliente ?? undefined, razonSocial: r.razon_social ?? undefined,
    costoDelivery: r.costo_delivery != null ? num(r.costo_delivery) : undefined,
    entrega: r.entrega ?? 'RECOJO', direccion: r.direccion ?? undefined, requiereAsesor: !!r.requiere_asesor
  };
}

function cajaDesdeFilas(rows: Row[]): CashRegisterState {
  const suma = (f: (r: Row) => boolean) => rows.filter(f).reduce((a, r) => a + num(r.monto), 0);
  // Medios digitales: ingresos menos devoluciones pagadas por ese mismo medio
  const neto = (medios: string[]) =>
    suma(r => r.tipo === 'INGRESO' && medios.includes(r.medio_pago)) - suma(r => r.tipo === 'EGRESO' && medios.includes(r.medio_pago));
  const apertura = suma(r => r.tipo === 'APERTURA');
  const ventasEfectivo = suma(r => r.tipo === 'INGRESO' && r.medio_pago === 'Efectivo');
  const egresos = rows
    .filter(r => r.tipo === 'EGRESO' && (!r.medio_pago || r.medio_pago === 'Efectivo'))
    .map(r => ({ id: `EG-${r.id}`, motivo: r.concepto ?? '', monto: num(r.monto), hora: horaLocal(r.fecha), responsable: r.responsable }));
  const cierres = rows.filter(r => r.tipo === 'CIERRE');
  const teorico = apertura + ventasEfectivo - egresos.reduce((a, e) => a + e.monto, 0);
  return {
    aperturaEfectivo: apertura,
    ventasEfectivo,
    ventasBilleteras: neto(['Yape', 'Plin']),
    ventasTarjetas: neto(['Tarjeta']),
    ventasTransferencias: neto(['Transferencia']),
    egresos,
    conteoRealEfectivo: cierres.length ? num(cierres[cierres.length - 1].monto) : teorico,
    estadoCaja: cierres.length ? 'CUADRADA' : 'ABIERTA'
  };
}

// ---------------- ESCRITURA ----------------

export interface MovimientoNuevo {
  sku: string;
  qtyIn: number;
  qtyOut: number;
  type: MovementType;
  doc: string;
  user: string;
  unitCost: number;
}

/** Inserta en el Kardex; el servidor recalcula el saldo y lo devuelve. */
export async function insertarKardex(movs: MovimientoNuevo[], nombres: Map<string, string>): Promise<KardexMovement[]> {
  if (!movs.length) return [];
  const sb = await db();
  const rows = ok<Row[]>(
    await sb
      .from('kardex_movimientos')
      .insert(movs.map(m => ({
        producto_sku: m.sku,
        tipo_movimiento: m.type,
        cantidad_entrada: m.qtyIn,
        cantidad_salida: m.qtyOut,
        saldo_resultante: 0, // lo fija el trigger
        costo_unitario: m.unitCost,
        documento_referencia: m.doc,
        usuario_responsable: m.user
      })))
      .select('*')
  );
  return rows.sort((a, b) => b.id - a.id).map(r => kardexDesdeFila(r, nombres));
}

export interface ComprobanteAtomico {
  invoice: ComprobanteSunat;
  medioPago?: string;
  movimientos: MovimientoNuevo[];
  caja: { tipo: 'INGRESO' | 'EGRESO'; medioPago: string; monto: number; concepto: string }[];
  guia?: GuiaRemisionSunat | null;
  cliente?: { nombre: string; tipoDoc: string; numDoc: string } | null;
  responsable: string;
  pedidoId?: string; // cobro de un pedido: pasa a "pagado" en la misma transacción
  cupon?: { codigo: string; base: number; descuento: number };
}

/** Venta o nota de crédito en una sola transacción del servidor (función registrar_comprobante). */
export async function registrarComprobanteAtomico(c: ComprobanteAtomico, nombres: Map<string, string>): Promise<KardexMovement[]> {
  const sb = await db();
  const inv = c.invoice;
  const filas = ok<Row[]>(await sb.rpc('registrar_comprobante', {
    p: {
      comprobante: {
        id: inv.id,
        tipo_comprobante: inv.tipoComprobante,
        serie: inv.serie,
        correlativo: inv.correlativo,
        fecha_emision: inv.fechaEmision,
        hora_emision: inv.horaEmision,
        cliente: inv.cliente.nombreRazonSocial,
        cliente_tipo_doc: inv.cliente.tipoDoc,
        cliente_num_doc: inv.cliente.numDoc,
        op_gravadas: inv.opGravadas,
        total_igv: inv.totalIgv,
        monto_total: inv.montoTotal,
        items: inv.items,
        estado_sunat: inv.estadoSunat,
        codigo_respuesta: inv.codigoRespuestaSunat ?? null,
        descripcion_respuesta: inv.descripcionRespuestaSunat ?? null,
        hash_cpe: inv.hashCpe ?? null,
        medio_pago: c.medioPago ?? null,
        descuento_total: inv.descuentoTotal ?? 0,
        pagos: inv.pagos ?? [],
        comprobante_referencia: inv.referencia ?? null,
        motivo: inv.motivo ?? null,
        pedido_id: c.pedidoId ?? null,
        canal: inv.canal ?? null,
        cupon: c.cupon?.codigo ?? null,
        base_cupon: c.cupon?.base ?? null,
        descuento_cupon: c.cupon?.descuento ?? null,
        puntos_canjeados: inv.puntosCanjeados ?? 0,
        cotizacion_id: inv.cotizacionId ?? null,
        contrato_id: inv.contratoId ?? null
      },
      movimientos: c.movimientos.map(m => ({
        producto_sku: m.sku,
        tipo_movimiento: m.type,
        cantidad_entrada: m.qtyIn,
        cantidad_salida: m.qtyOut,
        costo_unitario: m.unitCost
      })),
      caja: c.caja.map(x => ({ tipo: x.tipo, medio_pago: x.medioPago, monto: x.monto, concepto: x.concepto })),
      guia: c.guia ? { id: c.guia.id, fecha_emision: c.guia.fechaEmision, datos: c.guia } : null,
      cliente: c.cliente ? { nombre: c.cliente.nombre, tipo_doc: c.cliente.tipoDoc, num_doc: c.cliente.numDoc } : null,
      responsable: c.responsable
    }
  }));
  return filas.sort((a, b) => b.id - a.id).map(r => kardexDesdeFila(r, nombres));
}

export async function siguienteCorrelativo(serie: string): Promise<number> {
  const sb = await db();
  const rows = ok<Row[]>(await sb.from('comprobantes').select('correlativo').eq('serie', serie).order('correlativo', { ascending: false }).limit(1));
  return rows.length ? rows[0].correlativo + 1 : 1;
}

export async function guardarComprobante(inv: ComprobanteSunat, extra: { medioPago?: string; servicioId?: string } = {}) {
  const sb = await db();
  ok(await sb.from('comprobantes').insert({
    id: inv.id,
    tipo_comprobante: inv.tipoComprobante,
    serie: inv.serie,
    correlativo: inv.correlativo,
    fecha_emision: inv.fechaEmision,
    hora_emision: inv.horaEmision,
    cliente: inv.cliente.nombreRazonSocial,
    cliente_tipo_doc: inv.cliente.tipoDoc,
    cliente_num_doc: inv.cliente.numDoc,
    op_gravadas: inv.opGravadas,
    total_igv: inv.totalIgv,
    monto_total: inv.montoTotal,
    items: inv.items,
    estado_sunat: inv.estadoSunat,
    codigo_respuesta: inv.codigoRespuestaSunat ?? null,
    descripcion_respuesta: inv.descripcionRespuestaSunat ?? null,
    hash_cpe: inv.hashCpe ?? null,
    medio_pago: extra.medioPago ?? null,
    servicio_id: extra.servicioId ?? null
  }));
}

/** Crea o actualiza la ficha del cliente por su DNI/RUC (no toca sus plantas ni alertas). */
export async function guardarCliente(c: { nombre: string; tipoDoc: string; numDoc: string; telefono?: string; direccion?: string }) {
  const sb = await db();
  const fila: Row = { nombre: c.nombre, tipo_doc: c.tipoDoc, num_doc: c.numDoc };
  if (c.telefono) fila.telefono = c.telefono;
  if (c.direccion) fila.direccion = c.direccion;
  ok(await sb.from('clientes').upsert(fila, { onConflict: 'num_doc' }));
}

export async function guardarCaja(m: { tipo: 'APERTURA' | 'INGRESO' | 'EGRESO' | 'CIERRE'; monto: number; medioPago?: string; concepto?: string; comprobanteId?: string; responsable: string }) {
  const sb = await db();
  ok(await sb.from('caja_movimientos').insert({
    tipo: m.tipo,
    monto: m.monto,
    medio_pago: m.medioPago ?? null,
    concepto: m.concepto ?? null,
    comprobante_id: m.comprobanteId ?? null,
    responsable: m.responsable
  }));
}

export async function guardarGuia(gre: GuiaRemisionSunat, comprobanteId?: string) {
  const sb = await db();
  ok(await sb.from('guias_remision').insert({ id: gre.id, fecha_emision: gre.fechaEmision, comprobante_id: comprobanteId ?? null, datos: gre }));
}

export async function guardarCompra(p: Purchase) {
  const sb = await db();
  ok(await sb.from('compras').insert({
    id: p.id,
    proveedor_ruc: p.ruc,
    proveedor_razon_social: p.proveedor,
    fecha: p.fecha,
    gravada: p.gravada,
    igv: p.igv,
    total: p.total,
    detalle: p.items
  }));
}

export async function guardarBaja(b: BiologicalLoss) {
  const sb = await db();
  ok(await sb.from('bajas_biologicas').insert({
    id: b.id,
    producto_sku: b.sku,
    tipo: b.type,
    cantidad: b.qty,
    costo_unitario: b.unitCost,
    motivo: b.reason,
    estado: b.status,
    fecha: b.date
  }));
}

export async function guardarProyectoNuevo(p: GardeningProject) {
  const sb = await db();
  ok(await sb.from('servicios_jardineria').insert({
    id: p.id,
    tipo_servicio: p.type,
    direccion: p.address,
    fecha_programada: p.date,
    horas_mano_obra: p.laborHours,
    tarifa_hora: p.laborRatePerHour,
    precio_servicio: p.total,
    estado: p.status,
    stock_descontado: p.stockDeducted,
    cliente_nombre: p.client,
    cliente_doc: p.doc,
    cliente_telefono: p.phone,
    aplica_detraccion: p.aplicaDetraccion,
    monto_detraccion: p.montoDetraccion,
    monto_neto: p.montoNetoACobrar
  }));
  if (p.materials.length) {
    ok(await sb.from('servicios_materiales').insert(
      p.materials.map(m => ({ servicio_id: p.id, producto_sku: m.sku, cantidad_utilizada: m.qty, precio_unitario: m.unitPrice }))
    ));
  }
}

export async function actualizarProyecto(id: string, cambios: { estado?: ProjectStatus; stockDescontado?: boolean; comprobanteId?: string }) {
  const sb = await db();
  const fila: Row = {};
  if (cambios.estado) fila.estado = cambios.estado;
  if (cambios.stockDescontado !== undefined) fila.stock_descontado = cambios.stockDescontado;
  if (cambios.comprobanteId) fila.comprobante_id = cambios.comprobanteId;
  ok(await sb.from('servicios_jardineria').update(fila).eq('id', id));
}

export async function guardarDetraccion(d: DetraccionRecord) {
  const sb = await db();
  ok(await sb.from('detracciones').insert({
    id: d.id,
    comprobante_id: d.facturaId,
    cliente: d.cliente,
    ruc_cliente: d.rucCliente,
    fecha_emision: d.fechaEmision,
    fecha_vencimiento_bn: d.fechaVencimientoBn,
    monto_factura: d.montoFactura,
    tasa: d.tasa,
    monto: d.montoDetraccion,
    estado: d.estado
  }));
}

export async function marcarDetraccionPagada(id: string, constancia: string, fecha: string) {
  const sb = await db();
  ok(await sb.from('detracciones').update({ estado: 'DEPOSITADO', constancia_bn: constancia, fecha_deposito: fecha }).eq('id', id));
}

export async function guardarEmpresa(c: EmpresaConfig, regimen: RegimenTributario) {
  const sb = await db();
  ok(await sb.from('empresa_config').upsert({
    id: c.ruc,
    ruc: c.ruc,
    razon_social: c.razonSocial,
    nombre_comercial: c.nombreComercial,
    direccion: c.direccion,
    ubigeo: c.ubigeo,
    sunat_ambiente: c.sunatAmbiente,
    serie_boleta: c.serieBoleta,
    serie_factura: c.serieFactura,
    serie_gre: c.serieGre,
    cuenta_detracciones_bn: c.cuentaDetraccionesBn,
    cuenta_bcp_soles: c.cuentaBcpSoles,
    tasa_detraccion: c.tasaDetraccionServicios,
    regimen_tributario: regimen,
    modo_emision: c.modoEmision,
    ultimos_numeros: c.ultimosNumeros,
    serie_nc_boleta: c.serieNcBoleta,
    serie_nc_factura: c.serieNcFactura,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' }));
  // La fila se identifica por el RUC: si el RUC cambió, se retira la anterior para no tener dos empresas
  ok(await sb.from('empresa_config').delete().neq('id', c.ruc));
}

// ---------------- USUARIOS ----------------

export interface PerfilUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol | null;
}

export async function listarPerfiles(): Promise<PerfilUsuario[]> {
  const sb = await db();
  return ok<Row[]>(await sb.from('perfiles').select('id, nombre, email, rol').order('email')).map(r => ({
    id: r.id,
    nombre: r.nombre ?? '',
    email: r.email ?? '',
    rol: r.rol
  }));
}

export async function asignarRol(id: string, rol: Rol | null) {
  const sb = await db();
  ok(await sb.from('perfiles').update({ rol }).eq('id', id));
}

// ---------------- PEDIDOS ----------------

export async function guardarPedidoNuevo(p: Pedido, creadoPor: string) {
  const sb = await db();
  ok(await sb.from('pedidos').insert({
    id: p.id,
    canal_venta: p.canal,
    estado: p.estado,
    subtotal: round2(p.total - p.costoDelivery),
    costo_delivery: p.costoDelivery,
    total: p.total,
    cliente_nombre: p.cliente.nombre,
    cliente_telefono: p.cliente.telefono,
    cliente_doc: p.cliente.doc ?? null,
    direccion: p.direccion,
    distrito: p.distrito,
    referencia: p.referencia ?? null,
    fecha_entrega: p.fechaEntrega,
    franja_horaria: p.franja ?? null,
    notas: p.notas ?? null,
    tipo_comprobante: p.tipoComprobante ?? null,
    razon_social: p.razonSocial ?? null,
    creado_por: creadoPor
  }));
  ok(await sb.from('pedidos_detalle').insert(
    p.items.map(it => ({ pedido_id: p.id, producto_sku: it.sku, cantidad: it.qty, precio_unitario: it.unitPrice, subtotal: round2(it.qty * it.unitPrice) }))
  ));
}

export async function actualizarPedido(id: string, cambios: { estado?: string; repartidor?: string; fotoEvidencia?: string; entregadoAt?: string }) {
  const sb = await db();
  const fila: Row = { updated_at: new Date().toISOString() };
  if (cambios.estado) fila.estado = cambios.estado;
  if (cambios.repartidor !== undefined) fila.repartidor_asignado = cambios.repartidor;
  if (cambios.fotoEvidencia) fila.foto_evidencia_url = cambios.fotoEvidencia;
  if (cambios.entregadoAt) fila.entregado_at = cambios.entregadoAt;
  ok(await sb.from('pedidos').update(fila).eq('id', id));
}

/** Sube la foto de entrega a la carpeta privada "evidencias" y devuelve su ruta. */
export async function subirEvidencia(pedidoId: string, archivo: File): Promise<string> {
  const sb = await db();
  const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
  const ruta = `${pedidoId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('evidencias').upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw new Error(error.message);
  return ruta;
}

/** Enlace temporal (10 min) para ver una foto de entrega. */
export async function urlEvidencia(ruta: string): Promise<string> {
  const sb = await db();
  const { data, error } = await sb.storage.from('evidencias').createSignedUrl(ruta, 600);
  if (error || !data) throw new Error(error?.message ?? 'No se pudo abrir la foto');
  return data.signedUrl;
}

// ---------------- CRM ----------------

function filaCliente(c: Partial<CrmClient>): Row {
  const f: Row = {};
  if (c.name !== undefined) f.nombre = c.name;
  if (c.doc !== undefined) {
    f.num_doc = c.doc || null;
    f.tipo_doc = c.doc?.length === 11 ? '6' : c.doc?.length === 8 ? '1' : null;
  }
  if (c.phone !== undefined) f.telefono = c.phone || null;
  if (c.email !== undefined) f.email = c.email || null;
  if (c.address !== undefined) f.direccion = c.address || null;
  if (c.district !== undefined) f.distrito = c.district || null;
  if (c.canal !== undefined) f.canal_origen = c.canal || null;
  if (c.plantsOwned !== undefined) f.plantas = c.plantsOwned;
  if (c.seasonalAlert !== undefined) f.alerta_estacional = c.seasonalAlert || null;
  if (c.recommendedAction !== undefined) f.accion_recomendada = c.recommendedAction || null;
  if (c.urgency !== undefined) f.urgencia = c.urgency;
  return f;
}

/** Crea (sin id) o actualiza la ficha; devuelve la ficha guardada. */
export async function guardarFichaCliente(c: Partial<CrmClient>, id?: string): Promise<CrmClient> {
  const sb = await db();
  const q = id
    ? sb.from('clientes').update(filaCliente(c)).eq('id', Number(id)).select('*').single()
    : sb.from('clientes').insert(filaCliente(c)).select('*').single();
  return clienteDesdeFila(ok<Row>(await q));
}

/** Importación masiva: con documento actualiza la ficha existente; sin documento crea una nueva. */
export async function importarClientes(filas: Partial<CrmClient>[]): Promise<CrmClient[]> {
  const sb = await db();
  const conDoc = filas.filter(f => f.doc).map(filaCliente);
  const sinDoc = filas.filter(f => !f.doc).map(filaCliente);
  const res: Row[] = [];
  if (conDoc.length) res.push(...ok<Row[]>(await sb.from('clientes').upsert(conDoc, { onConflict: 'num_doc' }).select('*')));
  if (sinDoc.length) res.push(...ok<Row[]>(await sb.from('clientes').insert(sinDoc).select('*')));
  return res.map(clienteDesdeFila);
}

export async function agregarNota(clienteId: string, texto: string, autor: string): Promise<NotaCliente> {
  const sb = await db();
  return notaDesdeFila(ok<Row>(await sb.from('cliente_notas').insert({ cliente_id: Number(clienteId), texto, autor }).select('*').single()));
}

export async function crearTarea(t: Omit<Tarea, 'id' | 'hecha'>): Promise<Tarea> {
  const sb = await db();
  return tareaDesdeFila(ok<Row>(await sb.from('tareas').insert({
    cliente_id: t.clienteId ? Number(t.clienteId) : null,
    titulo: t.titulo,
    vence: t.vence,
    asignado_a: t.asignadoA ?? null,
    creado_por: t.creadoPor
  }).select('*').single()));
}

export async function marcarTarea(id: string, hecha: boolean) {
  const sb = await db();
  ok(await sb.from('tareas').update({ hecha, hecha_at: hecha ? new Date().toISOString() : null }).eq('id', Number(id)));
}

// ---------------- CRECER VENTAS ----------------

export async function guardarCotizacion(c: Cotizacion) {
  const sb = await db();
  ok(await sb.from('cotizaciones').insert({
    id: c.id, fecha: c.fecha, vence: c.vence, cliente_nombre: c.cliente.nombre, cliente_doc: c.cliente.doc ?? null,
    cliente_telefono: c.cliente.telefono ?? null, items: c.lineas, descuento_global: c.descuentoGlobal, total: c.total,
    estado: c.estado, notas: c.notas ?? null, creado_por: c.creadoPor
  }));
}

export async function marcarCotizacion(id: string, estado: Cotizacion['estado']) {
  const sb = await db();
  ok(await sb.from('cotizaciones').update({ estado }).eq('id', id));
}

export async function guardarCupon(c: Cupon) {
  const sb = await db();
  ok(await sb.from('cupones').insert({
    codigo: c.codigo, descripcion: c.descripcion ?? null, tipo: c.tipo, valor: c.valor, minimo_compra: c.minimoCompra,
    vence: c.vence ?? null, usos_max: c.usosMax ?? null, activo: c.activo
  }));
}

export async function activarCupon(codigo: string, activo: boolean) {
  const sb = await db();
  ok(await sb.from('cupones').update({ activo }).eq('codigo', codigo));
}

export async function guardarContrato(c: Contrato, creadoPor: string) {
  const sb = await db();
  ok(await sb.from('contratos').insert({
    id: c.id, cliente_nombre: c.cliente.nombre, cliente_doc: c.cliente.doc, cliente_telefono: c.cliente.telefono ?? null,
    direccion: c.direccion ?? null, servicio: c.servicio, monto_mensual: c.montoMensual, dia_cobro: c.diaCobro,
    visitas_mes: c.visitasMes, jardinero: c.jardinero ?? null, inicio: c.inicio, activo: c.activo, creado_por: creadoPor
  }));
}

export async function activarContrato(id: string, activo: boolean) {
  const sb = await db();
  ok(await sb.from('contratos').update({ activo }).eq('id', id));
}

// ---------------- TIENDA (gestión privada) ----------------

export async function actualizarSolicitud(id: string, cambios: { estado?: SolicitudTienda['estado']; pedidoId?: string; atendidaPor?: string }) {
  const sb = await db();
  const fila: Row = {};
  if (cambios.estado) fila.estado = cambios.estado;
  if (cambios.pedidoId) fila.pedido_id = cambios.pedidoId;
  if (cambios.atendidaPor) fila.atendida_por = cambios.atendidaPor;
  ok(await sb.from('solicitudes_tienda').update(fila).eq('id', Number(id)));
}

export async function guardarConfigTienda(c: ConfigTienda) {
  const sb = await db();
  ok(await sb.from('tienda_config').update({
    whatsapp: c.whatsapp || null, email: c.email || null, direccion: c.direccion || null, horario: c.horario || null,
    mensaje_portada: c.mensajePortada || null, updated_at: new Date().toISOString()
  }).eq('id', 1));
}

export async function guardarServicioPublico(sv: ServicioPublico) {
  const sb = await db();
  ok(await sb.from('servicios_publicos').upsert({
    slug: sv.slug, nombre: sv.nombre, resumen: sv.resumen, descripcion: sv.descripcion || null, imagen_url: sv.imagen || null,
    orden: sv.orden, visible: sv.visible, precio_desde: sv.precioDesde ?? null, updated_at: new Date().toISOString()
  }, { onConflict: 'slug' }));
}

export const tarifaDesdeFila = (r: Row): TarifaDelivery => ({ distrito: r.distrito, costo: num(r.costo), activo: !!r.activo });
const avisosDesdeFila = (r: Row | null): AvisosWhatsapp =>
  r ? { whatsapp: r.whatsapp ?? undefined, apikey: r.apikey ?? undefined, activo: !!r.activo, ultimoEnvio: r.ultimo_envio ?? undefined } : { activo: false };

export async function guardarAvisos(a: AvisosWhatsapp) {
  const sb = await db();
  ok(await sb.from('notificaciones_config').update({
    whatsapp: a.whatsapp || null, apikey: a.apikey || null, activo: a.activo, url_panel: window.location.origin, updated_at: new Date().toISOString()
  }).eq('id', 1));
}

export async function probarAviso(): Promise<boolean> {
  const sb = await db();
  return ok<boolean>(await sb.rpc('probar_aviso_whatsapp'));
}

export async function guardarTarifa(t: TarifaDelivery) {
  const sb = await db();
  ok(await sb.from('tarifas_delivery').upsert({ distrito: t.distrito, costo: t.costo, activo: t.activo, updated_at: new Date().toISOString() }, { onConflict: 'distrito' }));
}

export async function eliminarTarifa(distrito: string) {
  const sb = await db();
  ok(await sb.from('tarifas_delivery').delete().eq('distrito', distrito));
}

// ---------------- EMISIÓN EXTERNA ----------------
export async function registrarEmisionExterna(id: string, numero: string) {
  const sb = await db();
  ok(await sb.rpc('registrar_emision_externa', { p_id: id, p_numero: numero }));
}

export async function marcarComprobanteEnviado(id: string) {
  const sb = await db();
  ok(await sb.rpc('marcar_comprobante_enviado', { p_id: id }));
}

export async function registrarGuiaExterna(id: string, numero: string) {
  const sb = await db();
  ok(await sb.rpc('registrar_guia_externa', { p_id: id, p_numero: numero }));
}

// ---------------- PRODUCCIÓN PROPIA ----------------
export async function registrarProduccion(p: { sku: string; cantidad: number; insumos: { sku: string; cantidad: number }[]; costoAdicional: number; notas?: string; responsable: string }) {
  const sb = await db();
  return ok<{ numero: string; costo_insumos: number; costo_unitario: number }>(await sb.rpc('registrar_produccion', {
    p: { producto_sku: p.sku, cantidad: p.cantidad, insumos: p.insumos, costo_adicional: p.costoAdicional, notas: p.notas, responsable: p.responsable }
  }));
}

export async function cargarPartesProduccion(): Promise<ParteProduccion[]> {
  const sb = await db();
  return ok<Row[]>(await sb.from('partes_produccion').select('*').order('created_at', { ascending: false }).limit(200)).map(r => ({
    numero: r.numero, fecha: r.fecha, sku: r.producto_sku, cantidad: num(r.cantidad), costoInsumos: num(r.costo_insumos),
    costoAdicional: num(r.costo_adicional), costoUnitario: num(r.costo_unitario), insumos: r.insumos ?? [], notas: r.notas ?? undefined, responsable: r.responsable
  }));
}

/** Movimientos de un periodo para el libro 13.1 (sin el límite de la carga inicial). */
export async function cargarKardexHasta(hasta: string, nombres: Map<string, string>): Promise<KardexMovement[]> {
  const sb = await db();
  const filas: Row[] = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = ok<Row[]>(await sb.from('kardex_movimientos').select('*').lte('fecha_emision', hasta).order('id').range(desde, desde + 999));
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas.map(r => kardexDesdeFila(r, nombres));
}

// ---------------- CONTABILIDAD PCGE 2026 ----------------
/** Lee todas las filas de una consulta en lotes de 1 000 (límite por petición de la API). */
async function todas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const filas: Row[] = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = ok<Row[]>(await consulta(desde, desde + 999));
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}

export async function cargarPlanCuentas(): Promise<Cuenta[]> {
  const sb = await db();
  const filas = await todas((a, b) => sb.from('plan_cuentas').select('*').order('codigo').range(a, b));
  return filas.map(r => ({
    codigo: r.codigo, nombre: r.nombre, elemento: r.elemento, padre: r.padre ?? undefined, nivel: r.nivel,
    naturaleza: r.naturaleza, aceptaMovimiento: !!r.acepta_movimiento, personalizada: !!r.personalizada
  }));
}

export async function cargarCuentasExistencia(): Promise<CuentasExistencia[]> {
  const sb = await db();
  return ok<Row[]>(await sb.from('cuentas_existencia').select('*').order('tipo_existencia')).map(r => ({
    tipoExistencia: r.tipo_existencia, descripcion: r.descripcion, inventario: r.inventario, compra: r.compra ?? undefined, variacion: r.variacion ?? undefined,
    costoVenta: r.costo_venta, venta: r.venta, devolucionVenta: r.devolucion_venta, deterioro: r.deterioro, variacionProduccion: r.variacion_produccion ?? undefined
  }));
}

export async function cargarConfigContable(): Promise<Record<string, { cuenta: string; descripcion: string }>> {
  const sb = await db();
  return Object.fromEntries(ok<Row[]>(await sb.from('config_contable').select('*')).map(r => [r.clave, { cuenta: r.cuenta, descripcion: r.descripcion }]));
}

export async function cargarDiario(desde: string, hasta: string): Promise<Asiento[]> {
  const sb = await db();
  const filas = await todas((a, b) => sb.from('asientos').select('*, asiento_lineas(*)').gte('fecha', desde).lte('fecha', hasta).order('fecha').order('id').range(a, b));
  return filas.map(r => ({
    id: String(r.id), fecha: r.fecha, glosa: r.glosa, origen: r.origen, origenId: r.origen_id ?? undefined,
    tipoComprobante: r.sunat_tipo_comprobante ?? undefined, serie: r.comprobante_serie ?? undefined, numero: r.comprobante_numero ?? undefined,
    lineas: (r.asiento_lineas ?? []).sort((x: Row, y: Row) => x.id - y.id).map((l: Row) => ({ cuenta: l.cuenta, debe: num(l.debe), haber: num(l.haber), glosa: l.glosa ?? undefined }))
  }));
}

export async function guardarCuentasExistencia(c: CuentasExistencia) {
  const sb = await db();
  ok(await sb.from('cuentas_existencia').update({
    inventario: c.inventario, compra: c.compra || null, variacion: c.variacion || null, costo_venta: c.costoVenta, venta: c.venta,
    devolucion_venta: c.devolucionVenta, deterioro: c.deterioro, variacion_produccion: c.variacionProduccion || null
  }).eq('tipo_existencia', c.tipoExistencia));
}

export async function guardarConfigContable(clave: string, cuenta: string) {
  const sb = await db();
  ok(await sb.from('config_contable').update({ cuenta }).eq('clave', clave));
}

/** Divisionaria propia de la empresa (se cuelga de su prefijo; el padre deja de recibir movimientos). */
export async function crearSubcuenta(codigo: string, nombre: string) {
  const sb = await db();
  ok(await sb.from('plan_cuentas').insert({ codigo, nombre, elemento: Number(codigo[0]), personalizada: true }));
}

export async function registrarAsientoManual(p: { fecha: string; glosa: string; lineas: LineaAsiento[]; usuario: string }) {
  const sb = await db();
  return ok<number>(await sb.rpc('registrar_asiento_manual', { p: { fecha: p.fecha, glosa: p.glosa, lineas: p.lineas, usuario: p.usuario } }));
}

/** Quita un servicio de la tienda (las solicitudes antiguas conservan el texto del servicio). */
export async function eliminarServicioPublico(slug: string) {
  const sb = await db();
  ok(await sb.from('servicios_publicos').delete().eq('slug', slug));
}

/** Sube una foto al catálogo público (sólo el dueño) y devuelve su enlace https. */
export async function subirFotoCatalogo(archivo: Blob, carpeta: 'productos' | 'servicios', nombre: string): Promise<string> {
  const sb = await db();
  const ruta = `${carpeta}/${nombre.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}.jpg`;
  ok(await sb.storage.from('catalogo').upload(ruta, archivo, { contentType: 'image/jpeg', upsert: false }));
  return sb.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
}

/** Alta o edición de la ficha comercial de un producto (el stock sólo cambia por el Kardex). */
export async function guardarProductoCatalogo(p: CatalogProduct, nuevo: boolean): Promise<CatalogProduct> {
  const sb = await db();
  const fila: Row = {
    nombre: p.name, nombre_cientifico: p.scientificName || null, categoria: p.category, categoria_nombre: p.categoryName || null,
    familia_botanica: p.botanicalFamily || null, descripcion: p.description || null, imagen_url: p.fullImage || null,
    ubicacion_estante: p.location || null, costo_unitario: p.cost, precio_venta: p.price, stock_minimo: p.minStock,
    cuidado_luz: p.careLight || null, cuidado_riego: p.careWater || null, es_planta_viva: p.isLivePlant,
    visible_tienda: p.visibleTienda ?? true, destacado: !!p.destacado,
    tipo_existencia: p.tipoExistencia ?? (['sustratos', 'fertilizantes'].includes(p.category) ? '03' : '01'),
    unidad_medida: p.unidadMedida ?? 'NIU'
  };
  const q = nuevo
    ? sb.from('productos').insert({ ...fila, sku: p.sku, stock_actual: 0 }).select('*').single()
    : sb.from('productos').update(fila).eq('sku', p.sku).select('*').single();
  return productoDesdeFila(ok<Row>(await q));
}
