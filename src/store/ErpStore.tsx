// ==========================================
// STORE CENTRAL DEL ERP
// Un solo lugar donde vive el estado del negocio y donde cada evento
// (venta, compra, baja, servicio) actualiza stock, Kardex, comprobantes y caja a la vez.
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
import { SunatBillingService } from '../services/sunatService';
import { sunatClient } from '../lib/sunatClient';
import { ViveroApi } from '../lib/supabase';

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

const STORAGE_KEY = 'aurevia.erp.v1';
const PROJECT_FLOW: ProjectStatus[] = ['COTIZADO', 'APROBADO', 'EN_EJECUCION', 'CONCLUIDO'];

const today = () => new Date().toISOString().split('T')[0];

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

/** Mueve stock de un producto y deja la huella en el Kardex. Función pura. */
function moverStock(
  s: ErpState,
  sku: string,
  qtyIn: number,
  qtyOut: number,
  movementType: MovementType,
  referenceDoc: string,
  responsibleUser: string,
  unitCost?: number
): ErpState {
  const prod = s.products.find(p => p.sku === sku);
  if (!prod) return s;
  const balance = Math.max(0, prod.stock + qtyIn - qtyOut);
  const movement: KardexMovement = {
    id: `KDX-${String(s.kardex.length + 1).padStart(5, '0')}`,
    date: today(),
    productSku: sku,
    productName: prod.name,
    movementType,
    quantityIn: qtyIn,
    quantityOut: prod.stock + qtyIn - balance,
    balance,
    unitCost: unitCost ?? prod.cost,
    referenceDoc,
    responsibleUser
  };
  return {
    ...s,
    products: s.products.map(p => (p.sku === sku ? { ...p, stock: balance } : p)),
    kardex: [movement, ...s.kardex]
  };
}

/** Sincronización best-effort de los movimientos nuevos (no-op sin backend). */
function syncKardex(prev: ErpState, next: ErpState) {
  const nuevos = next.kardex.slice(0, next.kardex.length - prev.kardex.length);
  nuevos.forEach(m => {
    void ViveroApi.addKardexMovement({
      producto_sku: m.productSku,
      tipo_movimiento: m.movementType,
      cantidad_entrada: m.quantityIn,
      cantidad_salida: m.quantityOut,
      saldo_resultante: m.balance,
      costo_unitario: m.unitCost,
      documento_referencia: m.referenceDoc,
      usuario_responsable: m.responsibleUser
    }).catch(() => {});
  });
}

function syncComprobante(inv: ComprobanteSunat) {
  void ViveroApi.upsertComprobante({
    id: inv.id,
    tipo_comprobante: inv.tipoComprobante,
    serie: inv.serie,
    correlativo: inv.correlativo,
    fecha_emision: inv.fechaEmision,
    cliente: inv.cliente.nombreRazonSocial,
    op_gravadas: inv.opGravadas,
    total_igv: inv.totalIgv,
    monto_total: inv.montoTotal,
    estado_sunat: inv.estadoSunat,
    hash_cpe: inv.hashCpe
  }).catch(() => {});
}

/** Emite el CPE en SUNAT y sella la CDR de respuesta. */
async function emitirCpe(
  company: EmpresaConfig,
  invoices: ComprobanteSunat[],
  tipo: '01' | '03' | 'NV',
  cliente: { numDoc: string; nombre: string; direccion: string },
  items: { sku: string; name: string; quantity: number; priceWithIgv: number }[]
): Promise<ComprobanteSunat> {
  const serie = tipo === '01' ? company.serieFactura : tipo === '03' ? company.serieBoleta : 'NV01';
  const correlativo = invoices.filter(i => i.serie === serie).length + 101;
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
  syncComprobante(inv);
  return inv;
}

