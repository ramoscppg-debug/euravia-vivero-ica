/** Monto en soles con separadores peruanos: S/ 1,234.50 */
export const soles = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
