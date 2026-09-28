// ==========================================
// ARCHIVOS OFICIALES: AFPnet (PLAPROTE). El SIRE y el PLE están en librosSunat.ts
// ==========================================
import type { PlanillaMes } from '../store/selectors';

export function descargarTxt(nombreArchivo: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function generarPlaprote(planilla: PlanillaMes): string {
  let txtContent = '';
  planilla.detalle.forEach((emp, index) => {
    if (emp.sistemaPension !== 'ONP' && emp.cuspp) {
      const correlativo = String(index + 1).padStart(5, '0');
      const cuspp = emp.cuspp.padEnd(12, ' ');
      const tipoDoc = '0';
      const numDoc = emp.dni.padEnd(10, ' ');
      const apellidos = `${emp.apellidos} ${emp.nombres}`.padEnd(40, ' ');
      const remAsegurable = emp.bruto.toFixed(2).padStart(9, '0');
      const aporteVoluntario = '000000.00';
      txtContent += `${correlativo}|${cuspp}|${tipoDoc}|${numDoc}|${apellidos}|S|S|${remAsegurable}|${aporteVoluntario}|000000.00|N|\n`;
    }
  });
  return txtContent;
}
