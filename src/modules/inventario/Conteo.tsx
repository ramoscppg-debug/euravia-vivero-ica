import { useState } from 'react';
import { ClipboardCheck, Printer, Search } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { esc, imprimirHtml } from '../../lib/documentos';
import { hoyLocal } from '../../lib/fechas';
import { soles } from '../../lib/formato';
import { MOTIVOS_CONTEO, useErp, type MotivoConteo } from '../../store/ErpStore';

/**
 * Conteo físico del vivero: lo que se cuenta manda. Las plantas que murieron, tienen plaga,
 * están en cuarentena o se dañaron salen como merma valorizada; lo demás, como ajuste.
 */
export default function Conteo() {
  const { state, actions } = useErp();
  const { products, company } = state;
  const [contado, setContado] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<Record<string, MotivoConteo>>({});
  const [q, setQ] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const texto = q.trim().toLowerCase();
  const lista = products.filter(p => !texto || p.name.toLowerCase().includes(texto) || p.sku.toLowerCase().includes(texto) || p.location.toLowerCase().includes(texto));
  const diferencias = products
    .filter(p => contado[p.sku] !== undefined && contado[p.sku] !== '')
    .map(p => ({ p, contado: Math.max(0, Math.floor(Number(contado[p.sku]) || 0)) }))
    .map(x => ({ ...x, dif: x.contado - x.p.stock, motivo: motivo[x.p.sku] ?? (x.contado - x.p.stock > 0 ? 'SOBRANTE' : x.p.isLivePlant ? 'MURIO' : 'DANADA') }))
    .filter(x => x.dif !== 0);
  const perdida = diferencias.filter(d => d.dif < 0).reduce((a, d) => a + -d.dif * d.p.cost, 0);

  const imprimirHoja = () => imprimirHtml(`Hoja de conteo ${hoyLocal()}`, `<div class="hoja">
    <h1 style="font-size:18px">Hoja de conteo físico · ${esc(company.nombreComercial.split(' - ')[0] || company.razonSocial)}</h1>
    <p class="suave">Fecha: ${hoyLocal()} · Responsable: ____________________</p>
    <table><thead><tr><th>SKU</th><th>Producto</th><th>Ubicación</th><th class="d">Sistema</th><th class="d" style="width:90px">Contado</th><th style="width:170px">Observación (murió, plaga…)</th></tr></thead>
    <tbody>${[...products].sort((a, b) => a.location.localeCompare(b.location)).map(p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.location)}</td><td class="d">${p.stock}</td><td></td><td></td></tr>`).join('')}</tbody></table></div>`);

  const aplicar = async () => {
    if (!diferencias.length) return;
    if (!confirm(`Se registrarán ${diferencias.length} diferencia(s)${perdida ? ` con una pérdida de ${soles(perdida)}` : ''}. ¿Continuar?`)) return;
    setAplicando(true);
    const r = await actions.aplicarConteo(diferencias.map(d => ({ sku: d.p.sku, contado: d.contado, motivo: d.motivo })));
    setAplicando(false);
    if (!r.ok) return alert(r.error);
    setResultado(`✓ Conteo aplicado: ${r.bajas} baja(s) por merma y ${r.ajustes} ajuste(s) de inventario.`);
    setContado({});
    setMotivo({});
  };

  if (!products.length) return <EstadoVacio titulo="Sin productos para contar" />;

  return (
    <div className="space-y-5 text-sm">
      <Tarjeta className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-tinta flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-bosque-700" aria-hidden /> Conteo físico</h3>
          <p className="text-xs text-tinta-suave">1) Imprime la hoja y cuenta en el vivero. 2) Escribe lo contado; sólo cambian los productos con diferencia. 3) Elige por qué falta cada uno (plaga, murió…) y aplica.</p>
        </div>
        <Boton variante="secundario" onClick={imprimirHoja}><Printer className="w-4 h-4" aria-hidden /> Imprimir hoja de conteo</Boton>
      </Tarjeta>

      {resultado && <p role="status" className="p-3 rounded-control bg-exito-fondo text-exito font-bold">{resultado}</p>}

      <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-control bg-white border border-crema-300">
        <Search className="w-4 h-4 text-tinta-suave" aria-hidden />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto, SKU o ubicación" aria-label="Buscar en el conteo" className="flex-1 bg-transparent outline-none" />
      </label>

      <div className="bg-white rounded-3xl border border-crema-300 overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[720px]">
          <thead className="text-[10px] uppercase text-tinta-suave bg-crema"><tr><th className="text-left p-3">Producto</th><th className="text-left">Ubicación</th><th className="text-right">Sistema</th><th className="text-right w-28">Contado</th><th className="text-right">Diferencia</th><th className="text-left pl-4">Motivo</th></tr></thead>
          <tbody className="divide-y divide-crema-200">
            {lista.map(p => {
              const d = diferencias.find(x => x.p.sku === p.sku);
              return (
                <tr key={p.sku} className={d ? (d.dif < 0 ? 'bg-error-fondo/30' : 'bg-exito-fondo/40') : ''}>
                  <td className="p-3"><span className="font-bold text-tinta">{p.name}</span><span className="block text-[11px] font-mono text-tinta-suave">{p.sku}</span></td>
                  <td className="text-xs">{p.location || '—'}</td>
                  <td className="text-right font-bold">{p.stock}</td>
                  <td className="text-right"><input type="number" min={0} aria-label={`Contado de ${p.name}`} value={contado[p.sku] ?? ''} onChange={e => setContado(c => ({ ...c, [p.sku]: e.target.value }))} placeholder={String(p.stock)} className="w-20 min-h-[36px] px-2 rounded-control border border-crema-300 text-right font-bold" /></td>
                  <td className={`text-right font-extrabold ${d ? (d.dif < 0 ? 'text-error' : 'text-exito') : 'text-tinta-suave'}`}>{d ? (d.dif > 0 ? `+${d.dif}` : d.dif) : '—'}</td>
                  <td className="pl-4 pr-3">
                    {d && (d.dif < 0 ? (
                      <select aria-label={`Motivo de ${p.name}`} value={d.motivo} onChange={e => setMotivo(m => ({ ...m, [p.sku]: e.target.value as MotivoConteo }))} className="min-h-[36px] px-2 rounded-control border border-crema-300 bg-white text-xs font-semibold">
                        {(['MURIO', 'PLAGA', 'CUARENTENA', 'DANADA', 'FALTANTE'] as MotivoConteo[]).map(m => <option key={m} value={m}>{MOTIVOS_CONTEO[m]}</option>)}
                      </select>
                    ) : <Insignia tono="exito">{MOTIVOS_CONTEO.SOBRANTE}</Insignia>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {diferencias.length > 0 && <span className="text-xs text-tinta-suave">{diferencias.length} diferencia(s){perdida ? ` · pérdida estimada ${soles(perdida)}` : ''}</span>}
        <Boton disabled={!diferencias.length} cargando={aplicando} onClick={() => void aplicar()}>Aplicar conteo</Boton>
      </div>
      <p className="text-[11px] text-tinta-suave">Las plantas en cuarentena se registran como baja en observación: no salen del stock hasta que decidas.</p>
    </div>
  );
}
