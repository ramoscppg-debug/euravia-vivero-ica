/**
 * ============================================================================
 * PARÁMETROS Y CÁLCULOS TRIBUTARIO-LABORALES DEL PERÚ
 * Normativa vigente 2025 (revisar al publicarse los valores 2026)
 * ============================================================================
 *
 * Fuentes:
 *  - UIT 2025 = S/ 5 350  (D.S. N° 260-2024-EF)
 *  - RMV      = S/ 1 130  desde 01/01/2025  (D.S. N° 007-2024-TR)
 *  - Asignación Familiar = 10% RMV  (Ley N° 25129) — NO aplica a microempresa
 *  - IGV = 18% (16% IGV + 2% IPM)
 *  - ONP = 13%  |  AFP: aporte al fondo 10% + prima de seguro + comisión
 *  - EsSalud = 9% (régimen general y pequeña empresa)
 *  - Microempresa REMYPE: SIS semicontributivo, aporte del empleador S/ 15/mes
 *  - CTS / Gratificaciones / Vacaciones: según régimen laboral (D.Leg. 1086 - Ley MYPE)
 *  - Detracción SPOT "demás servicios gravados con IGV" (Anexo 3, cód. 037) = 12%, umbral > S/ 700
 */

import type { RegimenLaboral, SistemaPension } from '../types/payroll';

// ---------------------------------------------------------------------------
// CONSTANTES MACRO
// ---------------------------------------------------------------------------
export const UIT = 5350; // S/ — UIT 2025
export const RMV = 1130; // S/ — Remuneración Mínima Vital vigente
export const ASIGNACION_FAMILIAR = Math.round(RMV * 0.10 * 100) / 100; // S/ 113.00
export const IGV_RATE = 0.18;

/** Aporte del empleador al SIS (semicontributivo) por trabajador de microempresa. */
export const APORTE_SIS_MICRO = 15;

// ---------------------------------------------------------------------------
// SISTEMA PRIVADO DE PENSIONES (AFP) — valores referenciales vigentes
// La comisión por flujo y la prima varían por resolución SBS; son editables.
// ---------------------------------------------------------------------------
export const AFP_APORTE_FONDO = 0.10; // 10% obligatorio
export const AFP_PRIMA_SEGURO = 0.0174; // 1.74% (sujeto a tope de remuneración asegurable)
export const AFP_TOPE_SEGURO = 13000; // S/ — tope referencial de la remuneración asegurable

/** Comisión sobre flujo por AFP (%). */
export const AFP_COMISION_FLUJO: Record<Exclude<SistemaPension, 'ONP'>, number> = {
  HABITAT: 0.0147,
  INTEGRA: 0.0155,
  PRIMA: 0.016,
  PROFUTURO: 0.0169,
};

export const ONP_RATE = 0.13;
export const ESSALUD_RATE = 0.09;

// ---------------------------------------------------------------------------
// VALIDACIÓN DE DOCUMENTOS DE IDENTIDAD
// ---------------------------------------------------------------------------

/** DNI: 8 dígitos numéricos. */
export function validarDni(dni: string): boolean {
  return /^\d{8}$/.test((dni || '').trim());
}

/**
 * RUC: 11 dígitos + dígito verificador por módulo 11.
 * Prefijos válidos: 10 (persona natural), 15/17 (no domiciliado), 20 (persona jurídica).
 */
export function validarRuc(ruc: string): boolean {
  const value = (ruc || '').trim();
  if (!/^\d{11}$/.test(value)) return false;
  if (!['10', '15', '17', '20'].includes(value.slice(0, 2))) return false;

  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = factores.reduce((acc, f, i) => acc + f * Number(value[i]), 0);
  const resto = suma % 11;
  const dv = 11 - resto;
  const digitoEsperado = dv === 10 ? 0 : dv === 11 ? 1 : dv;
  return digitoEsperado === Number(value[10]);
}

// ---------------------------------------------------------------------------
// APORTES PREVISIONALES DEL TRABAJADOR
// ---------------------------------------------------------------------------
export interface DesglosePension {
  sistema: 'AFP' | 'ONP';
  aporteFondo: number;
  primaSeguro: number;
  comision: number;
  total: number;
}

export function calcularAportePension(bruto: number, sistema: SistemaPension): DesglosePension {
  if (sistema === 'ONP') {
    const total = round2(bruto * ONP_RATE);
    return { sistema: 'ONP', aporteFondo: total, primaSeguro: 0, comision: 0, total };
  }
  const baseSeguro = Math.min(bruto, AFP_TOPE_SEGURO);
  const aporteFondo = round2(bruto * AFP_APORTE_FONDO);
  const primaSeguro = round2(baseSeguro * AFP_PRIMA_SEGURO);
  const comision = round2(bruto * (AFP_COMISION_FLUJO[sistema] ?? AFP_COMISION_FLUJO.INTEGRA));
  return {
    sistema: 'AFP',
    aporteFondo,
    primaSeguro,
    comision,
    total: round2(aporteFondo + primaSeguro + comision),
  };
}

