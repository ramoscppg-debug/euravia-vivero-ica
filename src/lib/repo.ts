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
  ComprobanteSunat,
  CrmClient,
  DetraccionRecord,
  EmpresaConfig,
  GardeningProject,
  GuiaRemisionSunat,
  KardexMovement,
  MovementType,
  NotaCliente,
  Tarea,
  Pedido,
  ProjectStatus,
  Purchase,
  RegimenTributario
} from '../domain/types';
import { emisorDe } from '../domain/types';
import { INITIAL_COMPANY_CONFIG } from '../data/seed';
import type { Rol } from '../domain/types';
import { round2 } from './peru';
import { getSupabase } from './supabase';

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
}

export async function cargarTodo(): Promise<DatosNube> {
  const sb = await db();
  const [empresa, productos, kardex, comprobantes, compras, bajas, detracciones, clientes, servicios, guias, caja, pedidos, notas, tareas] = await Promise.all([
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
    sb.from('tareas').select('*').order('vence').limit(500)
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
    tareas: ok<Row[]>(tareas).map(tareaDesdeFila)
  };
}

function empresaDesdeFila(r: Row | null): EmpresaConfig {
  const base = INITIAL_COMPANY_CONFIG;
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
    tasaDetraccionServicios: r.tasa_detraccion != null ? num(r.tasa_detraccion) : base.tasaDetraccionServicios
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
    stock: r.stock_actual,
    minStock: r.stock_minimo,
    location: r.ubicacion_estante ?? '',
    careLight: r.cuidado_luz ?? undefined,
    careWater: r.cuidado_riego ?? undefined,
    isLivePlant: !!r.es_planta_viva,
    fullImage: r.imagen_url ?? IMAGEN_POR_DEFECTO,
    description: r.descripcion ?? '',
    botanicalFamily: r.familia_botanica ?? '',
    categoryName: r.categoria_nombre ?? r.categoria
  };
}

function kardexDesdeFila(r: Row, nombres: Map<string, string>): KardexMovement {
  return {
    id: `KDX-${String(r.id).padStart(5, '0')}`,
    date: String(r.fecha).slice(0, 10),
    productSku: r.producto_sku,
    productName: nombres.get(r.producto_sku) ?? r.producto_sku,
    movementType: r.tipo_movimiento as MovementType,
    quantityIn: r.cantidad_entrada ?? 0,
    quantityOut: r.cantidad_salida ?? 0,
    balance: r.saldo_resultante,
    unitCost: num(r.costo_unitario),
    referenceDoc: r.documento_referencia ?? undefined,
    responsibleUser: r.usuario_responsable
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
    motivo: r.motivo ?? undefined
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
    entregadoAt: r.entregado_at ?? undefined
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
        pedido_id: c.pedidoId ?? null
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
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' }));
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
