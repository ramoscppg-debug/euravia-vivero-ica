import { AlertTriangle, Check, CheckCircle2, Printer, Sprout } from 'lucide-react';
import { NAV_BLOCKS, type NavBlock, type TabId } from '../../layout/navigation';
import { useErp, type ErpState } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';
import { calcularCaja, calcularFinanzas, calcularPendientes, calcularPlanillaMes } from '../../store/selectors';

interface Hub {
  block: NavBlock['id'];
  title: string;
  subtitle: string;
  lines: (s: ErpState) => [string, string][];
  actions: [string, TabId][];
}

const HUBS: Hub[] = [
  {
    block: 'vender',
    title: 'Vender',
    subtitle: 'Caja • Tienda • Pedidos',
    lines: s => [
      ['Catálogo', `${s.products.length} productos`],
      ['Comprobantes emitidos', `${s.invoices.length} CPE`],
      ['Pedidos activos', `${s.pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado').length}`],
      ['Caja', s.cashRegister.estadoCaja]
    ],
    actions: [['Tienda POS', 'catalogo'], ['Pedidos', 'pedidos']]
  },
  {
    block: 'servicios',
    title: 'Servicios',
    subtitle: 'Cotización • Ejecución • Cobro',
    lines: s => [
      ['Proyectos activos', `${s.projects.filter(p => p.status !== 'CONCLUIDO').length} proyectos`],
      ['Por facturar', `${s.projects.filter(p => !p.invoiceId && p.status !== 'COTIZADO').length} proyectos`],
      ['Alertas CRM', `${s.crmClients.length} clientes en seguimiento`]
    ],
    actions: [['Proyectos VIP', 'jardineria'], ['Clientes', 'crm']]
  },
  {
    block: 'inventario',
    title: 'Inventario',
    subtitle: 'Kardex • Mermas • Compras',
    lines: s => [
      ['Movimientos Kardex', `${s.kardex.length} registros`],
      ['Bajas / Mermas', `${s.losses.length} eventos registrados`],
      ['Consumo Interno', `${s.consumptions.length} aplicaciones vivero`]
    ],
    actions: [['Kardex Físico', 'kardex'], ['Mermas & Bajas', 'bajas']]
  },
  {
    block: 'admin',
    title: 'Administración',
    subtitle: 'SUNAT • SPOT BN • SIRE • AFPnet',
    lines: s => [
      ['Guías GRE', `${s.guiasRemision.length} guías ${s.company.serieGre}`],
      ['Detracciones SPOT', `Cta. BN ${s.company.cuentaDetraccionesBn}`],
      ['Colaboradores', `${s.employees.length} en nómina MYPE`]
    ],
    actions: [['Detracciones BN', 'detracciones'], ['SIRE 621', 'contabilidad']]
  }
];

