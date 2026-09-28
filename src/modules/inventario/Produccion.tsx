import { useState } from 'react';
import { Factory, Plus, Trash2 } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { saldoDe } from '../../lib/kardexValorado';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Producción propia (esquejes, siembra, trasplante, arreglos): los insumos salen al costo promedio (op. 10)
 * y el producto entra con su costo calculado (op. 19), ambos con parte de producción (doc. 00).
 */
export default function Produccion() {
  const { state, actions } = useErp();
  const { products, partesProduccion } = state;
  const [sku, setSku] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [insumos, setInsumos] = useState<{ sku: string; cantidad: string }[]>([]);
  const [costoAdicional, setCostoAdicional] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Costo estimado con el promedio vigente de cada insumo (el definitivo lo fija el Kardex al registrar)
  const lineas = insumos.map(i => {
    const p = products.find(x => x.sku === i.sku);
    const q = Number(i.cantidad) || 0;
    const cu = p ? saldoDe(p).costoUnitario : 0;
    return { ...i, p, q, cu, total: r4(q * cu) };
  });
  const costoInsumos = r4(lineas.reduce((a, l) => a + l.total, 0));
  const adicional = Number(costoAdicional) || 0;
  const q = Number(cantidad) || 0;
  const costoUnitario = q > 0 ? r4((costoInsumos + adicional) / q) : 0;
  const nombre = (s: string) => products.find(p => p.sku === s)?.name ?? s;

  const registrar = async () => {
    setGuardando(true);
    const r = await actions.registrarProduccion({
      sku, cantidad: q, costoAdicional: adicional, notas,
      insumos: lineas.filter(l => l.sku && l.q > 0).map(l => ({ sku: l.sku, cantidad: l.q }))
    });
    setGuardando(false);
    if (!r.ok) return setAviso({ ok: false, texto: r.error });
    setAviso({ ok: true, texto: `✓ Parte de producción N° ${r.parte.numero}: entraron ${r.parte.cantidad} u. de ${nombre(r.parte.sku)} a ${soles(r.parte.costoUnitario)} c/u.` });
    setCantidad('');
    setInsumos([]);
    setCostoAdicional('');
    setNotas('');
  };

  const campo = 'w-full min-h-[40px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';
  if (!products.length) return <EstadoVacio titulo="Primero crea tus productos" detalle="Registra el producto que produces y sus insumos (sustrato, macetas, abono…) en el catálogo." />;

  return (
    <div className="space-y-5 text-sm">
      <Tarjeta className="p-5 space-y-1">
        <h3 className="text-xl font-extrabold text-tinta flex items-center gap-2"><Factory className="w-5 h-5 text-bosque-700" aria-hidden /> Producción propia</h3>
        <p className="text-xs text-tinta-suave">Para plantas que produces tú (esquejes, siembra, trasplante, arreglos). Los insumos salen del stock a su costo promedio y el producto entra sin factura de proveedor, con <b>parte de producción</b> (SUNAT: documento 00, operación 19). Su costo = insumos + costo adicional ÷ cantidad.</p>
      </Tarjeta>

      <Tarjeta className="p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block text-xs font-bold">Producto obtenido
            <select aria-label="Producto obtenido" value={sku} onChange={e => setSku(e.target.value)} className={`${campo} mt-1`}>
              <option value="">Elige el producto</option>
              {products.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold">Cantidad producida
            <input aria-label="Cantidad producida" type="number" min={0} step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} className={`${campo} mt-1`} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold">Insumos consumidos (salen del stock al costo promedio)</p>
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_110px_36px] gap-2 items-center">
              <select aria-label={`Insumo ${i + 1}`} value={l.sku} onChange={e => setInsumos(v => v.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} className={campo}>
                <option value="">Elige el insumo</option>
                {products.filter(p => p.sku !== sku).map(p => <option key={p.sku} value={p.sku}>{p.name} (stock {p.stock})</option>)}
              </select>
              <input aria-label={`Cantidad del insumo ${i + 1}`} type="number" min={0} step="any" value={l.cantidad} onChange={e => setInsumos(v => v.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} className={campo} />
              <span className="text-right text-xs"><span className="block font-bold">{soles(l.total)}</span><span className="text-tinta-suave">{l.p ? `${soles(l.cu)} c/u` : ''}</span></span>
              <button onClick={() => setInsumos(v => v.filter((_, j) => j !== i))} aria-label={`Quitar insumo ${i + 1}`} className="p-2 rounded-xl bg-error-fondo text-error"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={() => setInsumos(v => [...v, { sku: '', cantidad: '' }])} className="text-xs font-bold text-bosque-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" aria-hidden /> Agregar insumo</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold">Costo adicional (S/, opcional)
            <input aria-label="Costo adicional" type="number" min={0} step="0.01" value={costoAdicional} onChange={e => setCostoAdicional(e.target.value)} placeholder="Mano de obra, agua, energía…" className={`${campo} mt-1`} />
            <span className="block mt-0.5 font-normal text-[11px] text-tinta-suave">Si no usaste insumos del almacén, aquí va el costo total calculado a mano.</span>
          </label>
          <label className="block text-xs font-bold">Notas
            <input aria-label="Notas de producción" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Lote, fecha de siembra…" className={`${campo} mt-1`} />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-crema">
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div><dt className="text-tinta-suave">Insumos</dt><dd className="font-bold">{soles(costoInsumos)}</dd></div>
            <div><dt className="text-tinta-suave">Adicional</dt><dd className="font-bold">{soles(adicional)}</dd></div>
            <div><dt className="text-tinta-suave">Costo unitario del producto</dt><dd className="font-extrabold text-bosque-700" aria-label="Costo unitario estimado">{soles(costoUnitario)}</dd></div>
          </dl>
          <Boton cargando={guardando} disabled={!sku || !(q > 0)} onClick={() => void registrar()}>Registrar producción</Boton>
        </div>
        {aviso && <p role={aviso.ok ? 'status' : 'alert'} className={`p-3 rounded-control font-bold ${aviso.ok ? 'bg-exito-fondo text-exito' : 'bg-error-fondo text-error'}`}>{aviso.texto}</p>}
      </Tarjeta>

      <Tarjeta className="p-5 space-y-3">
        <h4 className="font-extrabold text-tinta">Partes de producción</h4>
        {partesProduccion.length ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-[10px] uppercase text-tinta-suave"><tr><th className="text-left py-1.5">N°</th><th className="text-left">Fecha</th><th className="text-left">Producto</th><th className="text-right">Cant.</th><th className="text-right">Insumos</th><th className="text-right">Adicional</th><th className="text-right">Costo unit.</th><th className="text-left pl-3">Insumos usados</th></tr></thead>
              <tbody className="divide-y divide-crema-200">
                {partesProduccion.map(p => (
                  <tr key={p.numero}>
                    <td className="py-1.5 font-mono">{p.numero}</td><td>{p.fecha}</td><td className="font-semibold">{nombre(p.sku)}</td><td className="text-right">{p.cantidad}</td>
                    <td className="text-right">{soles(p.costoInsumos)}</td><td className="text-right">{soles(p.costoAdicional)}</td><td className="text-right font-bold">{soles(p.costoUnitario)}</td>
                    <td className="pl-3">{p.insumos.length ? p.insumos.map(i => `${i.cantidad} × ${nombre(i.sku)}`).join(', ') : <Insignia>costo manual</Insignia>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-tinta-suave">Aún no registras producción propia.</p>}
      </Tarjeta>
    </div>
  );
}
