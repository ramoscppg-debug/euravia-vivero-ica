import type { Contrato } from '../domain/types';
import { periodoLocal } from './fechas';

/** El contrato toca facturarse si está activo, no se facturó este mes y ya llegó su día de cobro. */
export function porFacturar(c: Contrato, hoy = new Date()): boolean {
  const periodo = periodoLocal(hoy);
  return c.activo && (!c.ultimoPeriodo || c.ultimoPeriodo < periodo) && hoy.getDate() >= c.diaCobro && c.inicio.slice(0, 7) <= periodo;
}
