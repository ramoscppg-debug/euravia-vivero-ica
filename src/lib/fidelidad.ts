// ==========================================
// FIDELIDAD: cupones y puntos (mismas reglas que las funciones del servidor)
// ==========================================
import type { Cupon } from '../domain/types';
import { round2, validarDni, validarRuc } from './peru';
import { hoyLocal } from './fechas';

/** 1 punto por cada S/ 10 pagados. */
export const SOLES_POR_PUNTO = 10;
/** Cada punto canjeado vale S/ 0.10 de descuento. */
export const VALOR_PUNTO = 0.1;

export const puntosPorCompra = (total: number, doc?: string) =>
  doc && (validarDni(doc) || validarRuc(doc)) ? Math.floor(total / SOLES_POR_PUNTO) : 0;

export function descuentoCupon(c: Cupon | undefined, base: number, hoy = hoyLocal()): { descuento: number; error: string | null } {
  if (!c || !c.activo) return { descuento: 0, error: 'El cupón no existe o está desactivado.' };
  if (c.vence && c.vence < hoy) return { descuento: 0, error: `El cupón ${c.codigo} venció el ${c.vence}.` };
  if (c.usosMax !== undefined && c.usos >= c.usosMax) return { descuento: 0, error: `El cupón ${c.codigo} ya se usó el máximo de veces.` };
  if (base < c.minimoCompra) return { descuento: 0, error: `El cupón ${c.codigo} pide una compra mínima de S/ ${c.minimoCompra.toFixed(2)}.` };
  return { descuento: round2(Math.min(base, c.tipo === 'PCT' ? (base * c.valor) / 100 : c.valor)), error: null };
}
