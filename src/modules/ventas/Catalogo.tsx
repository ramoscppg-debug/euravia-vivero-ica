import { useState } from 'react';
import { Droplets, MapPin, PlusCircle, QrCode, Receipt, ScanLine, Sun } from 'lucide-react';
import { useScanner } from '../../components/shared';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

export default function Catalogo() {
  const { state } = useErp();
  const { open } = useUi();
  const scan = useScanner();
  const [scanInput, setScanInput] = useState('');
  const { products } = state;

  const handleScan = (code: string) => {
    if (scan(code)) setScanInput('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-[#e8e2d8] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-[#082017]">Catálogo Botánico AUREVIA</h3>
          <p className="text-xs text-[#5c7367]">Plantas de interior, especies de ornato, macetería artesanal y sustratos especiales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => open({ type: 'qr', sku: products[0].sku })}
            className="px-4 py-2.5 rounded-2xl bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] font-bold text-xs border border-[#d5c7b5] flex items-center gap-1.5 transition"
          >
            <QrCode className="w-4 h-4 text-[#134e2e]" /> Imprimir Etiquetas QR / Tags
          </button>
          <button
            onClick={() => open({ type: 'pos' })}
            className="px-4 py-2.5 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs flex items-center gap-1.5 shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" /> Venta Rápida (POS)
          </button>
        </div>
      </div>

      {/* Barra de Escaneo Rápido */}
      <div className="bg-gradient-to-r from-[#082017] to-[#123e2c] text-white p-5 rounded-3xl shadow-lg space-y-3 border border-[#d4af37]/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#d4af37]" />
            <h4 className="font-serif font-bold text-sm text-[#fdfbf7]">Escaneo Rápido de Etiquetas QR / Código de Barras USB / Bluetooth / Cámara</h4>
          </div>
          <span className="text-[10px] text-[#c2d4cb]">Escanea el sticker pegado en la maceta con tu lector de pistola y se abrirá el comprobante listo para emitir.</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="📷 Escanea con la pistola o escribe el SKU (ej. AUR-001, AUR-002, MAC-001)..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(scanInput); }}
            className="flex-1 p-3 bg-white text-[#082017] rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#d4af37] shadow-inner"
          />
          <button
            onClick={() => handleScan(scanInput)}
            className="px-5 py-3 bg-[#d4af37] hover:bg-[#c49f27] text-[#082017] font-bold text-xs rounded-2xl shadow-md flex items-center gap-1.5"
          >
            <ScanLine className="w-4 h-4" /> Escanear Código
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#c2d4cb]">
          <span className="text-[#d4af37] font-bold">⚡ Prueba rápida:</span>
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
          <div key={p.sku} className="bg-white rounded-3xl border border-[#e8e2d8] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
            <div className="relative h-48 overflow-hidden bg-[#e8e2d8]">
              <img
                src={p.fullImage}
                alt={p.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-[#082017]/80 backdrop-blur-md text-[#d4af37] text-[10px] font-bold px-3 py-1 rounded-full border border-[#d4af37]/30">
                {p.categoryName}
              </div>
              <div className={`absolute bottom-3 right-3 backdrop-blur-md text-xs font-bold px-3 py-1 rounded-xl shadow-md ${p.stock <= p.minStock ? 'bg-[#fee2e2]/95 text-[#b91c1c]' : 'bg-white/90 text-[#082017]'}`}>
                Stock: {p.stock} u.
              </div>
              <button
                onClick={() => open({ type: 'qr', sku: p.sku })}
                title="Ver e Imprimir Etiqueta QR"
                className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white text-[#082017] shadow-lg border border-[#e8e2d8] transition flex items-center gap-1 text-[10px] font-bold"
              >
                <QrCode className="w-4 h-4 text-[#134e2e]" />
                <span>QR Tag</span>
              </button>
            </div>

            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-serif text-lg font-bold text-[#082017]">{p.name}</h4>
                  <span className="font-mono text-[10px] text-[#8fa89b] font-bold bg-[#faf8f5] px-2 py-0.5 rounded border">{p.sku}</span>
                </div>
                <p className="text-[11px] text-[#8c6239] italic font-serif">{p.scientificName}</p>
                <p className="text-xs text-[#5c7367] line-clamp-2 mt-1">{p.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#f0eae1] text-xs">
                <div className="flex items-center justify-between text-[11px] text-[#5c7367]">
                  <span className="flex items-center gap-1"><Sun className="w-3.5 h-3.5 text-[#d4af37]" /> {p.careLight}</span>
                  <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-[#134e2e]" /> {p.careWater}</span>
                </div>
                <p className="text-[11px] text-[#5c7367] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#8fa89b]" /> Ubicación: <strong className="text-[#082017]">{p.location}</strong>
                </p>
              </div>

              <div className="pt-3 border-t border-[#f0eae1] flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Precio Venta (Inc. IGV)</span>
                  <span className="font-serif text-2xl font-bold text-[#082017]">S/ {p.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => open({ type: 'qr', sku: p.sku })}
                    title="Imprimir Etiqueta para Maceta"
                    className="p-2.5 rounded-2xl bg-[#f4ede4] hover:bg-[#eae1d5] text-[#082017] font-bold text-xs border border-[#d5c7b5] transition"
                  >
                    <QrCode className="w-4 h-4 text-[#134e2e]" />
                  </button>
                  <button
                    onClick={() => open({ type: 'pos', sku: p.sku })}
                    className="px-4 py-2.5 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs shadow-md flex items-center gap-1.5 transition"
                  >
                    <Receipt className="w-3.5 h-3.5" /> Facturar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
