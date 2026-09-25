import { useState } from 'react';
import { Banknote, CheckCircle2, Landmark, Unlock, Wallet } from 'lucide-react';
import { CreditCardIcon, MinusCircleIcon, SmartphoneIcon } from '../../components/shared';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { calcularCaja } from '../../store/selectors';

export default function Caja() {
  const { state, actions, nube } = useErp();
  const [montoApertura, setMontoApertura] = useState(200);
  const { open } = useUi();
  const { cashRegister, company } = state;
  const { totalEgresosCaja, saldoTeoricoEfectivo, diferenciaCaja } = calcularCaja(cashRegister);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <Wallet className="w-4 h-4" /> Control de Caja Chica & Arqueo Diario
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Gaveta de Efectivo, Billeteras Digitales & Tarjetas</h3>
          <p className="text-xs text-[#c2d4cb]">Monitorea las entradas por venta en mostrador, egresos menores y realiza el cuadre diario de caja.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => open({ type: 'egreso' })}
            className="px-4 py-2.5 rounded-2xl bg-[#fee2e2] text-[#b91c1c] font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <MinusCircleIcon /> Registrar Gasto Menor (-)
          </button>
          <button
            onClick={async () => {
              const r = await actions.cuadrarCaja();
              if (!r.ok) {
                alert(r.error);
                return;
              }
              alert(`✅ ¡Arqueo de caja realizado!\nSaldo en Efectivo: S/ ${cashRegister.conteoRealEfectivo.toFixed(2)}\nDiferencia: S/ ${diferenciaCaja.toFixed(2)} (${diferenciaCaja === 0 ? 'Exacto' : diferenciaCaja > 0 ? 'Sobrante' : 'Faltante'})`);
            }}
            className="px-4 py-2.5 rounded-2xl bg-[#d4af37] text-[#082017] font-bold text-xs flex items-center gap-1.5 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" /> Realizar Cierre / Cuadre
          </button>
        </div>
      </div>

      {/* Apertura del día (en la nube la caja arranca en cero cada día) */}
      {nube && cashRegister.aperturaEfectivo === 0 && cashRegister.estadoCaja === 'ABIERTA' && (
        <div className="bg-[#fff7ed] border border-[#ffedd5] rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-[#9a3412]">La caja de hoy aún no tiene apertura</p>
            <p className="text-[#9a3412]">Registra el sencillo con que empieza el día para que el cuadre salga exacto.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={0} step="0.5" value={montoApertura} onChange={e => setMontoApertura(Number(e.target.value))} className="w-28 p-2 bg-white border rounded-xl font-mono font-bold text-right" />
            <button
              onClick={async () => { const r = await actions.abrirCaja(montoApertura); if (!r.ok) alert(r.error); }}
              className="px-4 py-2 rounded-xl bg-[#082017] text-[#d4af37] font-bold flex items-center gap-1.5"
            >
              <Unlock className="w-4 h-4" /> Abrir caja
            </button>
          </div>
        </div>
      )}

      {/* 4 Tarjetas de Medios de Cobro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5c7367] uppercase">Efectivo en Gaveta</span>
            <Banknote className="w-4 h-4 text-[#134e2e]" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#082017] mt-1.5">S/ {cashRegister.conteoRealEfectivo.toFixed(2)}</div>
          <p className="text-[11px] text-[#5c7367] mt-1">Apertura: S/ {cashRegister.aperturaEfectivo.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5c7367] uppercase">Yape & Plin</span>
            <SmartphoneIcon />
          </div>
          <div className="text-2xl font-serif font-bold text-[#e05780] mt-1.5">S/ {cashRegister.ventasBilleteras.toFixed(2)}</div>
          <p className="text-[11px] text-[#5c7367] mt-1">Cobros QR sin comisiones</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5c7367] uppercase">Tarjetas POS</span>
            <CreditCardIcon />
          </div>
          <div className="text-2xl font-serif font-bold text-[#134e2e] mt-1.5">S/ {cashRegister.ventasTarjetas.toFixed(2)}</div>
          <p className="text-[11px] text-[#5c7367] mt-1">Niubiz / Izipay terminales</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5c7367] uppercase">Transferencias BCP</span>
            <Landmark className="w-4 h-4 text-[#d4af37]" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#d4af37] mt-1.5">S/ {cashRegister.ventasTransferencias.toFixed(2)}</div>
          <p className="text-[11px] text-[#5c7367] mt-1">Cta: {company.cuentaBcpSoles}</p>
        </div>
      </div>

      {/* Detalle del Arqueo y Gastos Menores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
          <h4 className="font-serif font-bold text-base text-[#082017]">Resumen del Cuadre de Caja (Efectivo)</h4>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#5c7367]">(+) Saldo de Apertura (Sencillo):</span>
              <strong className="font-mono">S/ {cashRegister.aperturaEfectivo.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#5c7367]">(+) Ventas en Efectivo del Día:</span>
              <strong className="font-mono text-[#134e2e]">S/ {cashRegister.ventasEfectivo.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#5c7367]">(-) Egresos Menores de Caja:</span>
              <strong className="font-mono text-[#e05780]">- S/ {totalEgresosCaja.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between py-2 bg-[#faf8f5] p-3 rounded-xl border border-[#eae4dc]">
              <span className="font-bold text-[#082017]">(=) Saldo Teórico Esperado:</span>
              <strong className="font-mono text-sm text-[#082017]">S/ {saldoTeoricoEfectivo.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between items-center py-2 bg-[#e7f5ed] p-3 rounded-xl border border-[#134e2e]/20">
              <span className="font-bold text-[#134e2e]">Conteo Físico Real en Gaveta:</span>
              <input
                type="number"
                step="0.50"
                value={cashRegister.conteoRealEfectivo}
                onChange={(e) => actions.setConteoCaja(Number(e.target.value))}
                className="w-28 p-1.5 bg-white border border-[#134e2e]/40 rounded-lg text-right font-mono font-bold text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-serif font-bold text-base text-[#082017]">Gastos Menores / Vales de Caja</h4>
            <button onClick={() => open({ type: 'egreso' })} className="px-2.5 py-1 bg-[#082017] text-[#d4af37] rounded-xl font-bold text-[10px]">
              + Nuevo Vale
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            {cashRegister.egresos.map(eg => (
              <div key={eg.id} className="p-3 bg-[#faf8f5] rounded-xl border border-[#eae4dc] flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#082017]">{eg.motivo}</p>
                  <p className="text-[10px] text-[#8fa89b]">{eg.hora} • Resp: {eg.responsable}</p>
                </div>
                <span className="font-mono font-bold text-sm text-[#e05780]">- S/ {eg.monto.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
