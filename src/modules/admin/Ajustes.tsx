import { useState } from 'react';
import { Building2, Check, CheckCircle2, KeyRound, Landmark, RotateCcw, Save, ScanLine } from 'lucide-react';
import { useDocLookup } from '../../components/shared';
import type { EmpresaConfig } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import Usuarios from './Usuarios';

export default function Ajustes() {
  const { state, actions, nube } = useErp();
  const { busy, consultar } = useDocLookup();
  const { company } = state;
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const set = (patch: Partial<EmpresaConfig>) => actions.updateCompany(patch);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await actions.guardarEmpresa();
    if (!r.ok) {
      alert(r.error);
      return;
    }
    setSaveSuccessMessage('¡Datos de la empresa, RUC y credenciales SUNAT/AFPnet actualizados con éxito!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const restablecer = () => {
    if (confirm('¿Borrar todos los movimientos registrados en este navegador y volver a los datos demo?')) {
      actions.restablecerDemo();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Building2 className="w-4 h-4" /> Configuración Oficial de la Empresa
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Datos Fiscales, SUNAT SOL & Cuentas Bancarias</h3>
          <p className="text-xs text-[#c2d4cb]">Actualiza tu RUC, Cuenta de Detracciones Banco de la Nación, Credenciales SOL y Firma Digital.</p>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="bg-[#dcfce7] border border-[#134e2e]/30 text-[#134e2e] p-4 rounded-2xl font-semibold text-xs flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-[#134e2e]" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      <form onSubmit={guardar} className="space-y-6">
        <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
            <Building2 className="w-5 h-5 text-[#134e2e]" />
            <h4 className="font-serif font-bold text-base text-[#082017]">1. Identidad Fiscal & Razón Social (SUNAT)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Número de RUC (11 dígitos) *</label>
              <div className="flex gap-1.5">
                <input type="text" maxLength={11} value={company.ruc} onChange={(e) => set({ ruc: e.target.value })} className="flex-1 min-w-0 p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono font-bold text-sm text-[#082017]" required />
                <button type="button" disabled={busy} onClick={() => consultar(company.ruc, (n) => set({ razonSocial: n }))} className="shrink-0 px-3 rounded-xl bg-[#082017] text-[#d4af37] font-bold text-[10px] flex items-center gap-1 disabled:opacity-50">
                  <ScanLine className="w-3.5 h-3.5" /> {busy ? '...' : 'Consultar'}
                </button>
              </div>
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Razón Social Completa *</label>
              <input type="text" value={company.razonSocial} onChange={(e) => set({ razonSocial: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs text-[#082017]" required />
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Nombre Comercial de la Marca *</label>
              <input type="text" value={company.nombreComercial} onChange={(e) => set({ nombreComercial: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs text-[#082017]" required />
            </div>
          </div>
        </div>

        {/* Parámetros Bancarios y Detracciones */}
        <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
            <Landmark className="w-5 h-5 text-[#d4af37]" />
            <h4 className="font-serif font-bold text-base text-[#082017]">2. Parámetros Bancarios & Cuentas de Detracción SPOT</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Cta. Detracciones Banco de la Nación *</label>
              <input type="text" value={company.cuentaDetraccionesBn} onChange={(e) => set({ cuentaDetraccionesBn: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono font-bold text-xs" required />
              <span className="text-[10px] text-[#8fa89b]">Para servicios &gt; S/ 700</span>
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Cuenta Corriente BCP (Soles)</label>
              <input type="text" value={company.cuentaBcpSoles} onChange={(e) => set({ cuentaBcpSoles: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono text-xs" />
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Tasa Detracción Servicios (%)</label>
              <input type="number" step="1" value={company.tasaDetraccionServicios * 100} onChange={(e) => set({ tasaDetraccionServicios: Number(e.target.value) / 100 })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs" />
            </div>
          </div>
        </div>

        {/* Credenciales SOL & Certificado */}
        <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#f0eae1]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#e05780]" />
              <h4 className="font-serif font-bold text-base text-[#082017]">3. Credenciales SUNAT SOL & Certificado Digital Tributario (CDT)</h4>
            </div>
            <span className="bg-[#dcfce7] text-[#134e2e] font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Certificado CDT Activo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Entorno de Trabajo SUNAT</label>
              <select value={company.sunatAmbiente} onChange={(e) => set({ sunatAmbiente: e.target.value as EmpresaConfig['sunatAmbiente'] })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-bold text-xs">
                <option value="PRODUCCION">🟢 Producción (Validez Legal Real SUNAT)</option>
                <option value="BETA">🟡 BETA / Homologación (Pruebas)</option>
              </select>
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Usuario Secundario Clave SOL *</label>
              <input type="text" value={company.usuarioSol} onChange={(e) => set({ usuarioSol: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono font-bold text-xs" required />
            </div>
            <div>
              <label className="font-bold block mb-1 text-[#082017]">Clave SOL *</label>
              <input type="password" value={company.claveSol} onChange={(e) => set({ claveSol: e.target.value })} className="w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-mono font-bold text-xs" required />
              <span className="text-[10px] text-[#8fa89b]">No se guarda en el navegador: se pide en cada sesión.</span>
            </div>
          </div>

          <div className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-[#082017]">Certificado Digital Tributario SUNAT (.PFX / .P12)</p>
              <p className="text-[11px] text-[#5c7367]">Archivo: <span className="font-mono text-[#082017] font-semibold">{company.certificadoCdtNombre}</span> (Vigente hasta {company.certificadoVencimiento})</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
          {nube ? <span /> : (
          <button type="button" onClick={restablecer} className="px-5 py-3 rounded-2xl border border-[#d5c7b5] bg-[#f4ede4] text-[#5c7367] font-bold text-xs flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Restablecer datos demo
          </button>
          )}
          <button type="submit" className="px-8 py-3.5 bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition">
            <Save className="w-4 h-4" /> Guardar Todos los Cambios de la Empresa
          </button>
        </div>
      </form>

      {nube && <Usuarios />}
    </div>
  );
}