// ---------------------------------------------------------------------------
// BENEFICIOS SOCIALES SEGÚN RÉGIMEN LABORAL (Ley MYPE - D.Leg. 1086)
// ---------------------------------------------------------------------------
export interface BeneficiosRegimen {
  etiqueta: string;
  asignacionFamiliarAplica: boolean;
  /** 'ESSALUD' = 9% patronal · 'SIS' = aporte fijo S/ 15 (microempresa). */
  saludTipo: 'ESSALUD' | 'SIS';
  /** Factor mensual de provisión de CTS respecto de la remuneración computable. */
  ctsFactorMensual: number;
  /** Factor mensual de provisión de gratificaciones (incluye bonif. extraord. Ley 30334). */
  gratiFactorMensual: number;
  /** Factor mensual de provisión de vacaciones. */
  vacacionesFactorMensual: number;
  vacacionesDias: number;
}

const CTS_ANUAL_GENERAL = 1; // 1 sueldo/año (aprox. 1/12 mensual)
const GRATI_ANUAL_GENERAL = 2; // 2 sueldos/año (Fiestas Patrias + Navidad)
const BONIF_EXTRAORD = 0.09; // 9% de la gratificación (aporte EsSalud que recibe el trabajador)

export function beneficiosPorRegimen(regimen: RegimenLaboral): BeneficiosRegimen {
  switch (regimen) {
    case 'MYPE_MICRO':
      return {
        etiqueta: 'Microempresa REMYPE',
        asignacionFamiliarAplica: false,
        saludTipo: 'SIS',
        ctsFactorMensual: 0, // sin CTS
        gratiFactorMensual: 0, // sin gratificaciones
        vacacionesFactorMensual: 0.5 / 12, // 15 días/año
        vacacionesDias: 15,
      };
    case 'MYPE_PEQUENA':
      return {
        etiqueta: 'Pequeña empresa REMYPE',
        asignacionFamiliarAplica: true,
        saludTipo: 'ESSALUD',
        ctsFactorMensual: 0.5 / 12, // ½ sueldo/año
        gratiFactorMensual: (1 * (1 + BONIF_EXTRAORD)) / 12, // ½+½ sueldo/año + 9%
        vacacionesFactorMensual: 0.5 / 12, // 15 días/año
        vacacionesDias: 15,
      };
    case 'REGIMEN_GENERAL':
    default:
      return {
        etiqueta: 'Régimen general',
        asignacionFamiliarAplica: true,
        saludTipo: 'ESSALUD',
        ctsFactorMensual: CTS_ANUAL_GENERAL / 12,
        gratiFactorMensual: (GRATI_ANUAL_GENERAL * (1 + BONIF_EXTRAORD)) / 12,
        vacacionesFactorMensual: 1 / 12, // 30 días/año
        vacacionesDias: 30,
      };
  }
}

/** Aporte del empleador a la salud del trabajador según su régimen. */
export function calcularAporteSalud(bruto: number, regimen: RegimenLaboral): number {
  return beneficiosPorRegimen(regimen).saludTipo === 'SIS'
    ? APORTE_SIS_MICRO
    : round2(bruto * ESSALUD_RATE);
}

// ---------------------------------------------------------------------------
// RENTA DE 5TA CATEGORÍA (retención mensual proyectada, método simplificado)
// ---------------------------------------------------------------------------
const TRAMOS_RENTA: { hastaUIT: number; tasa: number }[] = [
  { hastaUIT: 5, tasa: 0.08 },
  { hastaUIT: 20, tasa: 0.14 },
  { hastaUIT: 35, tasa: 0.17 },
  { hastaUIT: 45, tasa: 0.2 },
  { hastaUIT: Infinity, tasa: 0.3 },
];

/**
 * @param brutoMensual Remuneración bruta mensual (incluye asignación familiar).
 * @param sueldosProyectados 14 con gratificaciones (general/pequeña), 12 sin ellas (micro).
 */
