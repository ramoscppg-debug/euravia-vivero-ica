import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Download, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { Boton, EstadoError, Insignia, Tarjeta } from '../../components/ui';
import { csv } from '../../lib/analitica';
import {
  armarPlan, CONFIG_CONTABLE, cuadra, CUENTAS_EXISTENCIA, diarioDemo, ELEMENTOS, mayor, rutaCuenta,
  type Asiento, type Cuenta, type CuentasExistencia, type LineaAsiento
} from '../../lib/contabilidad';
import { esc, imprimirHtml } from '../../lib/documentos';
import { descargarTxt } from '../../lib/exports';
import { hoyLocal } from '../../lib/fechas';
import { TABLA_10 } from '../../lib/kardexValorado';
import * as repo from '../../lib/repo';
import { useErp } from '../../store/ErpStore';

type Pestana = 'diario' | 'mayor' | 'plan' | 'cuentas';
const n2 = (n: number) => (n ? n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

/** Contabilidad PCGE 2026: libro diario automático, mayor, plan de cuentas y cuentas por tipo de existencia. */
export default function LibroDiario() {
  const { state, nube } = useErp();
  const [pestana, setPestana] = useState<Pestana>('diario');
  const [periodo, setPeriodo] = useState(hoyLocal().slice(0, 7));
  const [plan, setPlan] = useState<Cuenta[] | null>(null);
  const [existencias, setExistencias] = useState<CuentasExistencia[]>(CUENTAS_EXISTENCIA);
  const [config, setConfig] = useState(CONFIG_CONTABLE);
  const [asientos, setAsientos] = useState<Asiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [y, m] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  // Plan y cuentas: de la base en la nube; en demo, el catálogo del PDF incluido en la app
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (nube) {
          const [p, e, c] = await Promise.all([repo.cargarPlanCuentas(), repo.cargarCuentasExistencia(), repo.cargarConfigContable()]);
          if (vivo) { setPlan(p); setExistencias(e); setConfig(c); }
        } else {
          const filas = (await import('../../data/pcge2026.json')).default as [string, string][];
          if (vivo) setPlan(armarPlan(filas));
        }
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { vivo = false; };
  }, [nube, recarga]);

  useEffect(() => {
    let vivo = true;
    setAsientos(null);
    (async () => {
      try {
        const lista = nube ? await repo.cargarDiario(desde, hasta) : diarioDemo(state).filter(a => a.fecha >= desde && a.fecha <= hasta);
        if (vivo) setAsientos(lista);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { vivo = false; };
  }, [nube, desde, hasta, state, recarga]);

  const mapa = useMemo(() => new Map((plan ?? []).map(c => [c.codigo, c])), [plan]);
  const nombre = (codigo: string) => (mapa.size ? rutaCuenta(mapa, codigo) : codigo);

  return (
    <div className="space-y-5 text-sm">
      <Tarjeta className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-tinta flex items-center gap-2"><BookOpenCheck className="w-5 h-5 text-bosque-700" aria-hidden /> Contabilidad · PCGE 2026</h3>
          <p className="text-xs text-tinta-suave">Plan Contable General Empresarial 2026. Cada venta, compra, cobro, producción y merma genera su asiento al instante con el costo promedio del Kardex; todo asiento cuadra (debe = haber).</p>
        </div>
        <label className="text-xs font-bold">Periodo<input type="month" aria-label="Periodo contable" value={periodo} onChange={e => setPeriodo(e.target.value)} className="block mt-1 min-h-[38px] px-2 rounded-control border border-crema-300" /></label>
      </Tarjeta>

      <div className="flex flex-wrap gap-1.5 text-xs" role="tablist" aria-label="Libros contables">
        {([['diario', 'Libro diario'], ['mayor', 'Libro mayor'], ['plan', 'Plan de cuentas'], ['cuentas', 'Cuentas por existencia']] as const).map(([id, t]) => (
          <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`px-3 py-1.5 rounded-full font-bold border ${pestana === id ? 'bg-bosque-950 text-white border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>{t}</button>
        ))}
      </div>

      {error && <EstadoError mensaje={error} reintentar={() => { setError(null); setRecarga(r => r + 1); }} />}
      {pestana === 'diario' && <Diario asientos={asientos} nombre={nombre} periodo={periodo} plan={plan} alGuardar={() => setRecarga(r => r + 1)} />}
      {pestana === 'mayor' && <Mayor asientos={asientos} mapa={mapa} periodo={periodo} />}
      {pestana === 'plan' && <Plan plan={plan} alCrear={() => setRecarga(r => r + 1)} />}
      {pestana === 'cuentas' && <CuentasConfig plan={plan} existencias={existencias} setExistencias={setExistencias} config={config} setConfig={setConfig} nombre={nombre} />}
    </div>
  );
}

function Diario({ asientos, nombre, periodo, plan, alGuardar }: { asientos: Asiento[] | null; nombre: (c: string) => string; periodo: string; plan: Cuenta[] | null; alGuardar: () => void }) {
  const { state, nube } = useErp();
  const [nuevo, setNuevo] = useState(false);
  if (!asientos) return <p className="text-tinta-suave">Cargando asientos…</p>;
  const total = asientos.reduce((a, x) => ({ debe: a.debe + x.lineas.reduce((s, l) => s + l.debe, 0), haber: a.haber + x.lineas.reduce((s, l) => s + l.haber, 0) }), { debe: 0, haber: 0 });
  const descuadrados = asientos.filter(a => !cuadra(a)).length;

  const exportar = () => descargarTxt(`libro_diario_${state.company.ruc || 'empresa'}_${periodo.replace('-', '')}.csv`, `﻿${csv([
    ['FORMATO 5.1: LIBRO DIARIO', `PERIODO ${periodo.replace('-', '')}`, `RUC ${state.company.ruc}`, state.company.razonSocial],
    ['N° CORRELATIVO', 'FECHA', 'GLOSA', 'TIPO DOC. (T10)', 'SERIE', 'NÚMERO', 'CÓDIGO CUENTA', 'DENOMINACIÓN', 'DEBE', 'HABER'],
    ...asientos.flatMap((a, i) => a.lineas.map(l => [i + 1, a.fecha, a.glosa, a.tipoComprobante ?? '', a.serie ?? '', a.numero ?? '', l.cuenta, nombre(l.cuenta), l.debe.toFixed(2), l.haber.toFixed(2)])),
    ['', '', 'TOTALES', '', '', '', '', '', total.debe.toFixed(2), total.haber.toFixed(2)]
  ])}`);

  const imprimir = () => imprimirHtml(`Libro diario ${periodo}`, `<div class="hoja" style="max-width:none;padding:16px">
    <h1 style="font-size:13px;text-align:center">FORMATO 5.1: LIBRO DIARIO</h1>
    <p>PERIODO: <b>${periodo.replace('-', '')}</b> · RUC: <b>${esc(state.company.ruc)}</b> · ${esc(state.company.razonSocial)}</p>
    <table style="font-size:9px"><thead><tr><th>N°</th><th>FECHA</th><th>GLOSA</th><th>DOC.</th><th>CUENTA</th><th>DENOMINACIÓN</th><th class="d">DEBE</th><th class="d">HABER</th></tr></thead><tbody>
    ${asientos.map((a, i) => a.lineas.map((l, j) => `<tr><td>${j ? '' : i + 1}</td><td>${j ? '' : a.fecha}</td><td>${j ? '' : esc(a.glosa)}</td><td>${j ? '' : esc([a.tipoComprobante, a.serie, a.numero].filter(Boolean).join('-'))}</td>
      <td>${l.cuenta}</td><td>${esc(nombre(l.cuenta))}</td><td class="d">${n2(l.debe)}</td><td class="d">${n2(l.haber)}</td></tr>`).join('')).join('')}
    <tr><td colspan="6"><b>TOTALES</b></td><td class="d"><b>${n2(total.debe)}</b></td><td class="d"><b>${n2(total.haber)}</b></td></tr></tbody></table></div>`,
  '@page{size:A4 landscape;margin:8mm} td,th{padding:3px 5px}');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-tinta-suave">{asientos.length} asiento(s) · Debe S/ {n2(total.debe) || '0.00'} · Haber S/ {n2(total.haber) || '0.00'} {descuadrados ? <Insignia tono="error">{descuadrados} descuadrado(s)</Insignia> : <Insignia tono="exito">Todo cuadra</Insignia>}</p>
        <div className="flex gap-2">
          {nube && <Boton tamano="sm" variante="secundario" onClick={() => setNuevo(v => !v)}><Plus className="w-3.5 h-3.5" aria-hidden /> Asiento manual</Boton>}
          <Boton tamano="sm" variante="secundario" disabled={!asientos.length} onClick={imprimir}><Printer className="w-3.5 h-3.5" aria-hidden /> Imprimir</Boton>
          <Boton tamano="sm" variante="secundario" disabled={!asientos.length} onClick={exportar}><Download className="w-3.5 h-3.5" aria-hidden /> CSV</Boton>
        </div>
      </div>
      {nuevo && plan && <AsientoManual plan={plan} alGuardar={() => { setNuevo(false); alGuardar(); }} />}
      {!asientos.length && <p className="p-6 rounded-3xl bg-white border border-crema-300 text-tinta-suave text-center">Sin asientos en el periodo.</p>}
      <ol className="space-y-3">
        {asientos.map((a, i) => (
          <li key={a.id} className="bg-white rounded-2xl border border-crema-300 overflow-hidden" aria-label={`Asiento ${i + 1}`}>
            <div className="px-4 py-2 bg-crema flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold">N° {i + 1}</span><span>{a.fecha}</span><span className="font-semibold text-tinta">{a.glosa}</span>
              {a.tipoComprobante && <span className="text-tinta-suave" title={TABLA_10[a.tipoComprobante]}>Doc. {a.tipoComprobante}{a.serie ? ` · ${a.serie}-${a.numero}` : ''}</span>}
              <Insignia className="ml-auto">{a.origen}</Insignia>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-crema-200">
                {a.lineas.map((l, j) => (
                  <tr key={j}>
                    <td className={`py-1.5 font-mono font-bold w-20 ${l.haber ? 'pl-10' : 'pl-4'}`}>{l.cuenta}</td>
                    <td className={l.haber ? 'pl-6' : ''}>{nombre(l.cuenta)}</td>
                    <td className="text-right w-28 font-semibold">{n2(l.debe)}</td>
                    <td className="text-right w-28 pr-4 font-semibold">{n2(l.haber)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AsientoManual({ plan, alGuardar }: { plan: Cuenta[]; alGuardar: () => void }) {
  const { state } = useErp();
  const [fecha, setFecha] = useState(hoyLocal());
  const [glosa, setGlosa] = useState('');
  const [lineas, setLineas] = useState<LineaAsiento[]>([{ cuenta: '', debe: 0, haber: 0 }, { cuenta: '', debe: 0, haber: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const hojas = plan.filter(c => c.aceptaMovimiento);
  const debe = lineas.reduce((a, l) => a + l.debe, 0);
  const haber = lineas.reduce((a, l) => a + l.haber, 0);
  const cambiar = (i: number, c: Partial<LineaAsiento>) => setLineas(ls => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const guardar = async () => {
    setError(null);
    if (Math.round((debe - haber) * 100) !== 0) return setError('El asiento no cuadra: el debe debe ser igual al haber.');
    try {
      await repo.registrarAsientoManual({ fecha, glosa, lineas: lineas.filter(l => l.cuenta && (l.debe || l.haber)), usuario: state.company.razonSocial });
      alGuardar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const campo = 'min-h-[36px] px-2 rounded-control border border-crema-300 bg-white';
  return (
    <Tarjeta className="p-4 space-y-2 text-xs">
      <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <input type="date" aria-label="Fecha del asiento" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} />
        <input aria-label="Glosa del asiento" value={glosa} onChange={e => setGlosa(e.target.value)} placeholder="Glosa (ej.: Pago de luz del vivero)" className={campo} />
      </div>
      <datalist id="cuentas-imputables">{hojas.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}</datalist>
      {lineas.map((l, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_110px_110px_32px] gap-2 items-center">
          <input list="cuentas-imputables" aria-label={`Cuenta ${i + 1}`} value={l.cuenta} onChange={e => cambiar(i, { cuenta: e.target.value.trim() })} placeholder="Cuenta" className={`${campo} font-mono`} />
          <span className="truncate text-tinta-suave">{plan.find(c => c.codigo === l.cuenta)?.nombre ?? ''}</span>
          <input type="number" min={0} step="0.01" aria-label={`Debe ${i + 1}`} value={l.debe || ''} onChange={e => cambiar(i, { debe: Number(e.target.value) || 0, haber: 0 })} placeholder="Debe" className={campo} />
          <input type="number" min={0} step="0.01" aria-label={`Haber ${i + 1}`} value={l.haber || ''} onChange={e => cambiar(i, { haber: Number(e.target.value) || 0, debe: 0 })} placeholder="Haber" className={campo} />
          <button onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} aria-label={`Quitar línea ${i + 1}`} className="p-1.5 rounded-lg bg-error-fondo text-error"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setLineas(ls => [...ls, { cuenta: '', debe: 0, haber: 0 }])} className="font-bold text-bosque-700">+ Línea</button>
        <span className={Math.round((debe - haber) * 100) ? 'text-error font-bold' : 'text-exito font-bold'}>Debe {n2(debe) || '0.00'} · Haber {n2(haber) || '0.00'}</span>
        <Boton tamano="sm" onClick={() => void guardar()}>Registrar asiento</Boton>
      </div>
      {error && <p role="alert" className="text-error font-bold">{error}</p>}
    </Tarjeta>
  );
}

function Mayor({ asientos, mapa, periodo }: { asientos: Asiento[] | null; mapa: Map<string, Cuenta>; periodo: string }) {
  if (!asientos) return <p className="text-tinta-suave">Cargando…</p>;
  const filas = mayor(asientos, mapa);
  const exportar = () => descargarTxt(`libro_mayor_${periodo.replace('-', '')}.csv`, `﻿${csv([
    ['CUENTA', 'DENOMINACIÓN', 'DEBE', 'HABER', 'SALDO DEUDOR', 'SALDO ACREEDOR'],
    ...filas.map(f => [f.codigo, f.nombre, f.debe.toFixed(2), f.haber.toFixed(2), f.saldoDeudor.toFixed(2), f.saldoAcreedor.toFixed(2)])
  ])}`);
  const porElemento = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(e => ({ e, filas: filas.filter(f => f.elemento === e) })).filter(x => x.filas.length);
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Boton tamano="sm" variante="secundario" disabled={!filas.length} onClick={exportar}><Download className="w-3.5 h-3.5" aria-hidden /> CSV</Boton></div>
      {!filas.length && <p className="text-tinta-suave">Sin movimientos en el periodo.</p>}
      {porElemento.map(({ e, filas: fs }) => (
        <Tarjeta key={e} className="p-4 space-y-2">
          <p className="font-extrabold text-tinta">Elemento {e}: {ELEMENTOS[e]}</p>
          <table className="w-full text-xs" aria-label={`Mayor del elemento ${e}`}>
            <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1">Cuenta</th><th className="text-left">Denominación</th><th className="text-right">Debe</th><th className="text-right">Haber</th><th className="text-right">Saldo deudor</th><th className="text-right">Saldo acreedor</th></tr></thead>
            <tbody className="divide-y divide-crema-200">
              {fs.map(f => <tr key={f.codigo}><td className="py-1.5 font-mono font-bold">{f.codigo}</td><td>{f.nombre}</td><td className="text-right">{n2(f.debe)}</td><td className="text-right">{n2(f.haber)}</td><td className="text-right font-bold">{n2(f.saldoDeudor)}</td><td className="text-right font-bold">{n2(f.saldoAcreedor)}</td></tr>)}
            </tbody>
          </table>
        </Tarjeta>
      ))}
    </div>
  );
}

function Plan({ plan, alCrear }: { plan: Cuenta[] | null; alCrear: () => void }) {
  const { nube } = useErp();
  const [q, setQ] = useState('');
  const [elemento, setElemento] = useState(2);
  const [nueva, setNueva] = useState({ codigo: '', nombre: '' });
  const [aviso, setAviso] = useState<string | null>(null);
  if (!plan) return <p className="text-tinta-suave">Cargando plan de cuentas…</p>;
  const texto = q.trim().toLowerCase();
  const lista = plan.filter(c => (texto ? c.codigo.startsWith(texto) || c.nombre.toLowerCase().includes(texto) : c.elemento === elemento)).slice(0, 400);
  const crear = async () => {
    setAviso(null);
    const codigo = nueva.codigo.trim();
    if (!/^\d{3,10}$/.test(codigo) || !nueva.nombre.trim()) return setAviso('Escribe un código de 3 a 10 dígitos y un nombre.');
    if (plan.some(c => c.codigo === codigo)) return setAviso('Ese código ya existe.');
    try {
      await repo.crearSubcuenta(codigo, nueva.nombre.trim());
      setNueva({ codigo: '', nombre: '' });
      setAviso(`✓ Cuenta ${codigo} creada.`);
      alCrear();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex-1 min-w-[220px] flex items-center gap-2 min-h-[40px] px-3 rounded-control bg-white border border-crema-300">
          <Search className="w-4 h-4 text-tinta-suave" aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código o nombre (ej. 21, venta, IGV)" aria-label="Buscar cuenta" className="flex-1 bg-transparent outline-none" />
        </label>
        {!texto && (
          <select value={elemento} onChange={e => setElemento(Number(e.target.value))} aria-label="Elemento" className="min-h-[40px] px-2 rounded-control border border-crema-300 bg-white font-semibold">
            {Object.entries(ELEMENTOS).map(([k, v]) => <option key={k} value={k}>Elemento {k}: {v}</option>)}
          </select>
        )}
        <Insignia>{plan.length} cuentas · PCGE 2026</Insignia>
      </div>
      <Tarjeta className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <ul className="text-xs">
          {lista.map(c => (
            <li key={c.codigo} className="flex items-center gap-2 py-1 border-b border-crema-100" style={{ paddingLeft: `${(c.nivel - 2) * 18 + 6}px` }}>
              <span className={`font-mono ${c.nivel <= 3 ? 'font-extrabold' : 'font-semibold'} w-16 shrink-0`}>{c.codigo}</span>
              <span className={c.nivel === 2 ? 'font-extrabold' : ''}>{c.nombre}</span>
              {c.aceptaMovimiento && <span className="ml-auto text-[10px] text-exito font-bold">imputable</span>}
              {c.personalizada && <Insignia tono="acento">propia</Insignia>}
            </li>
          ))}
        </ul>
      </Tarjeta>
      {nube && (
        <Tarjeta className="p-4 space-y-2 text-xs">
          <p className="font-bold text-tinta">Crear divisionaria propia</p>
          <p className="text-tinta-suave">Por ejemplo 211101 "Rosas" bajo 21111. La cuenta superior deja de recibir asientos (sólo si aún no tiene movimientos).</p>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Código de la nueva cuenta" value={nueva.codigo} onChange={e => setNueva({ ...nueva, codigo: e.target.value.replace(/\D/g, '') })} placeholder="Código" className="w-32 min-h-[36px] px-2 rounded-control border border-crema-300 font-mono" />
            <input aria-label="Nombre de la nueva cuenta" value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Nombre" className="flex-1 min-w-[200px] min-h-[36px] px-2 rounded-control border border-crema-300" />
            <Boton tamano="sm" onClick={() => void crear()}>Crear</Boton>
          </div>
          {aviso && <p role="status" className="font-bold">{aviso}</p>}
        </Tarjeta>
      )}
    </div>
  );
}

const CAMPOS: [keyof CuentasExistencia, string][] = [
  ['inventario', 'Inventario (Elem. 2)'], ['compra', 'Compra (60)'], ['variacion', 'Variación / consumo (61)'], ['costoVenta', 'Costo de ventas (69)'],
  ['venta', 'Venta (70)'], ['devolucionVenta', 'Devolución (709)'], ['deterioro', 'Merma / desmedro (695)'], ['variacionProduccion', 'Producción almacenada (71)']
];

function CuentasConfig({ plan, existencias, setExistencias, config, setConfig, nombre }: {
  plan: Cuenta[] | null; existencias: CuentasExistencia[]; setExistencias: (e: CuentasExistencia[]) => void;
  config: Record<string, { cuenta: string; descripcion: string }>; setConfig: (c: Record<string, { cuenta: string; descripcion: string }>) => void; nombre: (c: string) => string;
}) {
  const { nube } = useErp();
  const [aviso, setAviso] = useState<string | null>(null);
  const hojas = new Set((plan ?? []).filter(c => c.aceptaMovimiento).map(c => c.codigo));
  const valida = (c?: string) => !c || hojas.has(c);

  const guardarExistencia = async (e: CuentasExistencia) => {
    setAviso(null);
    const mala = CAMPOS.map(([k]) => e[k] as string | undefined).find(c => !valida(c));
    if (mala) return setAviso(`La cuenta ${mala} no existe o no es de último nivel.`);
    try {
      if (nube) await repo.guardarCuentasExistencia(e);
      setExistencias(existencias.map(x => (x.tipoExistencia === e.tipoExistencia ? e : x)));
      setAviso(`✓ Cuentas de "${e.descripcion}" guardadas.`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-tinta-suave">Qué cuentas usa cada asiento automático según el <b>tipo de existencia</b> del producto (SUNAT Tabla 5), que se elige en la ficha del producto. Sólo se aceptan cuentas de último nivel. {!nube && 'En el modo demo los cambios no se guardan.'}</p>
      {aviso && <p role="status" className="font-bold text-xs">{aviso}</p>}
      {existencias.map(e => <FilaExistencia key={e.tipoExistencia} e={e} valida={valida} nombre={nombre} guardar={guardarExistencia} />)}
      <Tarjeta className="p-4 space-y-2 text-xs">
        <p className="font-extrabold text-tinta">Cuentas generales</p>
        <table className="w-full"><tbody className="divide-y divide-crema-200">
          {Object.entries(config).map(([clave, v]) => (
            <tr key={clave}>
              <td className="py-1.5 w-1/2">{v.descripcion}</td>
              <td><input aria-label={`Cuenta de ${v.descripcion}`} defaultValue={v.cuenta}
                onBlur={async ev => {
                  const cuenta = ev.target.value.trim();
                  if (cuenta === v.cuenta) return;
                  if (!valida(cuenta)) { setAviso(`La cuenta ${cuenta} no es de último nivel.`); ev.target.value = v.cuenta; return; }
                  try { if (nube) await repo.guardarConfigContable(clave, cuenta); setConfig({ ...config, [clave]: { ...v, cuenta } }); setAviso('✓ Guardado.'); } catch (err) { setAviso(err instanceof Error ? err.message : String(err)); }
                }}
                className="w-28 min-h-[32px] px-2 rounded-control border border-crema-300 font-mono" /></td>
              <td className="text-tinta-suave">{nombre(v.cuenta)}</td>
            </tr>
          ))}
        </tbody></table>
      </Tarjeta>
    </div>
  );
}

function FilaExistencia({ e, valida, nombre, guardar }: { e: CuentasExistencia; valida: (c?: string) => boolean; nombre: (c: string) => string; guardar: (e: CuentasExistencia) => Promise<void> }) {
  const [v, setV] = useState(e);
  return (
    <Tarjeta className="p-4 space-y-2 text-xs">
      <p className="font-extrabold text-tinta">{e.tipoExistencia} · {e.descripcion}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map(([k, t]) => {
          const val = (v[k] as string | undefined) ?? '';
          return (
            <label key={k} className="block font-bold">{t}
              <input aria-label={`${t} de ${e.descripcion}`} value={val} onChange={ev => setV({ ...v, [k]: ev.target.value.trim() || undefined })}
                className={`block w-full mt-1 min-h-[34px] px-2 rounded-control border font-mono ${valida(val) ? 'border-crema-300' : 'border-error bg-error-fondo'}`} />
              <span className="block font-normal text-[10px] text-tinta-suave truncate">{val ? nombre(val) : '—'}</span>
            </label>
          );
        })}
      </div>
      <div className="flex justify-end"><Boton tamano="sm" variante="secundario" onClick={() => void guardar(v)}>Guardar</Boton></div>
    </Tarjeta>
  );
}
