// ==========================================
// CÁLCULOS DERIVADOS (puros): finanzas, planilla, caja, pendientes del día
// ==========================================
import {
  ASIGNACION_FAMILIAR,
  beneficiosPorRegimen,
  calcularAportePension,
  calcularAporteSalud,
  calcularPagoCuentaRenta,
  calcularRenta5ta,
  regimenUsaIgv,
  round2
} from '../lib/peru';
import type { CashRegisterState, RegimenTributario, TrabajadorAurevia } from '../domain/types';
import type { ErpState } from './ErpStore';
import { porFacturar } from '../lib/contratos';
import { hoyLocal, periodoLocal, sumarDias } from '../lib/fechas';

export const REGIMEN_LABELS: Record<RegimenTributario, string> = {
  NRUS: 'Nuevo RUS (NRUS)',
  RER: 'Régimen Especial (RER)',
  RMT: 'MYPE Tributario (RMT)',
  RG: 'Régimen General (RG)'
};

/** Periodo tributario actual en formato YYYY-MM. */
export const periodoActual = () => periodoLocal();

/** Pre-liquidación del mes: sólo cuentan los comprobantes y compras del periodo. */
export function calcularFinanzas(estado: ErpState, periodo = periodoActual()) {
  const s = {
    ...estado,
    invoices: estado.invoices.filter(i => i.fechaEmision.startsWith(periodo)),
    purchases: estado.purchases.filter(p => p.fecha.startsWith(periodo))
  };
  // Las notas de crédito (07) restan del periodo
  const signo = (inv: { tipoComprobante: string }) => (inv.tipoComprobante === '07' ? -1 : 1);
  const totalVentas = s.invoices.reduce((acc, inv) => acc + signo(inv) * inv.montoTotal, 0);
  const totalVentasGravadas = s.invoices.reduce((acc, inv) => acc + signo(inv) * inv.opGravadas, 0);
  const totalIgvVentas = s.invoices.reduce((acc, inv) => acc + signo(inv) * inv.totalIgv, 0);
  const totalCompras = s.purchases.reduce((acc, pur) => acc + pur.total, 0);
  const totalIgvCompras = s.purchases.reduce((acc, pur) => acc + pur.igv, 0);

  // IGV: NRUS no genera débito/crédito fiscal
  const usaIgv = regimenUsaIgv(s.regimenTributario);
  const igvNetoPagar = usaIgv ? Math.max(0, totalIgvVentas - totalIgvCompras) : 0;

  // Pago a cuenta del Impuesto a la Renta según régimen tributario vigente
  const pagoCuentaRentaDetalle = calcularPagoCuentaRenta(s.regimenTributario, totalVentasGravadas, totalVentasGravadas);
  const pagoCuentaRenta = pagoCuentaRentaDetalle.monto;

  return {
    totalVentas,
    totalVentasGravadas,
    totalIgvVentas,
    totalCompras,
    totalIgvCompras,
    usaIgv,
    igvNetoPagar,
    pagoCuentaRentaDetalle,
    pagoCuentaRenta,
    totalImpuestosMes: igvNetoPagar + pagoCuentaRenta,
    periodo,
    invoicesPeriodo: s.invoices,
    purchasesPeriodo: s.purchases,
    regimenLabel: REGIMEN_LABELS[s.regimenTributario]
  };
}

