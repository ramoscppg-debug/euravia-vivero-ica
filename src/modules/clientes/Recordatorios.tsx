// ==========================================
// RECORDATORIOS POR WHATSAPP
// La lista del día con el mensaje listo: se envía desde el WhatsApp del equipo con un toque
// (el envío automático a clientes requiere la API de WhatsApp Business, que es de pago).
// ==========================================
import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { soles } from '../../lib/formato';
import { hoyLocal } from '../../lib/fechas';
import { useErp, type ErpState } from '../../store/ErpStore';

type Tipo = 'COTIZACION' | 'PEDIDO_WEB' | 'CUIDADO' | 'SEGUIMIENTO';
interface Recordatorio { clave: string; tipo: Tipo; nombre: string; telefono: string; motivo: string; mensaje: string }

const ETIQUETA: Record<Tipo, string> = { COTIZACION: 'Cotización sin respuesta', PEDIDO_WEB: 'Pedido web sin cerrar', CUIDADO: 'Cuidado post-venta', SEGUIMIENTO: 'Seguimiento del cliente' };
const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta.slice(0, 10)) - Date.parse(desde.slice(0, 10))) / 86_400_000);
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? '';

/** WhatsApp de Perú: 9 dígitos → con código 51. */
export const enlaceWa = (telefono: string, texto: string) => {
  const d = telefono.replace(/\D/g, '');
  const n = d.length === 9 ? `51${d}` : d;
  return n.length >= 10 ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
};

export function recordatoriosDelDia(s: ErpState, hoy: string, tienda: string): Recordatorio[] {
  const empresa = s.company.nombreComercial?.split(' - ')[0] || s.company.razonSocial || 'AUREVIA';
  const lista: Recordatorio[] = [];
  for (const c of s.cotizaciones) {
    if (c.estado !== 'ENVIADA' || !c.cliente.telefono || dias(c.fecha, hoy) < 2) continue;
    lista.push({ clave: `COT:${c.id}`, tipo: 'COTIZACION', nombre: c.cliente.nombre, telefono: c.cliente.telefono, motivo: `Cotización ${c.id} de ${soles(c.total)} enviada hace ${dias(c.fecha, hoy)} días`,
      mensaje: `Hola ${primerNombre(c.cliente.nombre)}, te saluda ${empresa} 🌿. ¿Pudiste revisar tu cotización ${c.id} por ${soles(c.total)}? Si quieres la confirmamos hoy y coordinamos la entrega.` });
  }
  for (const w of s.solicitudes) {
    if ((w.estado !== 'NUEVA' && w.estado !== 'EN_PROCESO') || dias(w.createdAt, hoy) < 1) continue;
    lista.push({ clave: `WEB:${w.id}`, tipo: 'PEDIDO_WEB', nombre: w.nombre, telefono: w.telefono, motivo: `${w.tipo === 'SERVICIO' ? 'Solicitud de servicio' : 'Pedido web'} N° ${w.id} sin cerrar`,
      mensaje: `Hola ${primerNombre(w.nombre)}, te escribimos de ${empresa} por tu ${w.tipo === 'SERVICIO' ? 'solicitud' : 'pedido'} N° ${w.id}. ¿Te ayudamos a completarlo?` });
  }
  for (const p of s.pedidos) {
    const d = p.fechaEntrega ? dias(p.fechaEntrega, hoy) : -1;
    if (p.estado !== 'entregado' || !p.cliente.telefono || d < 5 || d > 20) continue;
    lista.push({ clave: `CUIDADO:${p.id}`, tipo: 'CUIDADO', nombre: p.cliente.nombre, telefono: p.cliente.telefono, motivo: `Pedido ${p.id} entregado hace ${d} días`,
      mensaje: `Hola ${primerNombre(p.cliente.nombre)}, ¿cómo están tus plantas? 🌱 Si tienes dudas de riego o luz, escríbenos. Y si te gustó, nos ayudaría mucho tu opinión aquí: ${tienda}` });
  }
  for (const c of s.crmClients) {
    if (c.urgency !== 'ALTA' || !c.phone || !c.recommendedAction) continue;
    lista.push({ clave: `CLI:${c.id}:${hoy.slice(0, 7)}`, tipo: 'SEGUIMIENTO', nombre: c.name, telefono: c.phone, motivo: c.recommendedAction,
      mensaje: `Hola ${primerNombre(c.name)}, te saluda ${empresa} 🌿. ${c.recommendedAction}. ¿Te ayudamos a coordinarlo?` });
  }
  return lista.filter(r => !s.recordatoriosEnviados[r.clave]);
}

export default function Recordatorios() {
  const { state, actions } = useErp();
  const [error, setError] = useState<string | null>(null);
  const lista = recordatoriosDelDia(state, hoyLocal(), `${window.location.origin}/tienda`);

  const enviar = async (r: Recordatorio) => {
    const url = enlaceWa(r.telefono, r.mensaje);
    if (url) window.open(url, '_blank', 'noopener');
    const res = await actions.marcarRecordatorio(r.clave);
    setError(res.ok ? null : res.error);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-suave max-w-3xl">Mensajes listos para hoy: cotizaciones sin respuesta, pedidos web sin cerrar, cuidados después de la entrega y clientes con seguimiento urgente. Al tocar <b>Enviar</b> se abre tu WhatsApp con el mensaje escrito y el recordatorio sale de la lista.</p>
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      {lista.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map(r => (
            <li key={r.clave}>
              <Tarjeta className="p-4 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span><b className="text-tinta">{r.nombre}</b><span className="block text-xs text-tinta-suave">{r.telefono} · {r.motivo}</span></span>
                  <Insignia tono={r.tipo === 'COTIZACION' || r.tipo === 'PEDIDO_WEB' ? 'aviso' : 'neutro'}>{ETIQUETA[r.tipo]}</Insignia>
                </div>
                <p className="p-3 rounded-control bg-crema-50 text-xs text-tinta">{r.mensaje}</p>
                <div className="flex gap-2">
                  <button onClick={() => void enviar(r)} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-control bg-bosque-950 text-oro text-xs font-bold"><MessageCircle className="w-4 h-4" aria-hidden /> Enviar por WhatsApp</button>
                  <button onClick={() => void actions.marcarRecordatorio(r.clave)} className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-control border border-crema-300 text-xs font-bold"><Check className="w-4 h-4" aria-hidden /> Ya lo atendí</button>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      ) : <Tarjeta><EstadoVacio titulo="Nada pendiente por hoy" detalle="Cuando haya cotizaciones sin respuesta, pedidos web sin cerrar o entregas recientes, aparecerán aquí." /></Tarjeta>}
    </div>
  );
}