export function calcularRenta5ta(brutoMensual: number, sueldosProyectados = 14): number {
  const proyeccionAnual = brutoMensual * sueldosProyectados;
  const rentaNeta = proyeccionAnual - 7 * UIT; // deducción fija de 7 UIT
  if (rentaNeta <= 0) return 0;

  let impuesto = 0;
  let previoUIT = 0;
  for (const tramo of TRAMOS_RENTA) {
    const topeTramo = tramo.hastaUIT === Infinity ? Infinity : tramo.hastaUIT * UIT;
    const gravableEnTramo = Math.max(0, Math.min(rentaNeta, topeTramo) - previoUIT * UIT);
    if (gravableEnTramo <= 0) break;
    impuesto += gravableEnTramo * tramo.tasa;
    previoUIT = tramo.hastaUIT;
    if (rentaNeta <= topeTramo) break;
  }
  return round2(impuesto / 12);
}

// ---------------------------------------------------------------------------
// IMPUESTO A LA RENTA — PAGO A CUENTA MENSUAL POR RÉGIMEN
// ---------------------------------------------------------------------------
export type RegimenTributario = 'NRUS' | 'RER' | 'RMT' | 'RG';

export interface PagoCuentaRenta {
  regimen: RegimenTributario;
  tasaAplicada: number; // 0 en NRUS (cuota fija)
  cuotaFija: number; // > 0 sólo en NRUS
  monto: number;
  detalle: string;
}

/**
 * @param baseNeta Ingresos netos gravables del mes.
 * @param ingresosMensuales Ingreso bruto del mes (para categorizar NRUS).
 */
export function calcularPagoCuentaRenta(
  regimen: RegimenTributario,
  baseNeta: number,
  ingresosMensuales = 0,
): PagoCuentaRenta {
  switch (regimen) {
    case 'NRUS': {
      // Categoría 1: hasta S/ 5 000/mes → S/ 20 · Categoría 2: hasta S/ 8 000/mes → S/ 50
      const cuotaFija = ingresosMensuales <= 5000 ? 20 : 50;
      return {
        regimen,
        tasaAplicada: 0,
        cuotaFija,
        monto: cuotaFija,
        detalle: `Cuota fija NRUS categoría ${ingresosMensuales <= 5000 ? 1 : 2}`,
      };
    }
    case 'RER': {
      const monto = round2(baseNeta * 0.015);
      return { regimen, tasaAplicada: 0.015, cuotaFija: 0, monto, detalle: '1.5% de ingresos netos (RER)' };
    }
    case 'RMT': {
      // 1% hasta 300 UIT de ingresos netos anuales acumulados; 1.5% en adelante.
      const monto = round2(baseNeta * 0.01);
      return { regimen, tasaAplicada: 0.01, cuotaFija: 0, monto, detalle: '1.0% de ingresos netos (RMT ≤ 300 UIT)' };
    }
    case 'RG':
    default: {
      const monto = round2(baseNeta * 0.015);
      return { regimen, tasaAplicada: 0.015, cuotaFija: 0, monto, detalle: '1.5% de ingresos netos o coeficiente (RG)' };
    }
  }
}

/** NRUS no genera crédito/débito fiscal de IGV. */
export function regimenUsaIgv(regimen: RegimenTributario): boolean {
  return regimen !== 'NRUS';
}

// ---------------------------------------------------------------------------
// DETRACCIONES SPOT
// ---------------------------------------------------------------------------
export const SPOT_UMBRAL = 700; // S/ — no aplica en operaciones ≤ S/ 700
export const SPOT_TASA_SERVICIOS = 0.12; // "Demás servicios gravados con IGV" (Anexo 3, cód. 037)

export function aplicaDetraccion(montoOperacion: number): boolean {
  return montoOperacion > SPOT_UMBRAL;
}

export function calcularDetraccion(montoOperacion: number, tasa: number = SPOT_TASA_SERVICIOS) {
  if (!aplicaDetraccion(montoOperacion)) {
    return { aplica: false, montoDetraccion: 0, netoACobrar: round2(montoOperacion) };
  }
  const montoDetraccion = round2(montoOperacion * tasa);
  return { aplica: true, montoDetraccion, netoACobrar: round2(montoOperacion - montoDetraccion) };
}

/**
 * Plazo de depósito SPOT: 5to día hábil del mes siguiente a la emisión (YYYY-MM-DD).
 * Sólo descuenta sábados y domingos; los feriados nacionales deben revisarse aparte.
 */
export function vencimientoDetraccion(fechaEmision: string): string {
  const [y, m] = fechaEmision.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // día 1 del mes siguiente (m ya es 1-based)
  let habiles = 0;
  for (;;) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) habiles++;
    if (habiles === 5) return d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

// ---------------------------------------------------------------------------
// IGV
// ---------------------------------------------------------------------------
/** Desagrega un precio que YA incluye IGV. */
export function desagregarIgv(precioConIgv: number) {
  const base = precioConIgv / (1 + IGV_RATE);
  return {
    base: round2(base),
    igv: round2(precioConIgv - base),
    total: round2(precioConIgv),
  };
}

// ---------------------------------------------------------------------------
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
