// ==========================================
// AVISOS POR WHATSAPP
// Resumen de cada mañana (8:00 a. m.) a tu WhatsApp con las ventas, la meta y lo que vence,
// más los vencimientos que anotas tú (cronograma SUNAT según tu RUC, alquiler, préstamos…).
// ==========================================
import { useState } from 'react';
import { BellRing, Check, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '../../components/ui';
import { hoyLocal } from '../../lib/fechas';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const campo = 'min-h-[40px] px-3 rounded-control border border-crema-300 bg-white text-sm';

export default function AvisosAgenda() {
  const { state, actions, nube } = useErp();
  const { setTab } = useUi();
  const avisos = state.avisos;
  const [vista, setVista] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nuevo, setNuevo] = useState({ fecha: hoyLocal(), descripcion: '' });
  const hoy = hoyLocal();

  const cambiar = async (cambios: Partial<typeof avisos>) => {
    const r = await actions.guardarAvisos({ ...avisos, ...cambios });
    setMsg(r.ok ? { ok: true, texto: 'Guardado ✓' } : { ok: false, texto: r.error });
  };
  const ver = async (enviar: boolean) => {
    const r = await actions.verResumenDiario(enviar);
    if (!r.ok) return setMsg({ ok: false, texto: r.error });
    setVista(r.texto);
    setMsg(enviar ? (r.enviado ? { ok: true, texto: 'Enviado: revisa tu WhatsApp en unos segundos.' } : { ok: false, texto: 'No se envió: revisa que los avisos estén activos con tu número y clave.' }) : null);
  };
  const agregar = async () => {
    const r = await actions.agregarVencimiento(nuevo.fecha, nuevo.descripcion);
    if (!r.ok) return setMsg({ ok: false, texto: r.error });
    setNuevo({ ...nuevo, descripcion: '' });
  };

  const pendientes = state.vencimientos.filter(v => !v.hecho);
  const hechos = state.vencimientos.filter(v => v.hecho).slice(-5);

  return (
    <div className="space-y-5 max-w-4xl">
      <Tarjeta as="section" className="p-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-tinta flex items-center gap-2"><BellRing className="w-5 h-5 text-bosque-700" aria-hidden /> Resumen diario por WhatsApp</h3>
          <Insignia tono={avisos.activo && avisos.resumenDiario ? 'exito' : 'neutro'}>{avisos.activo && avisos.resumenDiario ? 'Activo · 8:00 a. m.' : 'Apagado'}</Insignia>
        </div>
        <p className="text-xs text-tinta-suave">Cada mañana a las 8:00 a. m. te llega a tu WhatsApp: ventas de ayer, avance de la meta, vencimientos y detracciones de los próximos días, comprobantes por emitir, pedidos para entregar, pedidos web sin atender, cotizaciones y cuentas por pagar.</p>
        {!avisos.activo && (
          <p className="p-3 rounded-control bg-aviso-fondo text-aviso text-xs font-bold">
            Primero conecta tu WhatsApp (CallMeBot) en Ajustes → Avisos de pedidos. <button onClick={() => setTab('configuracion')} className="underline">Ir a Ajustes</button>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" disabled={!avisos.activo} checked={!!avisos.resumenDiario} onChange={e => void cambiar({ resumenDiario: e.target.checked })} /> Enviarme el resumen cada mañana</label>
          <label className="flex items-center gap-2 text-xs">Avisar vencimientos con
            <select aria-label="Días de anticipación" value={avisos.diasAnticipacion ?? 3} onChange={e => void cambiar({ diasAnticipacion: Number(e.target.value) })} className={campo}>
              {[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} día(s)</option>)}
            </select> de anticipación
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton tamano="sm" variante="secundario" onClick={() => void ver(false)}>Ver el resumen de hoy</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!nube || !avisos.activo} onClick={() => void ver(true)}><Send className="w-4 h-4" aria-hidden /> Enviármelo ahora</Boton>
        </div>
        {msg && <p role="status" className={`text-xs font-bold ${msg.ok ? 'text-exito' : 'text-error'}`}>{msg.texto}</p>}
        {vista && <pre aria-label="Vista previa del resumen" className="p-3 rounded-control bg-[#e7fbe6] text-xs text-tinta whitespace-pre-wrap font-sans">{vista}</pre>}
      </Tarjeta>

      <Tarjeta as="section" className="p-5 space-y-3 text-sm">
        <h3 className="font-extrabold text-tinta">Vencimientos</h3>
        <p className="text-xs text-tinta-suave">
          Anota las fechas que no puedes olvidar: PDT 621, SIRE, PLE y PLAME según el último dígito de tu RUC (cronograma de obligaciones que publica SUNAT cada año), alquiler, préstamos, licencias.
          Las detracciones y las cuentas por pagar ya se avisan solas.
        </p>
        <div className="grid grid-cols-[150px_1fr_auto] gap-2">
          <input aria-label="Fecha del vencimiento" type="date" value={nuevo.fecha} onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })} className={campo} />
          <input aria-label="Descripción del vencimiento" placeholder="Ej. PDT 621 de setiembre" value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} maxLength={150} className={campo} />
          <Boton onClick={() => void agregar()}><Plus className="w-4 h-4" aria-hidden /> Agregar</Boton>
        </div>
        {pendientes.length ? (
          <ul aria-label="Vencimientos pendientes" className="divide-y divide-crema-200">
            {pendientes.map(v => (
              <li key={v.id} className="py-2 flex items-center gap-2">
                <span className={`font-mono text-xs w-24 ${v.fecha < hoy ? 'text-error font-bold' : v.fecha === hoy ? 'text-aviso font-bold' : 'text-tinta-suave'}`}>{v.fecha}</span>
                <span className="flex-1">{v.descripcion}</span>
                {v.fecha < hoy && <Insignia tono="error">vencido</Insignia>}
                <Boton tamano="sm" variante="secundario" onClick={() => void actions.marcarVencimiento(v.id, true)}><Check className="w-4 h-4" aria-hidden /> Hecho</Boton>
                <button aria-label={`Quitar ${v.descripcion}`} onClick={() => void actions.eliminarVencimiento(v.id)} className="p-1.5 text-error"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-tinta-suave">No hay vencimientos pendientes.</p>}
        {hechos.length > 0 && (
          <details className="text-xs text-tinta-suave">
            <summary className="cursor-pointer font-bold">Hechos recientes</summary>
            <ul className="mt-1">{hechos.map(v => <li key={v.id} className="flex items-center gap-2 py-1"><span className="line-through">{v.fecha} {v.descripcion}</span><button onClick={() => void actions.marcarVencimiento(v.id, false)} aria-label={`Reabrir ${v.descripcion}`}><Undo2 className="w-3.5 h-3.5" /></button></li>)}</ul>
          </details>
        )}
      </Tarjeta>
    </div>
  );
}
