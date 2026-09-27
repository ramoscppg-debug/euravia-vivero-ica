import { useState } from 'react';
import { Inbox, MessageCircle, PackagePlus, Printer, UserRound, X } from 'lucide-react';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '../../components/ui';
import { ModalShell } from '../../components/shared';
import type { SolicitudTienda } from '../../domain/types';
import { hoyLocal } from '../../lib/fechas';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { soles } from '../../lib/formato';
import { docDeSolicitud, imprimir } from './documentosVenta';

const TIPO: Record<SolicitudTienda['tipo'], string> = { PEDIDO: 'Pedido', SERVICIO: 'Cotización de servicio', CONSULTA: 'Consulta' };
const ESTADO_TONO = { NUEVA: 'acento', EN_PROCESO: 'aviso', ATENDIDA: 'exito', DESCARTADA: 'neutro' } as const;
const ESTADO_TEXTO = { NUEVA: 'Nueva', EN_PROCESO: 'En proceso', ATENDIDA: 'Atendida', DESCARTADA: 'Descartada' };
const FILTROS = ['ABIERTAS', 'NUEVA', 'EN_PROCESO', 'ATENDIDA', 'DESCARTADA', 'TODAS'] as const;

export default function Solicitudes() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('ABIERTAS');
  const { solicitudes, serviciosPublicos } = state;

  const lista = solicitudes.filter(s =>
    filtro === 'TODAS' ? true : filtro === 'ABIERTAS' ? s.estado === 'NUEVA' || s.estado === 'EN_PROCESO' : s.estado === filtro);

  const mover = async (id: string, estado: SolicitudTienda['estado']) => {
    const r = await actions.atenderSolicitud(id, estado);
    if (!r.ok) alert(r.error);
  };

  return (
    <div className="space-y-6">
      <Tarjeta className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-tinta flex items-center gap-2"><Inbox className="w-5 h-5 text-bosque-700" aria-hidden /> Pedidos web</h3>
          <p className="text-xs text-tinta-suave">Lo que confirman los clientes en la tienda (/tienda). Responde por WhatsApp, genera la proforma y conviértelo en pedido: el comprobante elegido pasa a Contabilidad para emitirlo al cobrar.</p>
        </div>
        <a href="/tienda" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-terracota hover:underline">Abrir la tienda ↗</a>
      </Tarjeta>

      <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtrar solicitudes">
        {FILTROS.map(f => (
          <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}
            className={`min-h-[36px] px-3 rounded-full font-bold border ${filtro === f ? 'bg-bosque-950 text-oro border-bosque-950' : 'bg-white text-tinta-suave border-crema-300'}`}>
            {f === 'ABIERTAS' ? 'Por atender' : f === 'TODAS' ? 'Todas' : ESTADO_TEXTO[f]}
          </button>
        ))}
      </div>

      {!lista.length ? (
        <Tarjeta><EstadoVacio titulo="No hay solicitudes aquí" detalle="Cuando un cliente envíe un pedido o consulta desde la tienda, aparecerá en esta lista." /></Tarjeta>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map(s => {
            const servicio = serviciosPublicos.find(x => x.slug === s.servicioSlug);
            const wa = `https://wa.me/${s.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${s.nombre.split(' ')[0]}, te escribimos de AUREVIA por tu solicitud ${s.id}.`)}`;
            return (
              <Tarjeta as="article" key={s.id} className="p-5 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-mono text-tinta-suave">{s.id} · {s.createdAt.slice(0, 16).replace('T', ' ')}</p>
                    <h4 className="font-serif text-lg font-bold text-tinta">{s.nombre}</h4>
                    <p className="text-tinta-suave">{s.telefono}{s.distrito ? ` · ${s.distrito}` : ''}{s.email ? ` · ${s.email}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Insignia tono={ESTADO_TONO[s.estado]}>{ESTADO_TEXTO[s.estado]}</Insignia>
                    <Insignia>{TIPO[s.tipo]}</Insignia>
                    <Insignia tono={s.comprobante === 'FACTURA' ? 'marca' : 'neutro'}>{s.comprobante === 'FACTURA' ? 'Factura' : 'Boleta'}</Insignia>
                  </div>
                </div>
                {(s.docCliente || s.razonSocial) && <p className="text-xs text-tinta"><b>{s.comprobante === 'FACTURA' ? 'RUC' : 'DNI'} {s.docCliente}</b>{s.razonSocial ? ` · ${s.razonSocial}` : ''}</p>}
                {s.tipo === 'PEDIDO' && <p className="text-xs text-tinta-suave">Entrega: <b className="text-tinta">{s.entrega === 'DELIVERY' ? `Delivery · ${[s.direccion, s.distrito].filter(Boolean).join(', ')}` : 'Recojo en vivero'}</b></p>}
                {s.requiereAsesor && <p className="flex items-center gap-1.5 p-2 rounded-control bg-aviso-fondo text-aviso text-xs font-bold"><UserRound className="w-4 h-4" aria-hidden /> Pide más que el stock: coordinar cantidades y fecha con el cliente.</p>}
                {servicio && <p className="font-semibold text-tinta">Servicio: {servicio.nombre}</p>}
                {!!s.items.length && (
                  <ul className="text-tinta">
                    {s.items.map(it => <li key={it.sku}>• {it.cantidad}× {it.nombre} ({soles(it.precio)}){it.stock !== undefined && it.cantidad > it.stock && <span className="text-aviso font-bold"> · había {it.stock}</span>}</li>)}
                    <li className="font-bold pt-1">Total referencial: {soles(s.totalReferencial)}</li>
                  </ul>
                )}
                {s.mensaje && <p className="p-3 rounded-control bg-crema-200/60 text-tinta italic">“{s.mensaje}”</p>}
                {s.pedidoId && <p className="font-mono text-xs text-exito font-bold">✅ Convertida en el pedido {s.pedidoId}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-control bg-exito-fondo text-exito font-bold text-xs"><MessageCircle className="w-4 h-4" aria-hidden /> Responder</a>
                  {s.tipo !== 'CONSULTA' && <Boton tamano="sm" variante="secundario" onClick={() => imprimir(docDeSolicitud(state, s))}><Printer className="w-4 h-4" aria-hidden /> Proforma</Boton>}
                  {s.tipo === 'PEDIDO' && !s.pedidoId && s.estado !== 'DESCARTADA' && (
                    <Boton tamano="sm" onClick={() => open({ type: 'solicitud-pedido', solicitud: s })}><PackagePlus className="w-4 h-4" aria-hidden /> Crear pedido</Boton>
                  )}
                  {s.estado === 'NUEVA' && <Boton tamano="sm" variante="secundario" onClick={() => void mover(s.id, 'EN_PROCESO')}>En proceso</Boton>}
                  {(s.estado === 'NUEVA' || s.estado === 'EN_PROCESO') && (
                    <>
                      <Boton tamano="sm" variante="secundario" onClick={() => void mover(s.id, 'ATENDIDA')}>Atendida</Boton>
                      <Boton tamano="sm" variante="fantasma" onClick={() => void mover(s.id, 'DESCARTADA')}>Descartar</Boton>
                    </>
                  )}
                </div>
              </Tarjeta>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODAL: CONVERTIR SOLICITUD EN PEDIDO
// ============================================================
export function SolicitudAPedidoModal({ solicitud }: { solicitud: SolicitudTienda }) {
  const { actions } = useErp();
  const { close, setTab } = useUi();
  const [direccion, setDireccion] = useState(solicitud.direccion ?? '');
  const [distrito, setDistrito] = useState(solicitud.distrito ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(hoyLocal());
  const [costoDelivery, setCostoDelivery] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const campo = 'w-full min-h-[44px] px-3 rounded-control bg-crema border border-crema-300 font-semibold';

  const crear = async () => {
    if (!direccion.trim()) {
      alert('Indica la dirección de entrega.');
      return;
    }
    setEnviando(true);
    const r = await actions.convertirSolicitudEnPedido(solicitud.id, { direccion, distrito, fechaEntrega, costoDelivery });
    setEnviando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    close();
    setTab('pedidos');
  };

  return (
    <ModalShell>
      <div className="flex justify-between items-center pb-3 border-b border-crema-300">
        <div>
          <h3 className="font-serif font-bold text-lg text-tinta">Crear pedido desde {solicitud.id}</h3>
          <p className="text-[11px] text-tinta-suave">{solicitud.nombre} · {solicitud.items.length} producto(s) · {solicitud.comprobante === 'FACTURA' ? `factura a RUC ${solicitud.docCliente}` : 'boleta'}. Quedará "por cobrar" en el tablero y por emitir en Contabilidad.</p>
          {solicitud.requiereAsesor && <p className="text-[11px] font-bold text-aviso">Ajusta las cantidades con el cliente: el pedido no puede superar el stock libre.</p>}
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-tinta-suave" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <label className="block font-bold sm:col-span-2">Dirección de entrega<input aria-label="Dirección de entrega" value={direccion} onChange={e => setDireccion(e.target.value)} className={`${campo} mt-1`} /></label>
        <label className="block font-bold">Distrito<input aria-label="Distrito" value={distrito} onChange={e => setDistrito(e.target.value)} className={`${campo} mt-1`} /></label>
        <label className="block font-bold">Fecha de entrega<input aria-label="Fecha de entrega" type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className={`${campo} mt-1`} /></label>
        <label className="block font-bold">Costo de delivery (S/)<input aria-label="Costo de delivery" type="number" min={0} step="0.5" value={costoDelivery} onChange={e => setCostoDelivery(Math.max(0, Number(e.target.value) || 0))} className={`${campo} mt-1`} /></label>
      </div>
      <div className="flex gap-2 pt-3 border-t border-crema-300">
        <Boton variante="secundario" className="flex-1" onClick={close}>Cancelar</Boton>
        <Boton className="flex-1" cargando={enviando} onClick={crear}>Crear pedido</Boton>
      </div>
    </ModalShell>
  );
}