// Planilla, aportes y provisiones — según régimen laboral (Ley MYPE)
export function calcularPlanillaMes(employees: TrabajadorAurevia[]) {
  let totalBruto = 0;
  let totalEssalud = 0;
  let totalAfpRetenido = 0;
  let totalOnpRetenido = 0;
  let totalRenta5ta = 0;
  let totalNetoTrabajadores = 0;
  let provCtsMensual = 0;
  let provGratiMensual = 0;
  let provVacacionesMensual = 0;

  const detalle = employees.map(emp => {
    const beneficios = beneficiosPorRegimen(emp.regimenLaboral);
    const asigFam = emp.asignacionFamiliar && beneficios.asignacionFamiliarAplica ? ASIGNACION_FAMILIAR : 0;
    const bruto = round2(emp.sueldoBasico + asigFam);
    totalBruto += bruto;

    // Aporte previsional del trabajador (AFP con comisión por AFP y prima con tope, u ONP 13%)
    const pension = calcularAportePension(bruto, emp.sistemaPension);
    if (pension.sistema === 'ONP') totalOnpRetenido += pension.total;
    else totalAfpRetenido += pension.total;

    // Retención de renta de 5ta categoría (proyección con/sin gratificaciones)
    const sueldosProyectados = beneficios.gratiFactorMensual > 0 ? 14 : 12;
    const renta5ta = calcularRenta5ta(bruto, sueldosProyectados);
    totalRenta5ta += renta5ta;

    const neto = round2(bruto - pension.total - renta5ta);
    const aporteSalud = calcularAporteSalud(bruto, emp.regimenLaboral); // EsSalud 9% o SIS S/ 15
    totalEssalud += aporteSalud;
    totalNetoTrabajadores += neto;

    provCtsMensual += bruto * beneficios.ctsFactorMensual;
    provGratiMensual += bruto * beneficios.gratiFactorMensual;
    provVacacionesMensual += bruto * beneficios.vacacionesFactorMensual;

    return {
      ...emp,
      regimenEtiqueta: beneficios.etiqueta,
      bruto,
      descPension: pension.total,
      aporteFondo: pension.aporteFondo,
      primaSeguro: pension.primaSeguro,
      comisionAfp: pension.comision,
      renta5ta,
      neto,
      essalud: aporteSalud
    };
  });

  provCtsMensual = round2(provCtsMensual);
  provGratiMensual = round2(provGratiMensual);
  provVacacionesMensual = round2(provVacacionesMensual);
  const provTotalMensual = round2(provCtsMensual + provGratiMensual + provVacacionesMensual);

  return {
    detalle,
    totalBruto: round2(totalBruto),
    totalEssalud: round2(totalEssalud),
    totalAfpRetenido: round2(totalAfpRetenido),
    totalOnpRetenido: round2(totalOnpRetenido),
    totalRenta5ta: round2(totalRenta5ta),
    totalNetoTrabajadores: round2(totalNetoTrabajadores),
    provCtsMensual,
    provGratiMensual,
    provVacacionesMensual,
    provTotalMensual,
    costoTotalPlanilla: round2(totalBruto + totalEssalud + provTotalMensual)
  };
}

export type PlanillaMes = ReturnType<typeof calcularPlanillaMes>;

export function calcularCaja(caja: CashRegisterState) {
  const totalEgresosCaja = caja.egresos.reduce((acc, eg) => acc + eg.monto, 0);
  const saldoTeoricoEfectivo = caja.aperturaEfectivo + caja.ventasEfectivo - totalEgresosCaja;
  const diferenciaCaja = round2(caja.conteoRealEfectivo - saldoTeoricoEfectivo);
  return { totalEgresosCaja, saldoTeoricoEfectivo, diferenciaCaja };
}

/** Lo que el dueño debe atender hoy: una sola lista accionable para el panel de inicio. */
export function calcularPendientes(s: ErpState) {
  return {
    stockBajo: s.products.filter(p => p.stock <= p.minStock),
    proyectosPorDescargar: s.projects.filter(p => !p.stockDeducted && (p.status === 'APROBADO' || p.status === 'EN_EJECUCION')),
    proyectosPorFacturar: s.projects.filter(p => !p.invoiceId && p.status !== 'COTIZADO'),
    detraccionesPendientes: s.detracciones.filter(d => d.estado === 'PENDIENTE'),
    clientesUrgentes: s.crmClients.filter(c => c.urgency === 'ALTA'),
    tareasVencidas: s.tareas.filter(t => !t.hecha && t.vence <= hoyLocal()),
    contratosPorFacturar: s.contratos.filter(c => porFacturar(c)),
    cotizacionesPorVencer: s.cotizaciones.filter(c => (c.estado === 'ENVIADA' || c.estado === 'ACEPTADA') && c.vence <= sumarDias(hoyLocal(), 2)),
    pedidosPorCobrar: s.pedidos.filter(p => p.estado === 'pendiente'),
    pedidosParaEntregar: s.pedidos.filter(p => ['pagado', 'preparando', 'en-reparto'].includes(p.estado) && p.fechaEntrega <= hoyLocal())
  };
}
