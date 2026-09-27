import { PackagePlus, QrCode, Scissors } from 'lucide-react';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Kardex() {
  const { state } = useErp();
  const { open } = useUi();
  const { products, kardex } = state;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-tinta">Control Físico de Kardex & Almacén</h3>
          <p className="text-xs text-tinta-suave">Entradas por compras mayoristas (+), salidas por ventas, servicios y mermas (-) y alertas de reposición</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => open({ type: 'baja' })}
            className="px-4 py-2.5 rounded-2xl bg-error-fondo text-error font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Scissors className="w-4 h-4" /> Registrar Merma / Baja (-)
          </button>
          <button
            onClick={() => open({ type: 'compra' })}
            className="px-4 py-2.5 rounded-2xl bg-bosque-950 text-oro font-bold text-xs flex items-center gap-1.5 shadow-md"
          >
            <PackagePlus className="w-4 h-4" /> Ingreso de Compra Mayorista (+)
          </button>
        </div>
      </div>

      {/* Tabla de Inventario Kardex */}
      <div className="bg-white rounded-3xl border border-crema-300 shadow-sm overflow-hidden p-6 space-y-4">
        <h4 className="font-serif font-bold text-base text-tinta">Inventario Físico Valuado al Costo y Precio de Venta</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-crema text-tinta-suave font-bold border-b border-crema-300">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Especie / Artículo</th>
                <th className="p-3">Ubicación Almacén</th>
                <th className="p-3 text-right">Costo Unit.</th>
                <th className="p-3 text-right">Precio Venta</th>
                <th className="p-3 text-center">Stock Actual</th>
                <th className="p-3 text-center">Mínimo</th>
                <th className="p-3 text-right">Valorizado Total</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-center">Etiqueta QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100">
              {products.map(p => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.sku} className="hover:bg-crema">
                    <td className="p-3 font-mono font-bold text-tinta">{p.sku}</td>
                    <td className="p-3">
                      <p className="font-serif font-bold text-tinta">{p.name}</p>
                      <p className="text-[10px] text-tinta-suave italic">{p.scientificName}</p>
                    </td>
                    <td className="p-3 text-tinta-suave">{p.location}</td>
                    <td className="p-3 text-right text-tinta-suave">S/ {p.cost.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-tinta">S/ {p.price.toFixed(2)}</td>
                    <td className="p-3 text-center font-bold text-base text-tinta">{p.stock}</td>
                    <td className="p-3 text-center text-tinta-suave">{p.minStock}</td>
                    <td className="p-3 text-right font-serif font-bold text-bosque-700">S/ {(p.stock * p.cost).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isLow ? 'bg-error-fondo text-error' : 'bg-exito-fondo text-bosque-700'}`}>
                        {isLow ? '⚠️ Reponer' : '✅ Óptimo'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => open({ type: 'qr', sku: p.sku })}
                        className="px-2.5 py-1 rounded-xl bg-bosque-950 hover:bg-bosque-800 text-oro font-bold text-[10px] flex items-center gap-1 mx-auto transition shadow-sm"
                      >
                        <QrCode className="w-3 h-3" /> Imprimir QR
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="bg-white rounded-3xl border border-crema-300 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-serif font-bold text-base text-tinta">Movimientos de Kardex</h4>
          <span className="text-[10px] text-tinta-suave">Cada venta, compra, servicio y merma deja su registro aquí</span>
        </div>
        <div className="overflow-x-auto max-h-96 custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-crema text-tinta-suave font-bold border-b border-crema-300 sticky top-0">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Movimiento</th>
                <th className="p-3">Documento</th>
                <th className="p-3 text-center">Entrada</th>
                <th className="p-3 text-center">Salida</th>
                <th className="p-3 text-center">Saldo</th>
                <th className="p-3">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100">
              {kardex.map(m => (
                <tr key={m.id} className="hover:bg-crema">
                  <td className="p-3 font-mono text-tinta-suave">{m.date}</td>
                  <td className="p-3 font-mono font-bold text-tinta">{m.productSku}</td>
                  <td className="p-3 text-tinta">{m.movementType}</td>
                  <td className="p-3 font-mono text-tinta-suave">{m.referenceDoc}</td>
                  <td className="p-3 text-center font-bold text-bosque-700">{m.quantityIn || ''}</td>
                  <td className="p-3 text-center font-bold text-[#e05780]">{m.quantityOut || ''}</td>
                  <td className="p-3 text-center font-bold text-tinta">{m.balance}</td>
                  <td className="p-3 text-tinta-suave">{m.responsibleUser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
