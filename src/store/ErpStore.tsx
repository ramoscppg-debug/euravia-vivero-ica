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
  INITIAL_PURCHASES
} from '../data/seed';
import type {
  BiologicalLoss,
  CashRegisterState,
  CatalogProduct,
  ComprobanteSunat,
  CrmClient,
  DetraccionRecord,
  EmpresaConfig,
  GardeningMaterialItem,
  GardeningProject,
  GuiaRemisionSunat,
  InternalConsumption,
  KardexMovement,
  MovementType,
  ProjectStatus,
  Purchase,
  RegimenTributario,
  TrabajadorAurevia
} from '../domain/types';
import { calcularDetraccion, round2, validarDni, validarRuc, vencimientoDetraccion } from '../lib/peru';
import * as repo from '../lib/repo';
import { SunatBillingService } from '../services/sunatService';
import { sunatClient } from '../lib/sunatClient';

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
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface VentaInput {
  sku: string;
  qty: number;
  tipoComprobante: '01' | '03' | 'NV';
  docIdentidad: string;
  clientName: string;
  payment: string;
  generarGre: boolean;
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

const today = () => new Date().toISOString().split('T')[0];
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
    kardex: INITIAL_KARDEX
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
    kardex: []
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
  tipo: '01' | '03' | 'NV',
  serie: string,
  correlativo: number,
  cliente: { numDoc: string; nombre: string; direccion: string },
  items: { sku: string; name: string; quantity: number; priceWithIgv: number }[]
): Promise<ComprobanteSunat> {
  const inv = SunatBillingService.createInvoice({
    tipoComprobante: tipo,
    serie,
    correlativo,
    cliente: { tipoDoc: tipo === '01' ? '6' : '1', numDoc: cliente.numDoc, nombre: cliente.nombre, direccion: cliente.direccion },
    items
  });
  inv.emisor = company;
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
    emisor: company,
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
      async registrarVenta(v: VentaInput): Promise<Result<{ invoice: ComprobanteSunat }>> {
        const s = get();
        const prod = s.products.find(p => p.sku === v.sku);
        if (!prod) return { ok: false, error: 'Producto no encontrado.' };
        if (prod.stock < v.qty) {
          return { ok: false, error: `¡Stock insuficiente! Disponible: ${prod.stock} unidades de ${prod.name}` };
        }
        // Validación del documento del adquirente según tipo de comprobante (SUNAT)
        if (v.tipoComprobante === '01' && !validarRuc(v.docIdentidad)) {
          return { ok: false, error: '⚠️ La Factura Electrónica requiere un RUC válido de 11 dígitos (módulo 11). Verifique el documento del cliente.' };
        }
        if (v.tipoComprobante === '03' && prod.price * v.qty > 700 && !validarDni(v.docIdentidad)) {
          return { ok: false, error: '⚠️ En Boletas por importes mayores a S/ 700 es obligatorio identificar al cliente con DNI (8 dígitos).' };
        }

        try {
          const serie = v.tipoComprobante === '01' ? s.company.serieFactura : v.tipoComprobante === '03' ? s.company.serieBoleta : 'NV01';
          const invoice = await emitirCpe(
            s.company,
            v.tipoComprobante,
            serie,
            await correlativo(serie),
            { numDoc: v.docIdentidad, nombre: v.clientName, direccion: 'Lima, Perú' },
            [{ sku: prod.sku, name: prod.name, quantity: v.qty, priceWithIgv: prod.price }]
          );

          const gre = v.generarGre
            ? await emitirGre(s.company, s.guiasRemision, {
                tipoDoc: v.tipoComprobante === '01' ? '6' : '1',
                numDoc: v.docIdentidad,
                nombre: v.clientName,
                direccionLlegada: 'Dirección de Entrega Lima',
                placa: 'BZF-412',
                motivo: `Despacho Venta ${invoice.id}`,
                items: [{ sku: prod.sku, descripcion: prod.name, cantidad: v.qty }]
              })
            : null;

          // El Kardex va primero: si el servidor no tiene stock, no se registra nada más
          let next = await moverInventario([
            { sku: prod.sku, qtyIn: 0, qtyOut: v.qty, type: 'Venta Cliente', doc: invoice.id, user: responsable('POS Aurevia'), unitCost: prod.cost }
          ]);
          if (nube) {
            await repo.guardarComprobante(invoice, { medioPago: v.payment });
            await repo.guardarCaja({ tipo: 'INGRESO', monto: invoice.montoTotal, medioPago: v.payment, concepto: `Venta ${invoice.id}`, comprobanteId: invoice.id, responsable: usuario });
            if (gre) await repo.guardarGuia(gre, invoice.id);
            registrarClienteEnNube({ nombre: v.clientName, numDoc: v.docIdentidad });
          }

          const caja = { ...next.cashRegister };
          const monto = invoice.montoTotal;
          if (v.payment === 'Efectivo') {
            caja.ventasEfectivo += monto;
            caja.conteoRealEfectivo += monto;
          } else if (['Yape', 'Plin'].includes(v.payment)) caja.ventasBilleteras += monto;
          else if (v.payment === 'Tarjeta') caja.ventasTarjetas += monto;
          else caja.ventasTransferencias += monto;
          next = {
            ...next,
            cashRegister: caja,
            invoices: [invoice, ...next.invoices],
            guiasRemision: gre ? [gre, ...next.guiasRemision] : next.guiasRemision
          };
          commit(next);
          return { ok: true, invoice };
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
