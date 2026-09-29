// ==========================================
// CIERRE DEL EJERCICIO
// Al terminar el año: resultado (6x y 7x a 891/892), traslado a 5911/5921 y bloqueo del año.
// El año siguiente arranca con la foto al 1 de enero: saldos de las cuentas 1 a 5 e inventario inicial.
// ==========================================
import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '../../components/ui';
import type { AperturaEjercicio } from '../../domain/types';
import { asientosDeCierre, diarioDemo, type Asiento } from '../../lib/contabilidad';
import { soles } from '../../lib/formato';
import { hoyLocal } from '../../lib/fechas';
import * as repo from '../../lib/repo';
import { useErp } from '../../store/ErpStore';
import { Bloque, Cifra } from './comunes';
import { porEmitir } from './Emision';

export default function CierreEjercicio() {
  const { state } = useErp();
  const actual = Number(hoyLocal().slice(0, 4));
  const cerrados = state.ejercicios.filter(e => e.estado === 'CERRADO').map(e => e.anio);
  // Años con datos: desde el primer comprobante, compra o movimiento hasta el actual
  const fechas = [...state.invoices.map(i => i.fechaEmision), ...state.purchases.map(p => p.fecha), ...state.kardex.map(k => k.fechaEmision ?? k.date)].filter(Boolean);
  const primero = Math.min(actual, ...fechas.map(f => Number(f.slice(0, 4))), ...state.ejercicios.map(e => e.anio));
  const anios = Array.from({ length: actual - primero + 1 }, (_, i) => actual - i);

  return (
    <div className="space-y-5">
      <Tarjeta className="p-5 text-sm space-y-1 text-tinta-suave">
        <p className="font-extrabold text-tinta">Cómo funciona el cierre</p>
        <p>Desde el 1 de enero se cierra el año anterior: las cuentas de gastos (6) e ingresos (7) se saldan contra <b>891 Utilidad</b> o <b>892 Pérdida</b> y el resultado pasa a <b>5911 Utilidades acumuladas</b> o <b>5921 Pérdidas acumuladas</b>.</p>
        <p>Las cuentas 1 a 5 (caja, bancos, inventario, cuentas por cobrar y pagar) siguen con su saldo: esa foto al 1 de enero es el saldo inicial del nuevo año, y el stock valorizado es el inventario inicial del Kardex 13.1.</p>
        <p>El año cerrado queda bloqueado. Antes de cerrar, registra con tu contador los ajustes (depreciación, provisiones, impuesto a la renta) como asiento manual.</p>
      </Tarjeta>
      {anios.map(anio => <Anio key={anio} anio={anio} abierto={!cerrados.includes(anio)} anteriorAbierto={anios.some(a => a < anio && !cerrados.includes(a))} actual={actual} />)}
    </div>
  );
}