async function emitirGre(
  company: EmpresaConfig,
  guias: GuiaRemisionSunat[],
  data: { tipoDoc: '1' | '6'; numDoc: string; nombre: string; direccionLlegada: string; placa: string; motivo: string; items: { sku: string; descripcion: string; cantidad: number }[] }
): Promise<GuiaRemisionSunat> {
  const correlativo = guias.length + 15;
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

function useErpActions(get: () => ErpState, commit: (next: ErpState) => void) {
  return useMemo(() => ({
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

      const invoice = await emitirCpe(
        s.company,
        s.invoices,
        v.tipoComprobante,
        { numDoc: v.docIdentidad, nombre: v.clientName, direccion: 'Lima, Perú' },
        [{ sku: prod.sku, name: prod.name, quantity: v.qty, priceWithIgv: prod.price }]
      );

      const gre = v.generarGre
        ? await emitirGre(get().company, get().guiasRemision, {
            tipoDoc: v.tipoComprobante === '01' ? '6' : '1',
            numDoc: v.docIdentidad,
            nombre: v.clientName,
            direccionLlegada: 'Dirección de Entrega Lima',
            placa: 'BZF-412',
            motivo: `Despacho Venta ${invoice.id}`,
            items: [{ sku: prod.sku, descripcion: prod.name, cantidad: v.qty }]
          })
        : null;

      const prev = get();
      let next = moverStock(prev, prod.sku, 0, v.qty, 'Venta Cliente', invoice.id, 'POS Aurevia');
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
      syncKardex(prev, next);
      return { ok: true, invoice };
    },

    registrarEgreso(motivo: string, monto: number): Result {
      if (!motivo || monto <= 0) return { ok: false, error: 'Indica el motivo y un monto mayor a cero.' };
      const s = get();
      const caja = s.cashRegister;
      commit({
        ...s,
        cashRegister: {
          ...caja,
          egresos: [
            ...caja.egresos,
            { id: `EG-${String(caja.egresos.length + 1).padStart(2, '0')}`, motivo, monto, hora: new Date().toTimeString().slice(0, 5), responsable: 'Administración' }
          ],
          conteoRealEfectivo: caja.conteoRealEfectivo - monto
        }
      });
      return { ok: true };
    },

    setConteoCaja(conteoRealEfectivo: number) {
      const s = get();
      commit({ ...s, cashRegister: { ...s.cashRegister, conteoRealEfectivo } });
    },

    cuadrarCaja() {
      const s = get();
      commit({ ...s, cashRegister: { ...s.cashRegister, estadoCaja: 'CUADRADA' } });
    },

    // ---------------- INVENTARIO ----------------
    registrarCompra(c: CompraInput): Result<{ igv: number; productName: string }> {
      const s = get();
      const prod = s.products.find(p => p.sku === c.sku);
      if (!prod) return { ok: false, error: 'Producto no encontrado.' };
      // El crédito fiscal (RCE / SIRE) sólo procede con un RUC de proveedor válido
      if (!validarRuc(c.ruc)) {
        return { ok: false, error: '⚠️ El RUC del proveedor no es válido (11 dígitos, módulo 11). Sin RUC válido la compra no genera crédito fiscal en el RCE.' };
      }
      const gravada = c.qty * c.costoUnitario;
      const igv = round2(gravada * 0.18);
      let next = moverStock(s, c.sku, c.qty, 0, 'Compra Proveedor', c.numeroFactura, 'Almacén Aurevia', c.costoUnitario);
      next = {
        ...next,
        purchases: [
          { id: c.numeroFactura, proveedor: c.proveedor, ruc: c.ruc, fecha: today(), gravada, igv, total: gravada + igv, items: `${c.qty}x ${prod.name}` },
          ...next.purchases
        ]
      };
      commit(next);
      syncKardex(s, next);
      return { ok: true, igv, productName: prod.name };
    },

    registrarBaja(b: BajaInput): Result<{ loss: BiologicalLoss }> {
      const s = get();
      const prod = s.products.find(p => p.sku === b.sku);
      if (!prod) return { ok: false, error: 'Producto no encontrado.' };
      if (prod.stock < b.qty) {
        return { ok: false, error: `¡No puedes dar de baja más unidades de las disponibles! Stock actual: ${prod.stock}` };
      }
      const cuarentena = b.type === 'CUARENTENA_FITOSANITARIA';
      const loss: BiologicalLoss = {
        id: `BAJ-2026-${String(s.losses.length + 3).padStart(3, '0')}`,
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
      // La cuarentena aísla la planta pero no la saca del inventario
      let next = cuarentena ? s : moverStock(s, b.sku, 0, b.qty, 'Baja por Perdida', loss.id, 'Almacén Aurevia');
      next = { ...next, losses: [loss, ...next.losses] };
      commit(next);
      syncKardex(s, next);
      return { ok: true, loss };
    },

    async emitirGuia(g: GreInput): Promise<Result<{ gre: GuiaRemisionSunat }>> {
      const s = get();
      const prod = s.products.find(p => p.sku === g.sku);
      if (!prod) return { ok: false, error: 'Producto no encontrado.' };
      const gre = await emitirGre(s.company, s.guiasRemision, {
        tipoDoc: g.docDestinatario.length === 11 ? '6' : '1',
        numDoc: g.docDestinatario,
        nombre: g.destinatario,
        direccionLlegada: g.direccionLlegada,
        placa: g.placa,
        motivo: 'Venta y Entrega Botánica a Domicilio',
        items: [{ sku: prod.sku, descripcion: prod.name, cantidad: g.qty }]
      });
      const cur = get();
      commit({ ...cur, guiasRemision: [gre, ...cur.guiasRemision] });
      return { ok: true, gre };
    },

    // ---------------- SERVICIOS ----------------
    avanzarProyecto(id: string) {
      const s = get();
      commit({
        ...s,
        projects: s.projects.map(p => {
          if (p.id !== id) return p;
          const i = PROJECT_FLOW.indexOf(p.status);
          return { ...p, status: PROJECT_FLOW[Math.min(i + 1, PROJECT_FLOW.length - 1)] };
        })
      });
    },

    descargarMaterialesProyecto(id: string): Result<{ project: GardeningProject }> {
      const s = get();
      const proj = s.projects.find(p => p.id === id);
      if (!proj || proj.stockDeducted) return { ok: false, error: 'Los insumos de este proyecto ya fueron descargados.' };
      let next = s;
      proj.materials.forEach(mat => {
        next = moverStock(next, mat.sku, 0, mat.qty, 'Servicio Jardineria', proj.id, 'Jardinería Aurevia');
      });
      next = { ...next, projects: next.projects.map(p => (p.id === id ? { ...p, stockDeducted: true } : p)) };
      commit(next);
      syncKardex(s, next);
      return { ok: true, project: proj };
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

      const invoice = await emitirCpe(
        s.company,
        s.invoices,
        esFactura ? '01' : '03',
        { numDoc: proj.doc, nombre: proj.client, direccion: proj.address },
        [{ sku: 'SRV-PAIS', name: `Servicio de ${proj.type} - ${proj.address}`, quantity: 1, priceWithIgv: proj.total }]
      );

      const cur = get();
      // Detracción SPOT: sólo en facturas por servicios cuyo importe supera S/ 700
      const det = calcularDetraccion(proj.total, cur.company.tasaDetraccionServicios);
      const fecha = today();
      const detracciones: DetraccionRecord[] =
        esFactura && det.aplica
          ? [
              {
                id: `DET-2026-${String(cur.detracciones.length + 1).padStart(3, '0')}`,
                facturaId: invoice.id,
                cliente: proj.client,
                rucCliente: proj.doc,
                fechaEmision: fecha,
                fechaVencimientoBn: vencimientoDetraccion(fecha),
                montoFactura: proj.total,
                tasa: cur.company.tasaDetraccionServicios,
                montoDetraccion: det.montoDetraccion,
                estado: 'PENDIENTE'
              },
              ...cur.detracciones
            ]
          : cur.detracciones;

      commit({
        ...cur,
        invoices: [invoice, ...cur.invoices],
        detracciones,
        projects: cur.projects.map(p => (p.id === id ? { ...p, invoiceId: invoice.id } : p))
      });
      return { ok: true, invoice };
    },

    // ---------------- ADMINISTRACIÓN ----------------
    registrarConstanciaDetraccion(id: string) {
      const s = get();
      commit({
        ...s,
        detracciones: s.detracciones.map(d =>
          d.id === id
            ? { ...d, estado: 'DEPOSITADO', constanciaBn: `BN-${Math.floor(10000000 + Math.random() * 90000000)}`, fechaDeposito: today() }
            : d
        )
      });
    },

    setRegimen(regimenTributario: RegimenTributario) {
      commit({ ...get(), regimenTributario });
    },

    updateCompany(patch: Partial<EmpresaConfig>) {
      const s = get();
      commit({ ...s, company: { ...s.company, ...patch } });
    },

    guardarEmpresa() {
      const { company } = get();
      // Propagar credenciales al conector SUNAT sin recargar la app
      sunatClient.updateConfig({
        ruc: company.ruc,
        razonSocial: company.razonSocial,
        usuarioSol: company.usuarioSol,
        claveSol: company.claveSol,
        modo: company.sunatAmbiente
      });
      // Persistir configuración fiscal (no-op si no hay backend configurado)
      void ViveroApi.saveCompanyConfig({
        ruc: company.ruc,
        razon_social: company.razonSocial,
        nombre_comercial: company.nombreComercial,
        direccion: company.direccion,
        ubigeo: company.ubigeo,
        sunat_ambiente: company.sunatAmbiente,
        serie_boleta: company.serieBoleta,
        serie_factura: company.serieFactura,
        serie_gre: company.serieGre
      }).catch(() => {});
    },

    restablecerDemo() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // sin almacenamiento: basta con reiniciar el estado
      }
      commit(seedState());
    }
  }), [get, commit]);
}

export type ErpActions = ReturnType<typeof useErpActions>;

const ErpContext = createContext<{ state: ErpState; actions: ErpActions } | null>(null);

export function ErpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErpState>(loadState);
  const stateRef = useRef(state);

  const get = useCallback(() => stateRef.current, []);
  const commit = useCallback((next: ErpState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const actions = useErpActions(get, commit);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp debe usarse dentro de <ErpProvider>');
  return ctx;
}
