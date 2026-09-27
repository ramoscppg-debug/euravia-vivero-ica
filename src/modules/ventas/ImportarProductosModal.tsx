import { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import { ModalShell } from '../../components/shared';
import { interpretarCsv, plantillaCsv, type FilaImportada } from '../../lib/catalogo';
import { descargarTxt } from '../../lib/exports';
import { soles } from '../../lib/formato';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

/** Carga masiva: plantilla → Excel → CSV → vista previa con errores por fila → crear productos con su stock inicial. */
export function ImportarProductosModal() {
  const { state, actions } = useErp();
  const { close } = useUi();
  const [filas, setFilas] = useState<FilaImportada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ creados: number; errores: string[] } | null>(null);

  const leer = async (archivo?: File) => {
    if (!archivo) return;
    setResultado(null);
    if (!/\.(csv|txt)$/i.test(archivo.name)) {
      setFilas(null);
      return setError('Sube el archivo en formato CSV. En Excel: Archivo → Guardar como → "CSV UTF-8 (delimitado por comas)".');
    }
    const r = interpretarCsv(await archivo.text(), state.products);
    setError(r.errorGeneral ?? null);
    setFilas(r.errorGeneral ? null : r.filas);
  };

  const validas = filas?.filter(f => !f.errores.length) ?? [];
  const importar = async () => {
    setImportando(true);
    const r = await actions.importarProductos(validas);
    setImportando(false);
    if (r.ok) {
      setResultado({ creados: r.creados, errores: r.errores });
      setFilas(null);
    }
  };

  return (
    <ModalShell size="max-w-4xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar text-sm">
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <h3 className="font-serif font-bold text-lg text-tinta flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-bosque-700" aria-hidden /> Cargar productos desde Excel</h3>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="p-3 rounded-control bg-crema space-y-2">
          <p className="font-bold text-tinta">1. Descarga la plantilla</p>
          <Boton tamano="sm" variante="secundario" onClick={() => descargarTxt('plantilla_productos_aurevia.csv', plantillaCsv())}><Download className="w-4 h-4" aria-hidden /> Plantilla</Boton>
        </li>
        <li className="p-3 rounded-control bg-crema"><p className="font-bold text-tinta">2. Llénala en Excel</p><p className="text-xs text-tinta-suave">Una fila por producto. Obligatorio: nombre y precio. Si dejas el SKU vacío se crea solo. Guarda como CSV.</p></li>
        <li className="p-3 rounded-control bg-crema space-y-2">
          <p className="font-bold text-tinta">3. Súbela</p>
          <label className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-control bg-bosque-950 text-white text-xs font-bold cursor-pointer">
            <Upload className="w-4 h-4" aria-hidden /> Elegir archivo
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" aria-label="Archivo CSV de productos" onChange={e => { void leer(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </li>
      </ol>

      {error && <p role="alert" className="p-3 rounded-control bg-error-fondo text-error font-semibold">{error}</p>}

      {resultado && (
        <div role="status" className="p-4 rounded-control bg-exito-fondo text-exito space-y-1">
          <p className="font-bold">✓ {resultado.creados} producto(s) creados con su stock inicial.</p>
          {resultado.errores.map(e => <p key={e} className="text-error text-xs">✗ {e}</p>)}
        </div>
      )}

      {filas && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="exito">{validas.length} listos</Insignia>
            {filas.length > validas.length && <Insignia tono="error">{filas.length - validas.length} con errores (no se importan)</Insignia>}
          </div>
          <div className="overflow-x-auto custom-scrollbar rounded-control border border-crema-300">
            <table className="w-full text-xs min-w-[680px]">
              <thead className="bg-crema text-[10px] uppercase text-tinta-suave"><tr><th className="text-left p-2">Fila</th><th className="text-left">SKU</th><th className="text-left">Producto</th><th className="text-left">Categoría</th><th className="text-right">Precio</th><th className="text-right">Costo</th><th className="text-right">Stock</th><th className="text-left pl-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-crema-200">
                {filas.map(f => (
                  <tr key={f.linea} className={f.errores.length ? 'bg-error-fondo/40' : ''}>
                    <td className="p-2 text-tinta-suave">{f.linea}</td><td className="font-mono">{f.producto.sku}</td><td className="font-semibold">{f.producto.name || '—'}</td>
                    <td>{f.producto.categoryName}</td><td className="text-right">{soles(f.producto.price)}</td><td className="text-right">{soles(f.producto.cost)}</td><td className="text-right">{f.stockInicial}</td>
                    <td className="pl-3">{f.errores.length ? <span className="text-error font-bold">{f.errores.join(' · ')}</span> : <span className="text-exito font-bold">Listo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <Boton variante="secundario" onClick={() => setFilas(null)}>Cancelar</Boton>
            <Boton disabled={!validas.length} cargando={importando} onClick={() => void importar()}>Crear {validas.length} producto(s)</Boton>
          </div>
        </>
      )}
    </ModalShell>
  );
}
