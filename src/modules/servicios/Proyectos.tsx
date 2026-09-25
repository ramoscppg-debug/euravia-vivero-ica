import { AlertTriangle, Boxes, ChevronRight, MapPin, PlusCircle, Receipt } from 'lucide-react';
import type { ProjectStatus } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const STATUS_STEPS: { id: ProjectStatus; label: string }[] = [
  { id: 'COTIZADO', label: 'Cotizado' },
  { id: 'APROBADO', label: 'Aprobado' },
  { id: 'EN_EJECUCION', label: 'En ejecución' },
  { id: 'CONCLUIDO', label: 'Concluido' }
];

export default function Proyectos() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const { projects, company } = state;
  const tasa = (company.tasaDetraccionServicios * 100).toFixed(0);

  const descargar = (id: string) => {
    const r = actions.descargarMaterialesProyecto(id);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    alert(`🌿 ¡Orden de Consumo ejecutada!\nSe descontaron del Kárdex los insumos del proyecto ${r.project.id} (${r.project.client}).`);
  };

  const facturar = async (id: string) => {
    const r = await actions.facturarProyecto(id);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    open({ type: 'ticket', invoice: r.invoice });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017]">Servicios de Jardinería, Paisajismo & Mantenimiento</h3>
          <p className="text-xs text-[#5c7367]">Cotización → aprobación → ejecución (descarga de insumos del Kardex) → facturación con Detracción SPOT ({tasa}%)</p>
        </div>
        <button
          onClick={() => alert('Abriendo cotizador de nuevo proyecto de jardinería con cálculo de materiales')}
          className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md"
        >
          <PlusCircle className="w-4 h-4" /> Nueva Cotización Paisajista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map(proj => {
          const stepIndex = STATUS_STEPS.findIndex(s => s.id === proj.status);
          const next = STATUS_STEPS[stepIndex + 1];
          return (
            <div key={proj.id} className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-[10px] text-[#8fa89b] font-bold">{proj.id}</span>
                  <h4 className="font-serif text-lg font-bold text-[#082017] mt-0.5">{proj.client}</h4>
                  <p className="text-xs text-[#5c7367] flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5 text-[#d4af37]" /> {proj.address}</p>
                </div>
                <span className="bg-[#134e2e] text-[#d4af37] text-xs font-bold px-3 py-1 rounded-full">{proj.type}</span>
              </div>

              {/* Etapa del proyecto */}
              <div className="flex items-center gap-1 text-[10px] font-bold">
                {STATUS_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={`flex-1 text-center py-1 rounded-lg ${i < stepIndex ? 'bg-[#dcfce7] text-[#134e2e]' : i === stepIndex ? 'bg-[#082017] text-[#d4af37]' : 'bg-[#f4ede4] text-[#8fa89b]'}`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>

              {/* Explosión de Materiales */}
              <div className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">1. Explosión de Insumos Botánicos Requeridos</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${proj.stockDeducted ? 'bg-[#dcfce7] text-[#134e2e]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                    {proj.stockDeducted ? '✅ Stock Descontado' : '⏳ Pendiente Descarga'}
                  </span>
                </div>
                <div className="space-y-1">
                  {proj.materials.map(mat => (
                    <div key={mat.sku} className="flex justify-between text-[#082017]">
                      <span>• {mat.qty}x {mat.name}</span>
                      <span className="font-mono text-[#5c7367]">S/ {(mat.qty * mat.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#eae4dc] flex justify-between text-[#5c7367]">
                  <span>Mano de Obra: <strong>{proj.laborHours} horas</strong> (S/ {proj.laborRatePerHour}/h)</span>
                  <span className="font-mono">S/ {(proj.laborHours * proj.laborRatePerHour).toFixed(2)}</span>
                </div>
              </div>

              {/* Alerta de Detracción SPOT */}
              {proj.aplicaDetraccion && (
                <div className="p-3 bg-[#fff7ed] border border-[#ffedd5] rounded-2xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#c2410c] font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Sujeto a Detracción SPOT SUNAT ({tasa}% &gt; S/ 700)</span>
                  </div>
                  <p className="text-[11px] text-[#9a3412]">
                    Total Presupuesto: <strong>S/ {proj.total.toFixed(2)}</strong> | Monto a depositar en Banco de la Nación: <strong className="text-[#b91c1c]">S/ {proj.montoDetraccion.toFixed(2)}</strong> (Neto a cobrar: S/ {proj.montoNetoACobrar.toFixed(2)})
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-[#f0eae1]">
                <div>
                  <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Presupuesto Total</span>
                  <span className="font-serif text-2xl font-bold text-[#134e2e]">S/ {proj.total.toFixed(2)}</span>
                  {proj.invoiceId && <span className="block text-[10px] font-mono font-bold text-[#134e2e]">✅ Facturado: {proj.invoiceId}</span>}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                  {next && (
                    <button
                      onClick={() => actions.avanzarProyecto(proj.id)}
                      className="px-3 py-2 bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] rounded-2xl font-bold text-xs flex items-center gap-1 border border-[#d5c7b5]"
                    >
                      <ChevronRight className="w-3.5 h-3.5" /> Pasar a {next.label}
                    </button>
                  )}
                  {!proj.stockDeducted && proj.status !== 'COTIZADO' && (
                    <button
                      onClick={() => descargar(proj.id)}
                      className="px-3 py-2 bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] rounded-2xl font-bold text-xs flex items-center gap-1 border border-[#d5c7b5]"
                    >
                      <Boxes className="w-3.5 h-3.5" /> Descargar Almacén
                    </button>
                  )}
                  {!proj.invoiceId && proj.status !== 'COTIZADO' && (
                    <button
                      onClick={() => facturar(proj.id)}
                      className="px-4 py-2 bg-[#082017] text-[#d4af37] rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <Receipt className="w-4 h-4" /> Facturar con SPOT
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