function Anio({ anio, abierto, anteriorAbierto, actual }: { anio: number; abierto: boolean; anteriorAbierto: boolean; actual: number }) {
  const { state, actions, nube } = useErp();
  const ejercicio = state.ejercicios.find(e => e.anio === anio);
  const [diario, setDiario] = useState<Asiento[] | null>(null);
  const [apertura, setApertura] = useState<AperturaEjercicio | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (nube ? repo.cargarDiario(`${anio}-01-01`, `${anio}-12-31`) : Promise.resolve(diarioDemo(state)))
      .then(d => { if (vivo) setDiario(d); })
      .catch(e => { if (vivo) setError(String(e instanceof Error ? e.message : e)); });
    if (!abierto) actions.aperturaDe(anio + 1).then(a => { if (vivo) setApertura(a); }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, abierto, nube, state.asientosExtra, state.invoices, state.gastos]);

  const r = diario ? asientosDeCierre(diario.filter(a => a.origen !== 'CIERRE'), anio) : null;
  const pendientes = state.invoices.filter(i => i.fechaEmision.startsWith(String(anio)) && porEmitir(i)).length;
  const terminado = anio < actual;
  const puede = abierto && terminado && !pendientes && !anteriorAbierto;

  const cerrar = async () => {
    if (!window.confirm(`¿Cerrar el ejercicio ${anio}? Nadie podrá registrar ni modificar nada con fecha de ${anio}.`)) return;
    setOcupado(true); setError(null); setOk(null);
    const res = await actions.cerrarEjercicio(anio);
    setOcupado(false);
    if (!res.ok) return setError(res.error);
    setOk(`Ejercicio ${anio} cerrado con ${res.resultado >= 0 ? 'utilidad' : 'pérdida'} de ${soles(Math.abs(res.resultado))}.`);
  };
  const reabrir = async () => {
    setOcupado(true); setError(null); setOk(null);
    const res = await actions.reabrirEjercicio(anio, motivo);
    setOcupado(false);
    if (!res.ok) return setError(res.error);
    setMotivo('');
    setApertura(null);
    setOk(`Ejercicio ${anio} reabierto.`);
  };

  return (
    <Bloque titulo={`Ejercicio ${anio}`} accion={abierto
      ? <Insignia tono={terminado ? 'aviso' : 'neutro'}><Unlock className="w-3 h-3" aria-hidden /> {terminado ? 'Por cerrar' : 'En curso'}</Insignia>
      : <Insignia tono="exito"><Lock className="w-3 h-3" aria-hidden /> Cerrado</Insignia>}>
      {r && (
        <div className="grid grid-cols-3 gap-3">
          <Cifra titulo="Ingresos (7)" valor={soles(r.ingresos)} />
          <Cifra titulo="Gastos y costos (6)" valor={soles(r.gastos)} />
          <Cifra titulo={(ejercicio?.resultado ?? r.resultado) >= 0 ? 'Utilidad' : 'Pérdida'} valor={soles(Math.abs(abierto ? r.resultado : ejercicio?.resultado ?? r.resultado))} tono={(ejercicio?.resultado ?? r.resultado) >= 0 ? 'bien' : 'mal'} />
        </div>
      )}

      {abierto ? (
        <>
          <ul className="text-xs space-y-1">
            <li>{terminado ? '✓' : '•'} {terminado ? 'El año terminó.' : `Se podrá cerrar desde el 1 de enero de ${anio + 1}.`}</li>
            <li>{pendientes ? '✗' : '✓'} {pendientes ? `${pendientes} comprobante(s) por emitir en SUNAT.` : 'Sin comprobantes por emitir.'}</li>
            {anteriorAbierto && <li>✗ Cierra primero los años anteriores.</li>}
          </ul>
          <Boton disabled={!puede} cargando={ocupado} onClick={() => void cerrar()}><Lock className="w-4 h-4" aria-hidden /> Cerrar ejercicio {anio}</Boton>
        </>
      ) : (
        <>
          <p className="text-xs text-tinta-suave">Cerrado {ejercicio?.cerradoAt?.slice(0, 10)}{ejercicio?.cerradoPor ? ` por ${ejercicio.cerradoPor}` : ''}.</p>
          {apertura && (
            <div className="grid lg:grid-cols-2 gap-4">
              <section aria-label={`Saldos iniciales ${anio + 1}`} className="space-y-1">
                <p className="font-bold text-tinta">Saldos iniciales al 01/01/{anio + 1}</p>
                <table className="w-full text-xs">
                  <thead className="text-tinta-suave"><tr><th className="text-left">Cuenta</th><th className="text-right">Debe</th><th className="text-right">Haber</th></tr></thead>
                  <tbody>{apertura.saldos.map(s => <tr key={s.cuenta} className="border-t border-crema-200"><td className="font-mono">{s.cuenta}</td><td className="text-right">{s.debe ? soles(s.debe) : ''}</td><td className="text-right">{s.haber ? soles(s.haber) : ''}</td></tr>)}</tbody>
                </table>
              </section>
              <section aria-label={`Inventario inicial ${anio + 1}`} className="space-y-1">
                <p className="font-bold text-tinta">Inventario inicial al 01/01/{anio + 1}</p>
                <table className="w-full text-xs">
                  <thead className="text-tinta-suave"><tr><th className="text-left">Producto</th><th className="text-right">Cant.</th><th className="text-right">C. unit.</th><th className="text-right">Total</th></tr></thead>
                  <tbody>{apertura.inventario.map(i => <tr key={i.sku} className="border-t border-crema-200"><td>{state.products.find(p => p.sku === i.sku)?.name ?? i.sku}</td><td className="text-right">{i.cantidad}</td><td className="text-right">{soles(i.costoUnitario)}</td><td className="text-right">{soles(i.costoTotal)}</td></tr>)}</tbody>
                </table>
              </section>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-crema-200">
            <input aria-label={`Motivo para reabrir ${anio}`} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo para reabrir (ej. corregir un gasto)" className="flex-1 min-w-[220px] min-h-[36px] px-3 rounded-control border border-crema-300 text-xs" />
            <Boton tamano="sm" variante="secundario" cargando={ocupado} onClick={() => void reabrir()}><Unlock className="w-4 h-4" aria-hidden /> Reabrir</Boton>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      {ok && <p role="status" className="text-exito font-bold text-xs">{ok}</p>}
    </Bloque>
  );
}
