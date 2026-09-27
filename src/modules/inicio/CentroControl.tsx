import { AlertTriangle, BarChart3, ClipboardList, Inbox, PackagePlus, PlusCircle, Store } from 'lucide-react';
import { Insignia, Tarjeta } from '../../components/ui';
import { porFacturar } from '../../lib/contratos';
import { hoyLocal, sumarDias } from '../../lib/fechas';
import { generarReporte, rangoDe } from '../../lib/reportes';
import type { TabId } from '../../layout/navigation';
import { puedeVer } from '../../layout/navigation';
import { useAuth } from '../../store/AuthStore';
import { useErp } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { soles } from '../../lib/formato';

const ESTADO_PEDIDO: Record<string, { texto: string; tono: 'acento' | 'aviso' | 'exito' | 'neutro' }> = {
  pendiente: { texto: 'Por cobrar', tono: 'acento' },
  pagado: { texto: 'Pagado', tono: 'aviso' },
  preparando: { texto: 'Preparando', tono: 'aviso' },
  'en-reparto': { texto: 'En ruta', tono: 'exito' }
};

function Metrica({ titulo, valor, detalle, periodo }: { titulo: string; valor: string; detalle?: string; periodo: string }) {
  return (
    <Tarjeta className="p-4">
      <p className="text-[11px] font-bold uppercase text-tinta-suave">{titulo}</p>
      <p className="font-serif text-2xl font-bold text-tinta mt-1">{valor}</p>
      <p className="text-[11px] text-tinta-suave mt-0.5">{detalle ? `${detalle} · ` : ''}<span className="font-semibold">{periodo}</span></p>
    </Tarjeta>
  );
}

function Lista({ titulo, icono, vacio, children, accion }: { titulo: string; icono: React.ReactNode; vacio: string; children: React.ReactNode[]; accion?: { texto: string; ir: () => void } }) {
  return (
    <Tarjeta as="section" className="p-5 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif font-bold text-base text-tinta flex items-center gap-2">{icono} {titulo}</h3>
        {accion && <button onClick={accion.ir} className="text-xs font-bold text-terracota hover:underline">{accion.texto}</button>}
      </div>
      {children.length ? <ul className="space-y-2 text-sm">{children}</ul> : <p className="text-sm text-tinta-suave">{vacio}</p>}
    </Tarjeta>
  );
}

