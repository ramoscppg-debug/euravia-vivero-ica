import { CalendarClock, Send } from 'lucide-react';
import { useErp } from '../../store/ErpStore';

export default function Clientes() {
  const { state } = useErp();
  const { crmClients, invoices, projects } = state;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <CalendarClock className="w-4 h-4" /> CRM Botánico & Fidelización de Clientes
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Ficha Única: Compras, Servicios & Alertas de Temporada</h3>
          <p className="text-xs text-[#c2d4cb]">Cada cliente reúne lo que compró en tienda, sus proyectos de jardinería y el consejo botánico de temporada listo para enviar por WhatsApp.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {crmClients.map(client => {
          const compras = invoices.filter(i => i.cliente.nombreRazonSocial === client.name);
          const totalCompras = compras.reduce((a, i) => a + i.montoTotal, 0);
          const servicios = projects.filter(p => p.client === client.name);
          return (
            <div key={client.id} className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-serif font-bold text-lg text-[#082017]">{client.name}</h4>
                    <p className="text-xs text-[#5c7367]">{client.district} • {client.phone}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${client.urgency === 'ALTA' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#e7f5ed] text-[#134e2e]'}`}>
                    {client.urgency}
                  </span>
                </div>

                {/* Historial comercial unificado */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]">
                    <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Compras tienda</span>
                    <span className="font-serif font-bold text-[#082017]">S/ {totalCompras.toFixed(2)}</span>
                    <span className="block text-[10px] text-[#5c7367] font-mono">{compras.length ? compras.map(c => c.id).join(', ') : 'Sin comprobantes'}</span>
                  </div>
                  <div className="p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]">
                    <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Servicios</span>
                    <span className="font-serif font-bold text-[#082017]">{servicios.length} proyecto(s)</span>
                    <span className="block text-[10px] text-[#5c7367] font-mono">{servicios.length ? servicios.map(p => `${p.id} · ${p.status}`).join(', ') : 'Sin proyectos'}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] text-xs space-y-1">
                  <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Plantas en su Hogar / Espacio:</span>
                  <p className="font-semibold text-[#082017]">{client.plantsOwned.join(', ')}</p>
                </div>

                <div className="p-3 bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl text-xs space-y-1">
                  <span className="text-[10px] text-[#134e2e] uppercase font-bold block">Alerta Botánica de Temporada:</span>
                  <p className="text-[#082017]">{client.seasonalAlert}</p>
                  <p className="text-[11px] text-[#5c7367] italic pt-1">💡 {client.recommendedAction}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const msg = encodeURIComponent(`Hola ${client.name}, te saludamos de AUREVIA Botanical 🌿. Queríamos recordarte este consejo de temporada para tus ${client.plantsOwned[0]}: ${client.seasonalAlert}`);
                  window.open(`https://api.whatsapp.com/send?phone=${client.phone.replace(/[^0-9]/g, '')}&text=${msg}`, '_blank');
                }}
                className="w-full py-2.5 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
              >
                <Send className="w-3.5 h-3.5" /> Enviar WhatsApp Botánico
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
