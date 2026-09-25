// ==========================================
// ARCHIVOS OFICIALES: SIRE (RVIE / RCE) y AFPnet (PLAPROTE)
// ==========================================
import type { ComprobanteSunat, EmpresaConfig, Purchase } from '../domain/types';
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

export function generarSire(
  tipo: 'RVIE' | 'RCE',
  company: EmpresaConfig,
  invoices: ComprobanteSunat[],
  purchases: Purchase[]
): string {
  let content = '';
  if (tipo === 'RVIE') {
    content = `LE${company.ruc}20260900140400021111\n`;
    invoices.forEach(inv => {
      content += `${company.ruc}|${company.razonSocial}|202609|${inv.fechaEmision}|${inv.tipoComprobante}|${inv.serie}|${inv.correlativo}|${inv.cliente.tipoDoc}|${inv.cliente.numDoc}|${inv.cliente.nombreRazonSocial}|${inv.opGravadas.toFixed(2)}|${inv.totalIgv.toFixed(2)}|${inv.montoTotal.toFixed(2)}|PEN|ACEPTADO|\n`;
    });
  } else {
    content = `LE${company.ruc}20260900080400021111\n`;
    purchases.forEach(pur => {
      content += `${company.ruc}|${company.razonSocial}|202609|${pur.fecha}|01|${pur.id.split('-')[0]}|${pur.id.split('-')[1] || '001'}|6|${pur.ruc}|${pur.proveedor}|${pur.gravada.toFixed(2)}|${pur.igv.toFixed(2)}|${pur.total.toFixed(2)}|PEN|1|\n`;
    });
  }
  return content;
}