export default function Dashboard() {
  const { state } = useErp();
  const { setTab, open } = useUi();
  const { products, cashRegister, detracciones, invoices, regimenTributario } = state;
  const f = calcularFinanzas(state);
  const { diferenciaCaja } = calcularCaja(cashRegister);
  const planilla = calcularPlanillaMes(state.employees);
  const pend = calcularPendientes(state);

  const tareas: { text: string; tab: TabId; urgente?: boolean }[] = [
    ...pend.tareasVencidas.map(t => ({ text: `Tarea: ${t.titulo}${t.asignadoA ? ` (${t.asignadoA})` : ''}`, tab: 'crm' as TabId, urgente: t.vence < new Date().toISOString().slice(0, 10) })),
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
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#d4af37]/30">
        <div className="space-y-2 max-w-xl">
          <span className="bg-[#134e2e] text-[#d4af37] px-3.5 py-1 rounded-full text-xs font-bold border border-[#d4af37]/30 inline-flex items-center gap-1.5">
            <Sprout className="w-4 h-4" /> Ecosistema Aurevia 100% Sincronizado
          </span>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-[#fdfbf7]">Panel de Control General & Finanzas</h2>
          <p className="text-xs text-[#c2d4cb] leading-relaxed">
            Cada venta, compra, servicio y merma actualiza en un solo paso el stock, el Kardex, la caja y los comprobantes SUNAT.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 text-right space-y-1">
          <span className="text-[11px] text-[#d4af37] uppercase font-bold block">Régimen Activo</span>
          <span className="text-lg font-serif font-bold text-white block">{regimenTributario === 'RMT' ? '⭐ ' : ''}{f.regimenLabel}</span>
          <span className="text-[10px] text-[#c2d4cb] block">
            {f.pagoCuentaRentaDetalle.tasaAplicada > 0
              ? `Tasa Renta: ${(f.pagoCuentaRentaDetalle.tasaAplicada * 100).toFixed(1)}%`
              : `Cuota fija: S/ ${f.pagoCuentaRentaDetalle.cuotaFija.toFixed(2)}`} | {f.usaIgv ? 'IGV 18%' : 'Sin IGV (NRUS)'}
          </span>
        </div>
      </div>

      {/* 6 KPIs Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Ventas del Mes</span>
          <div className="text-2xl font-serif font-bold text-[#082017] mt-1">S/ {f.totalVentas.toFixed(2)}</div>
          <p className="text-[10px] text-[#134e2e] mt-1 font-semibold">IGV Débito: S/ {f.totalIgvVentas.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Caja Chica (Gaveta)</span>
          <div className="text-2xl font-serif font-bold text-[#134e2e] mt-1">S/ {cashRegister.conteoRealEfectivo.toFixed(2)}</div>
          <p className="text-[10px] text-[#5c7367] mt-1">Arqueo {diferenciaCaja === 0 ? '✅ Cuadrado' : '⚠️ Descuadre'}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Compras del Mes</span>
          <div className="text-2xl font-serif font-bold text-[#082017] mt-1">S/ {f.totalCompras.toFixed(2)}</div>
          <p className="text-[10px] text-[#134e2e] mt-1 font-semibold">Crédito Fiscal: S/ {f.totalIgvCompras.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Stock Físico Vivo</span>
          <div className="text-2xl font-serif font-bold text-[#082017] mt-1">{products.reduce((a, b) => a + b.stock, 0)} u.</div>
          <p className="text-[10px] text-[#5c7367] mt-1">{products.length} especies y macetas</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Detracciones SPOT</span>
          <div className="text-2xl font-serif font-bold text-[#e05780] mt-1">S/ {detracciones.filter(d => d.estado === 'PENDIENTE').reduce((a, b) => a + b.montoDetraccion, 0).toFixed(2)}</div>
          <p className="text-[10px] text-[#e05780] mt-1 font-bold">Por depositar en BN</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#e8e2d8] shadow-sm">
          <span className="text-[11px] font-bold text-[#5c7367] uppercase">Planilla + Provisiones</span>
          <div className="text-2xl font-serif font-bold text-[#082017] mt-1">S/ {planilla.costoTotalPlanilla.toFixed(2)}</div>
          <p className="text-[10px] text-[#5c7367] mt-1">Costo Laboral MYPE Real</p>
        </div>
      </div>

      {/* Qué atender hoy */}
      <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-serif font-bold text-base text-[#082017]">Pendientes de Hoy</h4>
          <span className="text-[10px] font-bold text-[#8fa89b]">{tareas.length} por atender</span>
        </div>
        {tareas.length === 0 ? (
          <p className="text-xs text-[#134e2e] font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Todo al día.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {tareas.map(t => (
              <button
                key={t.text}
                onClick={() => setTab(t.tab)}
                className={`text-left p-3 rounded-xl border flex items-center gap-2 transition hover:shadow-sm ${t.urgente ? 'bg-[#fff7ed] border-[#ffedd5] text-[#9a3412]' : 'bg-[#faf8f5] border-[#eae4dc] text-[#082017]'}`}
              >
                {t.urgente ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8fa89b]" />}
                <span className="font-semibold">{t.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* HUBS POR FLUJO DE NEGOCIO */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {HUBS.map(hub => {
          const Icon = NAV_BLOCKS.find(b => b.id === hub.block)!.icon;
          return (
            <div key={hub.block} className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4 hover:border-[#d4af37]/50 transition">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-[#082017] text-[#d4af37]">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base text-[#082017]">{hub.title}</h4>
                  <p className="text-[11px] text-[#8fa89b]">{hub.subtitle}</p>
                </div>
              </div>
              <div className="p-3.5 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-1.5 text-xs">
                {hub.lines(state).map(([k, v]) => (
                  <p key={k} className="text-[#5c7367]">{k}: <strong className="text-[#082017]">{v}</strong></p>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                {hub.actions.map(([label, tab], i) => (
                  <button
                    key={tab}
                    onClick={() => setTab(tab)}
                    className={`flex-1 py-2 rounded-xl font-bold text-xs ${i === 0 ? 'bg-[#082017] text-[#d4af37]' : 'bg-[#f4ede4] text-[#082017]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprobantes Recientes */}
      <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-serif font-bold text-base text-[#082017]">Comprobantes Electrónicos Emitidos (SEE SUNAT)</h4>
          <button onClick={() => setTab('sunat')} className="text-xs font-bold text-[#134e2e] hover:underline">Ver todos los comprobantes →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {invoices.slice(0, 6).map(inv => (
            <div key={inv.id} className="p-4 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#082017]">{inv.id}</span>
                  <span className="text-[10px] bg-[#dcfce7] text-[#134e2e] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> SUNAT OK
                  </span>
                </div>
                <p className="font-serif font-bold text-[#082017] text-xs mt-1">{inv.cliente.nombreRazonSocial}</p>
                <p className="text-[10px] text-[#8fa89b] font-mono">Hash: {inv.hashCpe}</p>
              </div>
              <div className="text-right space-y-1">
                <span className="font-serif font-bold text-base text-[#082017] block">S/ {inv.montoTotal.toFixed(2)}</span>
                <button
                  onClick={() => open({ type: 'ticket', invoice: inv })}
                  className="px-2.5 py-1 bg-[#082017] text-[#d4af37] rounded-xl font-bold text-[10px] flex items-center gap-1 ml-auto"
                >
                  <Printer className="w-3 h-3" /> Ticket 80mm
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
