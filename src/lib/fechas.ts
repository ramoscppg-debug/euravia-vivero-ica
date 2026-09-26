// ==========================================
// FECHAS DEL NEGOCIO (hora local de Perú, no UTC)
// toISOString() usa UTC: en Lima (UTC-5) desde las 19:00 ya "es mañana".
// ==========================================
const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local en formato YYYY-MM-DD. */
export const hoyLocal = (d = new Date()) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** Periodo tributario local en formato YYYY-MM. */
export const periodoLocal = (d = new Date()) => hoyLocal(d).slice(0, 7);

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin husos horarios). */
export const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(fecha) + dias * 86_400_000).toISOString().slice(0, 10);
