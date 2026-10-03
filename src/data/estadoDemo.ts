// ==========================================
// ESTADO DEL MODO DEMO (navegador)
// Liviano a propósito: lo usan el panel y también la tienda pública en demo,
// sin arrastrar el ERP completo al paquete de la tienda.
// ==========================================
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
  INITIAL_PUNTOS,
  INITIAL_CONFIG_TIENDA,
  INITIAL_SERVICIOS_PUBLICOS
} from './seed';
import type { ErpState } from '../store/ErpStore';
import type { Resena, SolicitudTienda } from '../domain/types';
import { hoyLocal } from '../lib/fechas';

export const STORAGE_KEY = 'aurevia.erp.v1';

export function seedState(): ErpState {
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
    puntosSaldo: INITIAL_PUNTOS,
    solicitudes: [],
    tiendaConfig: INITIAL_CONFIG_TIENDA,
    serviciosPublicos: INITIAL_SERVICIOS_PUBLICOS,
    tarifasDelivery: [],
    avisos: { activo: false },
    partesProduccion: [],
    gastos: [],
    asientosExtra: [],
    jardineros: [],
    serviciosJardinero: [],
    ejercicios: [],
    combos: [],
    eventos: [],
    metasVenta: {},
    vencimientos: [],
    resenas: [],
    recordatoriosEnviados: {},
    gastosCaja: INITIAL_CASH_REGISTER.egresos.map(e => ({ id: `${hoyLocal()}-${e.id}`, fecha: hoyLocal(), motivo: e.motivo, monto: e.monto, responsable: e.responsable }))
  };
}

// La Clave SOL nunca se guarda en el navegador.
export function cargarEstadoDemo(): ErpState {
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

export function guardarEstadoDemo(state: ErpState) {
  try {
    const { claveSol: _omit, ...company } = state.company;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, company }));
  } catch {
    // almacenamiento no disponible (modo privado): la app sigue en memoria
  }
}

/** La tienda demo deja su solicitud en el mismo almacenamiento; el panel la ve al instante (evento storage). */
export function agregarResenaDemo(r: Resena) {
  const s = cargarEstadoDemo();
  guardarEstadoDemo({ ...s, resenas: [r, ...(s.resenas ?? [])] });
}

export function agregarSolicitudDemo(sol: SolicitudTienda) {
  const s = cargarEstadoDemo();
  guardarEstadoDemo({ ...s, solicitudes: [sol, ...s.solicitudes] });
}
