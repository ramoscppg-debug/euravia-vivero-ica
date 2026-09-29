import { useState } from 'react';
import { Building2, CheckCircle2, KeyRound, Landmark, RotateCcw, Save, ScanLine } from 'lucide-react';
import { useDocLookup } from '../../components/shared';
import type { EmpresaConfig } from '../../domain/types';
import { useErp } from '../../store/ErpStore';
import Usuarios from './Usuarios';
import TiendaAjustes from './TiendaAjustes';
import { AvisosPedidos, TarifasDelivery } from './AvisosDelivery';

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
      <div className="bg-gradient-to-r from-bosque-950 via-bosque-900 to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-oro/30">
        <div className="space-y-1">
          <span className="bg-bosque-700 text-oro px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Building2 className="w-4 h-4" /> Configuración Oficial de la Empresa
          </span>
          <h3 className="font-serif text-2xl font-bold text-crema-50">Datos Fiscales, Series & Cuentas Bancarias</h3>
          <p className="text-xs text-bosque-200">RUC, razón social, cuentas, series de comprobantes y datos de la tienda.</p>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="bg-exito-fondo border border-bosque-700/30 text-bosque-700 p-4 rounded-2xl font-semibold text-xs flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-bosque-700" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      <form onSubmit={guardar} className="space-y-6">
        <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
            <Building2 className="w-5 h-5 text-bosque-700" />
            <h4 className="font-serif font-bold text-base text-tinta">1. Identidad Fiscal & Razón Social (SUNAT)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1 text-tinta">Número de RUC (11 dígitos) *</label>
              <div className="flex gap-1.5">
                <input type="text" maxLength={11} value={company.ruc} onChange={(e) => set({ ruc: e.target.value })} className="flex-1 min-w-0 p-2.5 bg-crema border border-crema-300 rounded-xl font-mono font-bold text-sm text-tinta" required />
                <button type="button" disabled={busy} onClick={() => consultar(company.ruc, (n) => set({ razonSocial: n }))} className="shrink-0 px-3 rounded-xl bg-bosque-950 text-oro font-bold text-[10px] flex items-center gap-1 disabled:opacity-50">
                  <ScanLine className="w-3.5 h-3.5" /> {busy ? '...' : 'Consultar'}
                </button>
              </div>
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Razón Social Completa *</label>
              <input type="text" value={company.razonSocial} onChange={(e) => set({ razonSocial: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold text-xs text-tinta" required />
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Nombre Comercial de la Marca</label>
              <input type="text" value={company.nombreComercial} onChange={(e) => set({ nombreComercial: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold text-xs text-tinta" />
            </div>
          </div>
        </div>

        {/* Parámetros Bancarios y Detracciones */}
        <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
            <Landmark className="w-5 h-5 text-oro" />
            <h4 className="font-serif font-bold text-base text-tinta">2. Parámetros Bancarios & Cuentas de Detracción SPOT</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold block mb-1 text-tinta">Cta. Detracciones Banco de la Nación</label>
              <input type="text" value={company.cuentaDetraccionesBn} onChange={(e) => set({ cuentaDetraccionesBn: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-mono font-bold text-xs" />
              <span className="text-[10px] text-tinta-suave">Para servicios &gt; S/ 700</span>
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Cuenta Corriente BCP (Soles)</label>
              <input type="text" value={company.cuentaBcpSoles} onChange={(e) => set({ cuentaBcpSoles: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-mono text-xs" />
            </div>
            <div>
              <label className="font-bold block mb-1 text-tinta">Tasa Detracción Servicios (%)</label>
              <input type="number" step="1" value={company.tasaDetraccionServicios * 100} onChange={(e) => set({ tasaDetraccionServicios: Number(e.target.value) / 100 })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold text-xs" />
            </div>
            <div>
              <label htmlFor="comision-jardinero" className="font-bold block mb-1 text-tinta">Comisión a jardineros (%)</label>
              <input id="comision-jardinero" type="number" min={0} max={100} step="0.5" value={company.comisionJardineroPct ?? ''} onChange={(e) => set({ comisionJardineroPct: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Ej. 20" className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold text-xs" />
              <span className="text-[10px] text-tinta-suave">Sobre el precio del servicio sin IGV</span>
            </div>
          </div>
        </div>

        {/* Emisión de comprobantes: series y dónde se quedó la numeración */}
        <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
            <KeyRound className="w-5 h-5 text-bosque-700" />
            <h4 className="font-serif font-bold text-base text-tinta">3. Emisión de comprobantes y series</h4>
          </div>
          <div className="p-3 rounded-2xl bg-crema text-xs space-y-1">
            <p className="font-bold text-tinta">Modo actual: emisión en el portal SUNAT (SOL) u otra plataforma</p>
            <p className="text-tinta-suave">Cada venta deja listo el <b>modelo</b> de su boleta, factura o guía. La emites en SUNAT, anotas el número que te dio y se la envías al cliente por WhatsApp. Cuando conectes la API de SUNAT o un proveedor, se activará la emisión directa.</p>
          </div>
          <p className="text-xs text-tinta-suave">Escribe la serie y el <b>último número que ya emitiste</b> en SUNAT: el sistema sugerirá el siguiente para que la numeración quede alineada.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1">Documento</th><th className="text-left">Serie</th><th className="text-left">Último N° emitido</th><th className="text-left">Siguiente sugerido</th></tr></thead>
              <tbody className="divide-y divide-crema-200">
                {([
                  ['Boleta de venta', 'serieBoleta'], ['Factura', 'serieFactura'], ['Nota de crédito (boleta)', 'serieNcBoleta'],
                  ['Nota de crédito (factura)', 'serieNcFactura'], ['Guía de remisión', 'serieGre']
                ] as const).map(([nombre, campo]) => {
                  const serie = (company[campo] as string) || '';
                  const ultimo = company.ultimosNumeros?.[serie] ?? 0;
                  const registrado = Math.max(0, ...state.invoices.filter(i => i.serie === serie).map(i => i.correlativo), ...state.guiasRemision.filter(g => g.serie === serie).map(g => g.correlativo));
                  const siguiente = Math.max(ultimo, registrado) + 1;
                  return (
                    <tr key={campo}>
                      <td className="py-2 font-bold text-tinta">{nombre}</td>
                      <td><input aria-label={`Serie de ${nombre}`} maxLength={4} value={serie} onChange={e => set({ [campo]: e.target.value.toUpperCase() } as Partial<EmpresaConfig>)} className="w-20 p-2 bg-crema border border-crema-300 rounded-xl font-mono font-bold" /></td>
                      <td><input aria-label={`Último número de ${nombre}`} type="number" min={0} value={ultimo || ''} placeholder="0"
                        onChange={e => set({ ultimosNumeros: { ...(company.ultimosNumeros ?? {}), [serie]: Math.max(0, Math.floor(Number(e.target.value) || 0)) } })}
                        className="w-28 p-2 bg-crema border border-crema-300 rounded-xl font-mono font-bold" /></td>
                      <td className="font-mono font-bold text-bosque-700">{serie ? `${serie}-${String(siguiente).padStart(8, '0')}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-tinta-suave">Si ya hay ventas registradas en el sistema, el siguiente número es el mayor entre lo registrado y lo que indiques aquí. Al anotar el número real de cada comprobante, la serie se actualiza sola.</p>

          <details className="rounded-2xl border border-crema-300 px-4 py-3 text-xs">
            <summary className="cursor-pointer font-bold text-tinta">Para la conexión directa con SUNAT (opcional, más adelante)</summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
              <div>
                <label className="font-bold block mb-1 text-tinta">Entorno SUNAT</label>
                <select value={company.sunatAmbiente} onChange={(e) => set({ sunatAmbiente: e.target.value as EmpresaConfig['sunatAmbiente'] })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-bold text-xs">
                  <option value="BETA">BETA / Homologación (pruebas)</option>
                  <option value="PRODUCCION">Producción</option>
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1 text-tinta">Usuario secundario SOL</label>
                <input type="text" value={company.usuarioSol} onChange={(e) => set({ usuarioSol: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-mono font-bold text-xs" />
              </div>
              <div>
                <label className="font-bold block mb-1 text-tinta">Clave SOL</label>
                <input type="password" value={company.claveSol} onChange={(e) => set({ claveSol: e.target.value })} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-mono font-bold text-xs" />
                <span className="text-[10px] text-tinta-suave">No se guarda en el navegador ni en la base: se pide en cada sesión.</span>
              </div>
              <p className="md:col-span-3 text-[11px] text-tinta-suave">Certificado digital: {company.certificadoCdtNombre ? <span className="font-mono text-tinta font-semibold">{company.certificadoCdtNombre}</span> : 'no cargado'} · se necesita sólo para la emisión directa.</p>
            </div>
          </details>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
          {nube ? <span /> : (
          <button type="button" onClick={restablecer} className="px-5 py-3 rounded-2xl border border-crema-400 bg-crema-200 text-tinta-suave font-bold text-xs flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Restablecer datos demo
          </button>
          )}
          <button type="submit" className="px-8 py-3.5 bg-bosque-950 hover:bg-bosque-800 text-oro font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition">
            <Save className="w-4 h-4" /> Guardar Todos los Cambios de la Empresa
          </button>
        </div>
      </form>

      <TiendaAjustes />
      <AvisosPedidos />
      <TarifasDelivery />

      {nube && <Usuarios />}
    </div>
  );
}
