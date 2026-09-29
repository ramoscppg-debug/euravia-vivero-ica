import { useMemo, useState } from 'react';
import { Printer, QrCode, Search } from 'lucide-react';
import { Boton, EstadoVacio, Tarjeta } from '../../components/ui';
import { imprimirEtiquetas, qrSvg, type FormatoEtiqueta } from '../../lib/documentos';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';

export const enlacePublico = (sku: string) => `${window.location.origin}/tienda/producto/${encodeURIComponent(sku)}`;

const FORMATOS: { id: FormatoEtiqueta; texto: string; detalle: string }[] = [
  { id: '50x30', texto: 'Rollo 50 × 30 mm', detalle: 'Impresora térmica de etiquetas (maceta)' },
  { id: '70x40', texto: 'Rollo 70 × 40 mm', detalle: 'Térmica, estaca grande' },
  { id: 'A4', texto: 'Hoja A4 · 21 stickers', detalle: 'Impresora normal, hoja adhesiva 63,5 × 38,1 mm' }
];

/**
 * Etiquetas QR por lote: se elige cuántas copias de cada producto y se imprimen todas juntas.
 * El QR abre la ficha pública (el cliente ve el precio en su celular) y el lector de caja reconoce el SKU.
 */
export function GeneradorEtiquetas({ presetSku }: { presetSku?: string }) {
  const { state } = useErp();
  const { products, company } = state;
  const [copias, setCopias] = useState<Record<string, number>>(presetSku ? { [presetSku]: 10 } : {});
  const [formato, setFormato] = useState<FormatoEtiqueta>('50x30');
  const [filtro, setFiltro] = useState('');
  const [todas, setTodas] = useState(10);

  const q = filtro.trim().toLowerCase();
  const lista = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  const total = Object.values(copias).reduce((a, n) => a + (n || 0), 0);
  const primero = products.find(p => (copias[p.sku] ?? 0) > 0) ?? products.find(p => p.sku === presetSku);
  const vistaQr = useMemo(() => (primero ? qrSvg(enlacePublico(primero.sku)) : ''), [primero]);
  const empresa = company.nombreComercial.split(' - ')[0] || company.razonSocial || 'AUREVIA';

  const imprimir = () => {
    imprimirEtiquetas(
      products.filter(p => (copias[p.sku] ?? 0) > 0).map(p => ({ sku: p.sku, nombre: p.name, cientifico: p.scientificName, precio: p.price, enlace: enlacePublico(p.sku), copias: copias[p.sku] })),
      formato, empresa
    );
  };

  if (!products.length) return <EstadoVacio titulo="Aún no hay productos" detalle="Crea productos en el catálogo para imprimir sus etiquetas." />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] text-sm">
      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex-1 min-w-[200px] flex items-center gap-2 min-h-[40px] px-3 rounded-control bg-white border border-crema-300">
            <Search className="w-4 h-4 text-tinta-suave" aria-hidden />
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar producto o SKU" aria-label="Buscar producto" className="flex-1 bg-transparent outline-none" />
          </label>
          <span className="flex items-center gap-1.5 text-xs font-bold">
            Poner
            <input type="number" min={0} max={500} value={todas} onChange={e => setTodas(Math.max(0, Math.min(500, Number(e.target.value) || 0)))} aria-label="Copias para todos" className="w-16 min-h-[36px] px-2 rounded-control border border-crema-300 text-center" />
            <Boton tamano="sm" variante="secundario" onClick={() => setCopias(Object.fromEntries(lista.map(p => [p.sku, todas])))}>a todos</Boton>
            <Boton tamano="sm" variante="fantasma" onClick={() => setCopias({})}>Limpiar</Boton>
          </span>
        </div>
        <ul className="divide-y divide-crema-200 rounded-tarjeta border border-crema-300 bg-white max-h-[60vh] overflow-y-auto custom-scrollbar">
          {lista.map(p => (
            <li key={p.sku} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 min-w-0"><span className="block font-bold text-tinta truncate">{p.name}</span><span className="text-xs font-mono text-tinta-suave">{p.sku} · {soles(p.price)} · stock {p.stock}</span></span>
              <Boton tamano="sm" variante="fantasma" onClick={() => setCopias(c => ({ ...c, [p.sku]: Math.max(0, p.stock) }))} title="Una etiqueta por unidad en stock">= stock</Boton>
              <input type="number" min={0} max={500} value={copias[p.sku] ?? 0}
                onChange={e => setCopias(c => ({ ...c, [p.sku]: Math.max(0, Math.min(500, Math.floor(Number(e.target.value) || 0))) }))}
                aria-label={`Copias de ${p.name}`} className="w-20 min-h-[36px] px-2 rounded-control border border-crema-300 text-center font-bold" />
            </li>
          ))}
        </ul>
      </div>

      <Tarjeta className="p-4 space-y-4 self-start">
        <fieldset className="space-y-2">
          <legend className="font-bold text-tinta mb-1">Formato</legend>
          {FORMATOS.map(f => (
            <label key={f.id} className={`flex gap-2 p-2.5 rounded-control border cursor-pointer ${formato === f.id ? 'border-bosque-700 bg-bosque-50' : 'border-crema-300'}`}>
              <input type="radio" name="formato" checked={formato === f.id} onChange={() => setFormato(f.id)} />
              <span><span className="block font-bold text-tinta">{f.texto}</span><span className="text-xs text-tinta-suave">{f.detalle}</span></span>
            </label>
          ))}
        </fieldset>
        {primero && (
          <div className="border-2 border-dashed border-crema-300 rounded-control p-3 flex gap-3 items-center" aria-label="Vista previa de la etiqueta">
            <span className="w-20 h-20 shrink-0 [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: vistaQr }} />
            <span className="min-w-0">
              <span className="block text-[10px] font-extrabold tracking-widest text-bosque-700 uppercase">{empresa}</span>
              <span className="block font-bold text-tinta truncate">{primero.name}</span>
              <span className="block font-extrabold">{soles(primero.price)} <small>+IGV</small></span>
              <span className="block text-[10px] font-mono text-tinta-suave">{primero.sku}</span>
            </span>
          </div>
        )}
        <p className="text-xs text-tinta-suave">El QR abre la ficha pública con el precio en el celular del cliente, y en <b>Caja</b> se lee con el escáner o la cámara para sumarlo a la venta.</p>
        <Boton className="w-full" disabled={!total} onClick={imprimir}><Printer className="w-4 h-4" aria-hidden /> Imprimir {total} etiqueta(s)</Boton>
      </Tarjeta>
    </div>
  );
}

export default function Etiquetas() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif text-xl font-bold text-tinta flex items-center gap-2"><QrCode className="w-5 h-5 text-bosque-700" aria-hidden /> Etiquetas QR por lote</h3>
        <p className="text-xs text-tinta-suave">Elige cuántas etiquetas necesitas de cada producto (10, 30 o las que quieras) e imprímelas todas juntas.</p>
      </div>
      <GeneradorEtiquetas />
    </div>
  );
}
