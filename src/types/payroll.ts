// ========================================================
// TIPOS Y MODELOS - PLANILLA & AFPNET / PLAME SUNAT
// ========================================================

export type RegimenLaboral = 'MYPE_MICRO' | 'MYPE_PEQUENA' | 'REGIMEN_GENERAL';

export type SistemaPension = 'ONP' | 'INTEGRA' | 'PRIMA' | 'PROFUTURO' | 'HABITAT';

export interface TrabajadorAurevia {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  fechaIngreso: string;
  sueldoBasico: number;
  asignacionFamiliar: boolean; // 10% RMV = S/ 113.00 (Ley 25129); no aplica a microempresa REMYPE
  regimenLaboral: RegimenLaboral;
  sistemaPension: SistemaPension;
  cuspp?: string; // Código Único del Sistema Privado de Pensiones (AFP)
  comisionAfp?: 'Flujo' | 'Mixta';
  diasTrabajados: number;
}

export interface BoletaPagoPlanilla {
  trabajadorId: string;
  periodo: string; // '2026-09'
  remuneracionBruta: number;
  
  // Descuentos al Trabajador (Aporte Previsional)
  descuentoAfpFondo: number; // 10% obligatorio
  descuentoAfpComision: number; // comisión por flujo, varía por AFP (Habitat 1.47% – Profuturo 1.69%)
  descuentoAfpSeguro: number; // prima de seguro ~1.74% (sujeta a tope de remuneración asegurable)
  descuentoOnp: number; // 13% si está en ONP
  retencionRenta5ta?: number; // proyección anual - 7 UIT, tramos 8/14/17/20/30%
  totalDescuentosTrabajador: number;
  
  // Neto a Pagar en Cuenta
  netoPagarTrabajador: number;

  // Aportes del Empleador (Aurevia)
  aporteEssalud: number; // 9% a cargo de la empresa
  totalAportesEmpleador: number;
}

export interface EstructuraAfpNet {
  correlativo: number;
  cuspp: string;
  tipoDoc: string; // '0' para DNI
  numDoc: string;
  primerApellido: string;
  segundoApellido: string;
  nombres: string;
  remuneracionAsegurable: number;
  aporteVoluntario: number;
}
