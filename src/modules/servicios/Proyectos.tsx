import { useState } from 'react';
import { AlertTriangle, Boxes, ChevronRight, MapPin, PlusCircle, Receipt, Trash2, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import type { GardeningMaterialItem, GardeningProject, ProjectStatus } from '../../domain/types';
import { calcularDetraccion, round2, validarRuc } from '../../lib/peru';
import { useAuth } from '../../store/AuthStore';
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
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const cobra = rol !== 'jardinero'; // cotizar y facturar es de dueño y vendedor
  const { projects, company } = state;
  const tasa = (company.tasaDetraccionServicios * 100).toFixed(0);

  const descargar = async (id: string) => {
    const r = await actions.descargarMaterialesProyecto(id);
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
        {cobra && (
          <button
            onClick={() => open({ type: 'proyecto' })}
            className="px-4 py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md"
          >
            <PlusCircle className="w-4 h-4" /> Nueva Cotización Paisajista
          </button>
        )}
      </div>

      {projects.length === 0 && (
        <p className="text-xs text-[#8fa89b] font-semibold">Todavía no hay proyectos. {cobra ? 'Crea el primero con "Nueva Cotización Paisajista".' : ''}</p>
      )}

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
                  {next && (cobra || proj.status !== 'COTIZADO') && (
                    <button
                      onClick={async () => { const r = await actions.avanzarProyecto(proj.id); if (!r.ok) alert(r.error); }}
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
                  {cobra && !proj.invoiceId && proj.status !== 'COTIZADO' && (
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

// ============================================================
// MODAL: NUEVA COTIZACIÓN DE JARDINERÍA
// ============================================================
const TIPOS: GardeningProject['type'][] = ['Diseño Paisajista', 'Mantenimiento Residencial', 'Jardín Vertical', 'Riego Automatizado'];

export function NuevaCotizacionModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const { products, company } = state;

  const [client, setClient] = useState('');
  const [doc, setDoc] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<GardeningProject['type']>('Mantenimiento Residencial');
  const [materials, setMaterials] = useState<GardeningMaterialItem[]>([]);
  const [laborHours, setLaborHours] = useState(4);
  const [laborRatePerHour, setLaborRatePerHour] = useState(35);
  const [skuNuevo, setSkuNuevo] = useState(products[0]?.sku ?? '');
  const [enviando, setEnviando] = useState(false);

  const total = round2(materials.reduce((a, m) => a + m.qty * m.unitPrice, 0) + laborHours * laborRatePerHour);
  const det = calcularDetraccion(total, company.tasaDetraccionServicios);
  const conDetraccion = validarRuc(doc) && det.aplica;

  const agregarMaterial = () => {
    const prod = products.find(p => p.sku === skuNuevo);
    if (!prod) return;
    setMaterials(ms => ms.some(m => m.sku === prod.sku)
      ? ms.map(m => (m.sku === prod.sku ? { ...m, qty: m.qty + 1 } : m))
      : [...ms, { sku: prod.sku, name: prod.name, qty: 1, unitPrice: prod.price }]);
  };

  const guardar = async () => {
    setEnviando(true);
    const r = await actions.crearProyecto({ client, doc, phone, address, type, materials, laborHours, laborRatePerHour });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    alert(`🌿 Cotización ${r.project.id} creada por S/ ${r.project.total.toFixed(2)}.`);
  };

  const input = 'w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold';

  return (
    <ModalShell size="max-w-2xl" padding="p-6">
      <div className="flex justify-between items-center pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">Nueva Cotización de Jardinería</h3>
          <p className="text-[11px] text-[#5c7367]">Materiales del catálogo + mano de obra. La detracción se calcula sola.</p>
        </div>
        <button onClick={close}><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Cliente</label>
          <input value={client} onChange={e => setClient(e.target.value)} placeholder="Nombre o razón social" className={input} />
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">DNI / RUC</label>
          <input value={doc} onChange={e => setDoc(e.target.value.trim())} placeholder="8 u 11 dígitos" className={`${input} font-mono`} />
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Teléfono</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+51 ..." className={input} />
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Tipo de servicio</label>
          <select value={type} onChange={e => setType(e.target.value as GardeningProject['type'])} className={input}>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold block mb-1 text-[#082017]">Dirección del jardín</label>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle, número, distrito" className={input} />
        </div>
      </div>

      <div className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
        <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Materiales del catálogo</span>
        <div className="flex gap-2">
          <select value={skuNuevo} onChange={e => setSkuNuevo(e.target.value)} className={`${input} bg-white`}>
            {products.map(p => <option key={p.sku} value={p.sku}>{p.name} — S/ {p.price.toFixed(2)} (stock {p.stock})</option>)}
          </select>
          <button type="button" onClick={agregarMaterial} className="shrink-0 px-3 rounded-xl bg-[#082017] text-[#d4af37] font-bold">+ Agregar</button>
        </div>
        {materials.map(m => (
          <div key={m.sku} className="flex items-center gap-2 text-[#082017]">
            <span className="flex-1">{m.name}</span>
            <input type="number" min={1} value={m.qty} onChange={e => setMaterials(ms => ms.map(x => (x.sku === m.sku ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} className="w-16 p-1.5 bg-white border rounded-lg font-bold text-center" />
            <span className="w-24 text-right font-mono">S/ {(m.qty * m.unitPrice).toFixed(2)}</span>
            <button type="button" title="Quitar" onClick={() => setMaterials(ms => ms.filter(x => x.sku !== m.sku))}><Trash2 className="w-4 h-4 text-[#b91c1c]" /></button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Horas de mano de obra</label>
          <input type="number" min={0} value={laborHours} onChange={e => setLaborHours(Math.max(0, Number(e.target.value)))} className={input} />
        </div>
        <div>
          <label className="font-bold block mb-1 text-[#082017]">Tarifa por hora (S/)</label>
          <input type="number" min={0} step="0.5" value={laborRatePerHour} onChange={e => setLaborRatePerHour(Math.max(0, Number(e.target.value)))} className={input} />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#e7f5ed] border border-[#134e2e]/20">
        <div>
          <span className="text-[10px] text-[#134e2e] uppercase font-bold block">Total cotizado (inc. IGV)</span>
          <span className="font-serif text-2xl font-bold text-[#082017]">S/ {total.toFixed(2)}</span>
        </div>
        <span className="text-[11px] text-[#5c7367] text-right">
          {conDetraccion
            ? <>Detracción {(company.tasaDetraccionServicios * 100).toFixed(0)}%: <strong>S/ {det.montoDetraccion.toFixed(2)}</strong><br />Neto a cobrar: S/ {det.netoACobrar.toFixed(2)}</>
            : 'Sin detracción (boleta o monto ≤ S/ 700)'}
        </span>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button onClick={close} className="flex-1 py-3 rounded-2xl border font-bold text-[#5c7367]">Cancelar</button>
        <button onClick={guardar} disabled={enviando} className="flex-1 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-60">
          {enviando ? 'Guardando...' : 'Guardar Cotización'}
        </button>
      </div>
    </ModalShell>
  );
}
