import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { NAV_BLOCKS, type NavBlock, type TabId } from '../../layout/navigation';
import { useErp, type ErpState } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import CentroControl from './CentroControl';
import { calcularPendientes } from '../../store/selectors';
import { hoyLocal } from '../../lib/fechas';

interface Hub {
  block: NavBlock['id'];
  lines: (s: ErpState) => [string, string][];
}

// Un vistazo por área: al tocarla se abre su primera sección
const HUBS: Hub[] = [
  { block: 'ventas', lines: s => [['Pedidos web nuevos', String(s.solicitudes.filter(x => x.estado === 'NUEVA').length)], ['Pedidos activos', String(s.pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length)], ['Caja', s.cashRegister.estadoCaja]] },
  { block: 'catalogo', lines: s => [['Productos', String(s.products.length)], ['Stock bajo', String(s.products.filter(p => p.stock <= p.minStock).length)], ['Unidades en stock', String(s.products.reduce((a, p) => a + Math.max(0, p.stock), 0))]] },
  { block: 'servicios', lines: s => [['Proyectos activos', String(s.projects.filter(p => p.status !== 'CONCLUIDO').length)], ['Contratos activos', String(s.contratos.filter(c => c.activo).length)]] },
  { block: 'contable', lines: s => [['Pedidos por emitir', String(s.pedidos.filter(p => p.estado === 'pendiente').length)], ['Comprobantes', String(s.invoices.length)], ['Detracciones pendientes', String(s.detracciones.filter(d => d.estado === 'PENDIENTE').length)]] }
];

export default function Dashboard() {
  const { state } = useErp();
  const { setTab } = useUi();
  const { cashRegister } = state;
  const pend = calcularPendientes(state);

  const tareas: { text: string; tab: TabId; urgente?: boolean }[] = [
    ...pend.contratosPorFacturar.map(c => ({ text: `Facturar mensualidad de ${c.cliente.nombre} (S/ ${c.montoMensual.toFixed(2)})`, tab: 'contratos' as TabId, urgente: true })),
    ...pend.cotizacionesPorVencer.map(c => ({ text: `Cotización ${c.id} de ${c.cliente.nombre} vence el ${c.vence}`, tab: 'cotizaciones' as TabId })),
    ...pend.tareasVencidas.map(t => ({ text: `Tarea: ${t.titulo}${t.asignadoA ? ` (${t.asignadoA})` : ''}`, tab: 'crm' as TabId, urgente: t.vence < hoyLocal() })),
    ...pend.pedidosPorCobrar.map(p => ({ text: `Cobrar pedido ${p.id} de ${p.cliente.nombre} (S/ ${p.total.toFixed(2)})`, tab: 'pedidos' as TabId })),
    ...pend.pedidosParaEntregar.map(p => ({ text: `Entregar pedido ${p.id} en ${p.distrito || p.direccion}`, tab: 'pedidos' as TabId, urgente: true })),
    ...pend.stockBajo.map(p => ({ text: `Reponer ${p.name}: quedan ${p.stock} u. (mín. ${p.minStock})`, tab: 'kardex' as TabId, urgente: true })),
    ...pend.proyectosPorDescargar.map(p => ({ text: `Descargar insumos del proyecto ${p.id}`, tab: 'jardineria' as TabId })),
    ...pend.proyectosPorFacturar.map(p => ({ text: `Facturar proyecto ${p.id} (S/ ${p.total.toFixed(2)})`, tab: 'jardineria' as TabId })),
    ...pend.detraccionesPendientes.map(d => ({ text: `Depositar detracción ${d.facturaId} antes del ${d.fechaVencimientoBn}`, tab: 'detracciones' as TabId, urgente: true })),
    ...pend.clientesUrgentes.map(c => ({ text: `Visita técnica prioritaria: ${c.name}`, tab: 'crm' as TabId })),
    ...(cashRegister.estadoCaja === 'ABIERTA' ? [{ text: 'Cuadrar la caja del día', tab: 'caja' as TabId }] : [])
  ];

  return (
    <div className="space-y-6">
      <CentroControl />

      {/* Qué atender hoy */}
      <div className="bg-white rounded-3xl border border-crema-300 p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-serif font-bold text-base text-tinta">Pendientes de Hoy</h4>
          <span className="text-[10px] font-bold text-tinta-suave">{tareas.length} por atender</span>
        </div>
        {tareas.length === 0 ? (
          <p className="text-xs text-bosque-700 font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Todo al día.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {tareas.map(t => (
              <button
                key={t.text}
                onClick={() => setTab(t.tab)}
                className={`text-left p-3 rounded-xl border flex items-center gap-2 transition hover:shadow-sm ${t.urgente ? 'bg-aviso-fondo border-[#ffedd5] text-aviso' : 'bg-crema border-[#eae4dc] text-tinta'}`}
              >
                {t.urgente ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-tinta-suave" />}
                <span className="font-semibold">{t.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Áreas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {HUBS.map(hub => {
          const area = NAV_BLOCKS.find(b => b.id === hub.block)!;
          return (
            <button key={hub.block} onClick={() => setTab(area.items[0].id)} className="text-left bg-white rounded-3xl border border-crema-300 p-5 hover:border-bosque-700 transition space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-bosque-50 text-bosque-700"><area.icon className="w-5 h-5" aria-hidden /></span>
                <span><h4 className="font-extrabold text-tinta">{area.label}</h4><span className="block text-[11px] text-tinta-suave">{area.hint}</span></span>
              </div>
              <dl className="space-y-1 text-xs">
                {hub.lines(state).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-tinta-suave">{k}</dt><dd className="font-bold text-tinta">{v}</dd></div>)}
              </dl>
            </button>
          );
        })}
      </div>
    </div>
  );
}