/** Lo que el equipo debe decidir hoy: ventas del periodo, pedidos, stock, servicios y solicitudes. */
export default function CentroControl() {
  const { state } = useErp();
  const { setTab, open } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const hoy = hoyLocal();
  const mes = rangoDe('mes');
  const rHoy = generarReporte(state.invoices, state.products, hoy, hoy);
  const rMes = generarReporte(state.invoices, state.products, mes.desde, mes.hasta);
  const porCobrar = state.pedidos.filter(p => p.estado === 'pendiente');
  const solicitudesNuevas = state.solicitudes.filter(s => s.estado === 'NUEVA');
  const pedidosActivos = state.pedidos
    .filter(p => ['pendiente', 'pagado', 'preparando', 'en-reparto'].includes(p.estado))
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))
    .slice(0, 5);
  const stockBajo = state.products.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock).slice(0, 6);
  const enSemana = sumarDias(hoy, 7);
  const servicios = [
    ...state.contratos.filter(c => porFacturar(c)).map(c => ({ id: c.id, texto: `Facturar mensualidad · ${c.cliente.nombre}`, cuando: 'Este mes', tab: 'contratos' as TabId })),
    ...state.projects.filter(p => p.status === 'APROBADO' || p.status === 'EN_EJECUCION').map(p => ({ id: p.id, texto: `${p.type} · ${p.client}`, cuando: p.status === 'APROBADO' ? 'Por iniciar' : 'En ejecución', tab: 'jardineria' as TabId })),
    ...state.tareas.filter(t => !t.hecha && t.vence <= enSemana).map(t => ({ id: t.id, texto: t.titulo, cuando: t.vence < hoy ? `Venció ${t.vence}` : t.vence, tab: 'crm' as TabId }))
  ].slice(0, 6);
  const ir = (tab: TabId) => () => setTab(tab);

  const accesos: { texto: string; icono: React.ReactNode; accion: () => void; tab?: TabId }[] = [
    { texto: 'Nueva venta', icono: <PlusCircle className="w-4 h-4" aria-hidden />, accion: () => open({ type: 'pos' }), tab: 'caja' },
    { texto: 'Pedidos', icono: <ClipboardList className="w-4 h-4" aria-hidden />, accion: ir('pedidos'), tab: 'pedidos' },
    { texto: `Solicitudes${solicitudesNuevas.length ? ` (${solicitudesNuevas.length})` : ''}`, icono: <Inbox className="w-4 h-4" aria-hidden />, accion: ir('solicitudes'), tab: 'solicitudes' },
    { texto: 'Catálogo', icono: <PackagePlus className="w-4 h-4" aria-hidden />, accion: ir('catalogo'), tab: 'catalogo' },
    { texto: 'Reportes', icono: <BarChart3 className="w-4 h-4" aria-hidden />, accion: ir('reportes'), tab: 'reportes' }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 className="font-serif text-3xl font-bold text-tinta">Centro de control de ventas</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Accesos rápidos">
          {accesos.filter(a => !a.tab || puedeVer(rol, a.tab)).map((a, i) => (
            <button key={a.texto} onClick={a.accion}
              className={`min-h-[40px] px-3.5 rounded-control text-xs font-bold inline-flex items-center gap-1.5 ${i === 0 ? 'bg-bosque-950 text-oro shadow-suave' : 'bg-white border border-crema-300 text-tinta hover:border-crema-400'}`}>
              {a.icono} {a.texto}
            </button>
          ))}
          <a href="/" target="_blank" rel="noopener noreferrer" className="min-h-[40px] px-3.5 rounded-control text-xs font-bold inline-flex items-center gap-1.5 bg-white border border-crema-300 text-terracota"><Store className="w-4 h-4" aria-hidden /> Ver tienda ↗</a>
        </div>
      </div>

      {rol === 'dueno' && !state.tiendaConfig.whatsapp && (
        <p className="flex items-start gap-2 p-3 rounded-control bg-aviso-fondo text-aviso text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <span>La tienda pública aún no tiene WhatsApp de ventas: los clientes sólo pueden dejar una solicitud. <button onClick={ir('configuracion')} className="underline">Configurarlo en Ajustes</button>.</span>
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrica titulo="Ventas de hoy" valor={soles(rHoy.ventasNetas)} detalle={`${rHoy.tickets} ticket(s)`} periodo={hoy} />
        <Metrica titulo="Ventas del mes" valor={soles(rMes.ventasNetas)} detalle={`ticket prom. ${soles(rMes.ticketPromedio)}`} periodo={`${mes.desde} al ${mes.hasta}`} />
        <Metrica titulo="Pedidos por cobrar" valor={String(porCobrar.length)} detalle={soles(porCobrar.reduce((a, p) => a + p.total, 0))} periodo="al momento" />
        <Metrica titulo="Solicitudes nuevas" valor={String(solicitudesNuevas.length)} detalle="desde la tienda" periodo="sin atender" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Lista titulo="Pedidos por atender" icono={<ClipboardList className="w-4 h-4 text-bosque-700" aria-hidden />} vacio="Sin pedidos activos." accion={{ texto: 'Ver tablero', ir: ir('pedidos') }}>
          {pedidosActivos.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0"><span className="font-semibold text-tinta block truncate">{p.cliente.nombre}</span><span className={`text-[11px] ${p.fechaEntrega < hoy ? 'text-error font-bold' : 'text-tinta-suave'}`}>Entrega {p.fechaEntrega}{p.fechaEntrega < hoy ? ' · atrasado' : ''}</span></span>
              <Insignia tono={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Insignia>
            </li>
          ))}
        </Lista>
        <Lista titulo="Inventario bajo" icono={<AlertTriangle className="w-4 h-4 text-aviso" aria-hidden />} vacio="Todo el stock sobre el mínimo." accion={{ texto: 'Ver Kardex', ir: ir('kardex') }}>
          {stockBajo.map(p => (
            <li key={p.sku} className="flex items-center justify-between gap-2">
              <span className="font-semibold text-tinta truncate min-w-0">{p.name}</span>
              <Insignia tono={p.stock <= 0 ? 'error' : 'aviso'}>{p.stock} / mín. {p.minStock}</Insignia>
            </li>
          ))}
        </Lista>
        <Lista titulo="Servicios próximos" icono={<ClipboardList className="w-4 h-4 text-bosque-700" aria-hidden />} vacio="Sin servicios en los próximos 7 días.">
          {servicios.map(s => (
            <li key={s.id}>
              <button onClick={ir(s.tab)} className="w-full text-left flex items-center justify-between gap-2 hover:underline">
                <span className="font-semibold text-tinta truncate min-w-0">{s.texto}</span>
                <span className="text-[11px] text-tinta-suave shrink-0">{s.cuando}</span>
              </button>
            </li>
          ))}
        </Lista>
      </div>
    </div>
  );
}
