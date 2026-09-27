import { useState } from 'react';
import { Droplets, EyeOff, MapPin, Pencil, PackagePlus, PlusCircle, QrCode, Receipt, ScanLine, Sun } from 'lucide-react';
import { EstadoVacio } from '../../components/ui';
import { useAuth } from '../../store/AuthStore';
import { useScanner } from '../../components/shared';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Catalogo() {
  const { state } = useErp();
  const { open } = useUi();
  const scan = useScanner();
  const [scanInput, setScanInput] = useState('');
  const { products } = state;
  const esDueno = (useAuth().perfil?.rol ?? 'dueno') === 'dueno';

  const handleScan = (code: string) => {
    if (scan(code)) setScanInput('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-crema-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-tinta">Catálogo Botánico AUREVIA</h3>
          <p className="text-xs text-tinta-suave">Plantas de interior, especies de ornato, macetería artesanal y sustratos especiales</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {esDueno && (
            <button onClick={() => open({ type: 'producto' })} className="px-4 py-2.5 rounded-2xl bg-terracota hover:bg-terracota-oscuro text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition">
              <PackagePlus className="w-4 h-4" /> Nuevo producto
            </button>
          )}
          <button
            disabled={!products.length}
            onClick={() => products[0] && open({ type: 'qr', sku: products[0].sku })}
            className="px-4 py-2.5 rounded-2xl bg-crema-200 hover:bg-[#eae1d5] text-tinta font-bold text-xs border border-crema-400 flex items-center gap-1.5 transition"
          >
            <QrCode className="w-4 h-4 text-bosque-700" /> Imprimir Etiquetas QR / Tags
          </button>
          <button
            onClick={() => open({ type: 'pos' })}
            className="px-4 py-2.5 rounded-2xl bg-bosque-950 hover:bg-bosque-800 text-oro font-bold text-xs flex items-center gap-1.5 shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" /> Venta Rápida (POS)
          </button>
        </div>
      </div>

      {/* Barra de Escaneo Rápido */}
      <div className="bg-gradient-to-r from-bosque-950 to-bosque-800 text-white p-5 rounded-3xl shadow-lg space-y-3 border border-oro/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-oro" />
            <h4 className="font-serif font-bold text-sm text-crema-50">Escaneo Rápido de Etiquetas QR / Código de Barras USB / Bluetooth / Cámara</h4>
          </div>
          <span className="text-[10px] text-bosque-200">Escanea el sticker pegado en la maceta con tu lector de pistola y se abrirá el comprobante listo para emitir.</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="📷 Escanea con la pistola o escribe el SKU (ej. AUR-001, AUR-002, MAC-001)..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(scanInput); }}
            className="flex-1 p-3 bg-white text-tinta rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-oro shadow-inner"
          />
          <button
            onClick={() => handleScan(scanInput)}
            className="px-5 py-3 bg-oro hover:bg-[#c49f27] text-tinta font-bold text-xs rounded-2xl shadow-md flex items-center gap-1.5"
          >
            <ScanLine className="w-4 h-4" /> Escanear Código
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-bosque-200">
          <span className="text-oro font-bold">⚡ Prueba rápida:</span>
          {products.map(p => (
            <button
              key={p.sku}
              onClick={() => handleScan(p.sku)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-mono transition"
            >
              {p.sku} ({p.name.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.sku} className="bg-white rounded-3xl border border-crema-300 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
            <div className="relative h-48 overflow-hidden bg-crema-300">
              <img
                src={p.fullImage}
                alt={p.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-bosque-950/80 backdrop-blur-md text-oro text-[10px] font-bold px-3 py-1 rounded-full border border-oro/30">
                {p.categoryName}
                {p.visibleTienda === false && <span className="ml-1 inline-flex items-center gap-0.5"><EyeOff className="w-3 h-3" aria-hidden /> oculto en tienda</span>}
              </div>
              <div className={`absolute bottom-3 right-3 backdrop-blur-md text-xs font-bold px-3 py-1 rounded-xl shadow-md ${p.stock <= p.minStock ? 'bg-error-fondo/95 text-error' : 'bg-white/90 text-tinta'}`}>
                Stock: {p.stock} u.
              </div>
              <button
                onClick={() => open({ type: 'qr', sku: p.sku })}
                title="Ver e Imprimir Etiqueta QR"
                className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white text-tinta shadow-lg border border-crema-300 transition flex items-center gap-1 text-[10px] font-bold"
              >
                <QrCode className="w-4 h-4 text-bosque-700" />
                <span>QR Tag</span>
              </button>
            </div>

            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-serif text-lg font-bold text-tinta">{p.name}</h4>
                  <span className="font-mono text-[10px] text-tinta-suave font-bold bg-crema px-2 py-0.5 rounded border">{p.sku}</span>
                </div>
                <p className="text-[11px] text-earth-500 italic font-serif">{p.scientificName}</p>
                <p className="text-xs text-tinta-suave line-clamp-2 mt-1">{p.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#f0eae1] text-xs">
                <div className="flex items-center justify-between text-[11px] text-tinta-suave">
                  <span className="flex items-center gap-1"><Sun className="w-3.5 h-3.5 text-oro" /> {p.careLight}</span>
                  <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-bosque-700" /> {p.careWater}</span>
                </div>
                <p className="text-[11px] text-tinta-suave flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-tinta-suave" /> Ubicación: <strong className="text-tinta">{p.location}</strong>
                </p>
              </div>

              <div className="pt-3 border-t border-[#f0eae1] flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-tinta-suave uppercase font-bold block">Precio Venta (Inc. IGV)</span>
                  <span className="font-serif text-2xl font-bold text-tinta">S/ {p.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {esDueno && (
                    <button onClick={() => open({ type: 'producto', sku: p.sku })} title="Editar ficha del producto" aria-label={`Editar ${p.name}`} className="p-2.5 rounded-2xl bg-crema-200 hover:bg-[#eae1d5] text-tinta border border-crema-400 transition">
                      <Pencil className="w-4 h-4 text-terracota" />
                    </button>
                  )}
                  <button
                    onClick={() => open({ type: 'qr', sku: p.sku })}
                    title="Imprimir Etiqueta para Maceta"
                    className="p-2.5 rounded-2xl bg-crema-200 hover:bg-[#eae1d5] text-tinta font-bold text-xs border border-crema-400 transition"
                  >
                    <QrCode className="w-4 h-4 text-bosque-700" />
                  </button>
                  <button
                    onClick={() => open({ type: 'pos', sku: p.sku })}
                    className="px-4 py-2.5 rounded-2xl bg-bosque-950 hover:bg-bosque-800 text-oro font-bold text-xs shadow-md flex items-center gap-1.5 transition"
                  >
                    <Receipt className="w-3.5 h-3.5" /> Facturar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!products.length && (
        <EstadoVacio titulo="El catálogo está vacío" detalle={esDueno ? 'Crea tu primer producto con “Nuevo producto”.' : 'Pide al dueño que registre los productos.'} />
      )}
    </div>
  );
}
