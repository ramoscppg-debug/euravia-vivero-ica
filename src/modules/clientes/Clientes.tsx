import { useRef, useState } from 'react';
import { CalendarClock, CheckSquare, Download, History, Leaf, NotebookPen, Search, Send, Square, Upload, UserPlus, X } from 'lucide-react';
import { ModalShell } from '../../components/shared';
import type { CrmClient } from '../../domain/types';
import { clientesACsv, historialCliente, mensajeCuidados, metricasCliente, plantasDelCliente, type Segmento } from '../../lib/crm';
import { descargarTxt } from '../../lib/exports';
import { useAuth } from '../../store/AuthStore';
import { useErp, type FichaClienteInput } from '../../store/ErpStore';
import { useUi } from '../../store/UiStore';

const SEGMENTOS: (Segmento | 'Todos' | 'Toca cuidado')[] = ['Todos', 'VIP', 'Frecuente', 'Nuevo', 'Activo', 'Inactivo', 'Sin compras', 'Toca cuidado'];
const COLOR_SEGMENTO: Record<Segmento, string> = {
  VIP: 'bg-[#d4af37] text-[#082017]',
  Frecuente: 'bg-[#134e2e] text-white',
  Nuevo: 'bg-[#dcfce7] text-[#134e2e]',
  Activo: 'bg-[#e7f5ed] text-[#134e2e]',
  Inactivo: 'bg-[#fee2e2] text-[#b91c1c]',
  'Sin compras': 'bg-[#f3f4f6] text-[#4b5563]'
};
const hoy = () => new Date().toISOString().slice(0, 10);
const enlaceWhatsapp = (telefono: string, texto: string) =>
  `https://api.whatsapp.com/send?phone=${telefono.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(texto)}`;

export default function Clientes() {
  const { state, actions } = useErp();
  const { open } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const edita = rol !== 'jardinero';
  const archivo = useRef<HTMLInputElement>(null);
  const [busqueda, setBusqueda] = useState('');
  const [segmento, setSegmento] = useState<(typeof SEGMENTOS)[number]>('Todos');
  const { crmClients, invoices, products, tareas } = state;

  const filas = crmClients.map(c => ({ c, m: metricasCliente(c, invoices), plantas: plantasDelCliente(c, invoices, products) }));
  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(({ c, m, plantas }) =>
    (!q || [c.name, c.doc, c.phone, c.district, c.email].some(v => v?.toLowerCase().includes(q))) &&
    (segmento === 'Todos' || (segmento === 'Toca cuidado' ? plantas.some(p => p.toca) : m.segmento === segmento))
  );
  const pendientes = tareas.filter(t => !t.hecha).sort((a, b) => a.vence.localeCompare(b.vence));

  const importar = async (f: File) => {
    const r = await actions.importarClientes(await f.text());
    alert(r.ok ? `✅ Importación lista: ${r.creados} cliente(s) nuevo(s), ${r.actualizados} actualizado(s).` : r.error);
    if (archivo.current) archivo.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#082017] via-[#0e3324] to-[#144733] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#d4af37]/30">
        <div className="space-y-1">
          <span className="bg-[#134e2e] text-[#d4af37] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit">
            <CalendarClock className="w-4 h-4" /> CRM Botánico & Fidelización de Clientes
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#fdfbf7]">Ficha Única: Compras, Pedidos, Servicios & Cuidados</h3>
          <p className="text-xs text-[#c2d4cb]">Cada cliente reúne su historial, notas, recordatorios y los cuidados de las plantas que compró, listos para enviar por WhatsApp.</p>
        </div>
        {edita && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => open({ type: 'cliente' })} className="px-3.5 py-2 rounded-2xl bg-[#d4af37] text-[#082017] font-bold text-xs flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Nuevo cliente</button>
            <button onClick={() => archivo.current?.click()} className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/20 font-bold text-xs flex items-center gap-1.5"><Upload className="w-4 h-4" /> Importar CSV</button>
            <button onClick={() => descargarTxt(`clientes_aurevia_${hoy()}.csv`, clientesACsv(crmClients))} className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/20 font-bold text-xs flex items-center gap-1.5"><Download className="w-4 h-4" /> Exportar CSV</button>
            <input ref={archivo} aria-label="Archivo CSV de clientes" type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void importar(f); }} />
          </div>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Clientes</span><p className="font-serif text-2xl font-bold text-[#082017]">{crmClients.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">VIP (≥ S/ 1 000)</span><p className="font-serif text-2xl font-bold text-[#d4af37]">{filas.filter(f => f.m.segmento === 'VIP').length}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Les toca cuidado</span><p className="font-serif text-2xl font-bold text-[#134e2e]">{filas.filter(f => f.plantas.some(p => p.toca)).length}</p></div>
        <div className="bg-white p-4 rounded-2xl border border-[#e8e2d8]"><span className="font-bold text-[#5c7367] uppercase text-[10px]">Tareas pendientes</span><p className="font-serif text-2xl font-bold text-[#e05780]">{pendientes.length}</p></div>
      </div>

      {/* Buscador y segmentos */}
      <div className="bg-white p-4 rounded-3xl border border-[#e8e2d8] space-y-3 text-xs">
        <div className="flex items-center gap-2 p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-2xl">
          <Search className="w-4 h-4 text-[#8fa89b]" />
          <input aria-label="Buscar cliente" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, DNI/RUC, teléfono, distrito o correo" className="flex-1 bg-transparent outline-none font-semibold" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTOS.map(sg => (
            <button key={sg} onClick={() => setSegmento(sg)} className={`px-3 py-1 rounded-full font-bold border ${segmento === sg ? 'bg-[#082017] text-[#d4af37] border-[#082017]' : 'bg-[#faf8f5] text-[#5c7367] border-[#e8e2d8]'}`}>{sg}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibles.map(({ c: client, m, plantas }) => {
          const proxima = plantas.filter(p => p.toca)[0];
          return (
            <div key={client.id} className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-serif font-bold text-lg text-[#082017]">{client.name}</h4>
                    <p className="text-xs text-[#5c7367]">{[client.district, client.phone].filter(Boolean).join(' • ')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${COLOR_SEGMENTO[m.segmento]}`}>{m.segmento}</span>
                    {client.urgency === 'ALTA' && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fee2e2] text-[#b91c1c]">ALTA</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="p-2 bg-[#faf8f5] rounded-xl border border-[#eae4dc]"><span className="text-[9px] text-[#8fa89b] uppercase font-bold block">Compras</span><span className="font-serif font-bold text-[#082017]">S/ {m.total.toFixed(2)}</span></div>
                  <div className="p-2 bg-[#faf8f5] rounded-xl border border-[#eae4dc]"><span className="text-[9px] text-[#8fa89b] uppercase font-bold block">Tickets</span><span className="font-serif font-bold text-[#082017]">{m.compras}</span></div>
                  <div className="p-2 bg-[#faf8f5] rounded-xl border border-[#eae4dc]"><span className="text-[9px] text-[#8fa89b] uppercase font-bold block">Última</span><span className="font-bold text-[#082017] text-[10px]">{m.ultimaCompra ?? '—'}</span></div>
                </div>

                <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] text-xs space-y-1">
                  <span className="text-[10px] text-[#8fa89b] uppercase font-bold block">Plantas en su Hogar / Espacio:</span>
                  <p className="font-semibold text-[#082017]">{[...new Set([...plantas.map(p => p.nombre), ...client.plantsOwned])].join(', ') || 'Sin registrar'}</p>
                </div>

                <div className={`p-3 rounded-2xl text-xs space-y-1 border ${proxima ? 'bg-[#fff7ed] border-[#ffedd5]' : 'bg-[#f0fdf4] border-[#dcfce7]'}`}>
                  <span className="text-[10px] text-[#134e2e] uppercase font-bold block">{proxima ? `Le toca cuidado: ${proxima.nombre}` : 'Alerta Botánica de Temporada:'}</span>
                  <p className="text-[#082017]">{proxima ? [proxima.riego, proxima.luz].filter(Boolean).join(' · ') : client.seasonalAlert}</p>
                  {!proxima && <p className="text-[11px] text-[#5c7367] italic pt-1">💡 {client.recommendedAction}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => open({ type: 'cliente', clienteId: client.id })} className="flex-1 py-2.5 rounded-2xl bg-[#f4ede4] text-[#082017] font-bold text-xs flex items-center justify-center gap-1.5"><History className="w-3.5 h-3.5" /> Ver ficha</button>
                {client.phone && (
                  <a
                    href={enlaceWhatsapp(client.phone, mensajeCuidados(client, plantas))}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-[1.4] py-2.5 rounded-2xl bg-[#082017] hover:bg-[#123e2c] text-[#d4af37] font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar WhatsApp Botánico
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {!visibles.length && <p className="text-xs font-semibold text-[#8fa89b]">Ningún cliente coincide con el filtro.</p>}
      </div>

      {/* Tareas del equipo */}
      <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-3 text-xs">
        <h4 className="font-serif font-bold text-base text-[#082017] flex items-center gap-2"><CheckSquare className="w-4 h-4 text-[#134e2e]" /> Tareas y recordatorios pendientes</h4>
        {pendientes.map(t => {
          const cliente = crmClients.find(c => c.id === t.clienteId);
          const vencida = t.vence < hoy();
          return (
            <div key={t.id} className="flex items-center gap-3 p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]">
              <button aria-label={`Completar: ${t.titulo}`} onClick={() => void actions.marcarTarea(t.id, true)}><Square className="w-4 h-4 text-[#134e2e]" /></button>
              <span className="flex-1">
                <span className="font-bold text-[#082017] block">{t.titulo}</span>
                <span className="text-[10px] text-[#8fa89b]">{cliente ? `${cliente.name} · ` : ''}{t.asignadoA ? `${t.asignadoA} · ` : ''}</span>
                <span className={`text-[10px] font-bold ${vencida ? 'text-[#b91c1c]' : 'text-[#5c7367]'}`}>{vencida ? `venció ${t.vence}` : `para ${t.vence}`}</span>
              </span>
              {cliente && <button onClick={() => open({ type: 'cliente', clienteId: cliente.id })} className="text-[10px] font-bold underline text-[#134e2e]">ficha</button>}
            </div>
          );
        })}
        {!pendientes.length && <p className="text-[#8fa89b] font-semibold">Sin tareas pendientes. 🌿</p>}
      </div>
    </div>
  );
}

// ============================================================
// MODAL: FICHA DEL CLIENTE
// ============================================================
type Pestana = 'datos' | 'historial' | 'notas' | 'cuidados';

export function FichaClienteModal({ clienteId }: { clienteId?: string }) {
  const { state, actions } = useErp();
  const { close } = useUi();
  const rol = useAuth().perfil?.rol ?? 'dueno';
  const edita = rol !== 'jardinero';
  const cliente = state.crmClients.find(c => c.id === clienteId);
  const [pestana, setPestana] = useState<Pestana>(cliente ? 'historial' : 'datos');

  const [f, setF] = useState<FichaClienteInput>(() => ({
    name: cliente?.name ?? '',
    doc: cliente?.doc ?? '',
    phone: cliente?.phone ?? '',
    email: cliente?.email ?? '',
    address: cliente?.address ?? '',
    district: cliente?.district ?? '',
    canal: cliente?.canal ?? '',
    plantsOwned: cliente?.plantsOwned ?? [],
    seasonalAlert: cliente?.seasonalAlert ?? '🌱 Aún sin alerta de temporada registrada.',
    recommendedAction: cliente?.recommendedAction ?? 'Registrar las plantas del cliente para personalizar sus cuidados.',
    urgency: cliente?.urgency ?? 'ESTACIONAL'
  }));
  const [nota, setNota] = useState('');
  const [tarea, setTarea] = useState({ titulo: '', vence: hoy(), asignadoA: '' });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const r = await actions.guardarCliente(f, cliente?.id);
    setGuardando(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    if (!cliente) close();
  };

  const input = 'w-full p-2.5 bg-[#faf8f5] border border-[#e8e2d8] rounded-xl font-semibold disabled:opacity-70';
  const campo = (label: string, el: React.ReactNode, span = '') => (
    <label className={`block ${span}`}><span className="font-bold block mb-1 text-[#082017]">{label}</span>{el}</label>
  );

  const eventos = cliente ? historialCliente(cliente, { invoices: state.invoices, pedidos: state.pedidos, projects: state.projects, notas: state.notasClientes, products: state.products }) : [];
  const plantas = cliente ? plantasDelCliente(cliente, state.invoices, state.products) : [];
  const m = cliente ? metricasCliente(cliente, state.invoices) : null;
  const tareasCliente = cliente ? state.tareas.filter(t => t.clienteId === cliente.id) : [];
  const ICONO: Record<string, string> = { compra: '🧾', devolucion: '↩️', pedido: '🚚', servicio: '🌿', nota: '📝' };

  return (
    <ModalShell size="max-w-3xl" padding="p-6" className="space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-start pb-3 border-b border-[#f0eae1]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#082017]">{cliente ? cliente.name : 'Nuevo cliente'}</h3>
          {m && <p className="text-[11px] text-[#5c7367]">{m.segmento} · S/ {m.total.toFixed(2)} en {m.compras} compra(s) · ticket promedio S/ {m.ticketPromedio.toFixed(2)}{m.diasSinComprar !== undefined ? ` · ${m.diasSinComprar} días sin comprar` : ''}</p>}
        </div>
        <button onClick={close} aria-label="Cerrar"><X className="w-5 h-5 text-[#5c7367]" /></button>
      </div>

      {cliente && (
        <div className="flex gap-1.5 text-xs" role="tablist">
          {([['historial', 'Historial', History], ['notas', 'Notas y tareas', NotebookPen], ['cuidados', 'Cuidados', Leaf], ['datos', 'Datos', UserPlus]] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${pestana === id ? 'bg-[#082017] text-[#d4af37]' : 'bg-[#f4ede4] text-[#5c7367]'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {pestana === 'datos' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {campo('Nombre / Razón social', <input aria-label="Nombre" disabled={!edita} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={input} />, 'sm:col-span-2')}
            {campo('DNI / RUC', <input aria-label="DNI o RUC" disabled={!edita} value={f.doc} onChange={e => setF({ ...f, doc: e.target.value.trim() })} className={`${input} font-mono`} />)}
            {campo('WhatsApp / Teléfono', <input aria-label="Teléfono" disabled={!edita} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className={input} />)}
            {campo('Correo', <input aria-label="Correo" type="email" disabled={!edita} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={input} />)}
            {campo('Canal de origen', <input aria-label="Canal de origen" disabled={!edita} value={f.canal} onChange={e => setF({ ...f, canal: e.target.value })} placeholder="Instagram, referido..." className={input} />)}
            {campo('Dirección', <input aria-label="Dirección" disabled={!edita} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} className={input} />, 'sm:col-span-2')}
            {campo('Distrito', <input aria-label="Distrito" disabled={!edita} value={f.district} onChange={e => setF({ ...f, district: e.target.value })} className={input} />)}
            {campo('Plantas que tiene (separadas por coma)', <input aria-label="Plantas" disabled={!edita} value={f.plantsOwned.join(', ')} onChange={e => setF({ ...f, plantsOwned: e.target.value.split(',') })} className={input} />, 'sm:col-span-3')}
            {campo('Alerta de temporada', <input aria-label="Alerta de temporada" disabled={!edita} value={f.seasonalAlert} onChange={e => setF({ ...f, seasonalAlert: e.target.value })} className={input} />, 'sm:col-span-2')}
            {campo('Prioridad', <select aria-label="Prioridad" disabled={!edita} value={f.urgency} onChange={e => setF({ ...f, urgency: e.target.value as CrmClient['urgency'] })} className={input}><option value="ESTACIONAL">Estacional</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></select>)}
            {campo('Acción recomendada', <input aria-label="Acción recomendada" disabled={!edita} value={f.recommendedAction} onChange={e => setF({ ...f, recommendedAction: e.target.value })} className={input} />, 'sm:col-span-3')}
          </div>
          {edita && (
            <div className="flex justify-end">
              <button onClick={guardar} disabled={guardando} className="px-6 py-3 rounded-2xl bg-[#082017] text-[#d4af37] font-bold shadow-lg disabled:opacity-60">{guardando ? 'Guardando...' : cliente ? 'Guardar cambios' : 'Crear cliente'}</button>
            </div>
          )}
        </>
      )}

      {pestana === 'historial' && (
        <ol className="space-y-2 text-xs">
          {eventos.map((ev, i) => (
            <li key={i} className="flex gap-3 p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]">
              <span className="text-base">{ICONO[ev.tipo]}</span>
              <span className="flex-1">
                <span className="font-bold text-[#082017] block">{ev.titulo}</span>
                <span className="text-[#5c7367]">{ev.detalle}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[10px] text-[#8fa89b] font-mono">{ev.fecha.slice(0, 10)}</span>
                {ev.monto !== undefined && <span className={`font-mono font-bold ${ev.monto < 0 ? 'text-[#b91c1c]' : 'text-[#082017]'}`}>S/ {ev.monto.toFixed(2)}</span>}
              </span>
            </li>
          ))}
          {!eventos.length && <p className="text-[#8fa89b] font-semibold">Todavía no hay movimientos con este cliente.</p>}
        </ol>
      )}

      {pestana === 'notas' && cliente && (
        <div className="space-y-4 text-xs">
          <div className="flex gap-2">
            <input aria-label="Nueva nota" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: prefiere entregas por la tarde" className={input} />
            <button onClick={async () => { const r = await actions.agregarNota(cliente.id, nota); if (r.ok) setNota(''); else alert(r.error); }} className="shrink-0 px-4 rounded-xl bg-[#082017] text-[#d4af37] font-bold">Guardar nota</button>
          </div>
          <ul className="space-y-1.5">
            {state.notasClientes.filter(n => n.clienteId === cliente.id).map(n => (
              <li key={n.id} className="p-2.5 bg-[#faf8f5] rounded-xl border border-[#eae4dc]"><span className="text-[#082017]">{n.texto}</span><span className="block text-[10px] text-[#8fa89b]">{n.autor} · {n.fecha.slice(0, 16).replace('T', ' ')}</span></li>
            ))}
          </ul>

          <div className="p-3 bg-[#faf8f5] rounded-2xl border border-[#eae4dc] space-y-2">
            <span className="font-bold text-[#082017] block">Nuevo recordatorio</span>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_auto] gap-2">
              <input aria-label="Tarea" value={tarea.titulo} onChange={e => setTarea({ ...tarea, titulo: e.target.value })} placeholder="Ej: llamar para ofrecer fertilizante" className={`${input} bg-white`} />
              <input aria-label="Vence" type="date" value={tarea.vence} onChange={e => setTarea({ ...tarea, vence: e.target.value })} className={`${input} bg-white`} />
              <input aria-label="Responsable" value={tarea.asignadoA} onChange={e => setTarea({ ...tarea, asignadoA: e.target.value })} placeholder="Responsable" className={`${input} bg-white`} />
              <button onClick={async () => { const r = await actions.crearTarea({ clienteId: cliente.id, ...tarea }); if (r.ok) setTarea({ titulo: '', vence: hoy(), asignadoA: '' }); else alert(r.error); }} className="px-4 rounded-xl bg-[#082017] text-[#d4af37] font-bold">Agregar</button>
            </div>
            {tareasCliente.map(t => (
              <button key={t.id} onClick={() => void actions.marcarTarea(t.id, !t.hecha)} className="w-full flex items-center gap-2 text-left">
                {t.hecha ? <CheckSquare className="w-4 h-4 text-[#134e2e]" /> : <Square className="w-4 h-4 text-[#134e2e]" />}
                <span className={t.hecha ? 'line-through text-[#8fa89b]' : 'text-[#082017] font-semibold'}>{t.titulo}</span>
                <span className="text-[10px] text-[#8fa89b]">· {t.vence}{t.asignadoA ? ` · ${t.asignadoA}` : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pestana === 'cuidados' && cliente && (
        <div className="space-y-2 text-xs">
          {plantas.map(p => (
            <div key={p.sku} className={`p-3 rounded-xl border ${p.toca ? 'bg-[#fff7ed] border-[#ffedd5]' : 'bg-[#faf8f5] border-[#eae4dc]'}`}>
              <span className="font-bold text-[#082017]">{p.nombre}</span>
              <span className="text-[10px] text-[#8fa89b]"> · comprada el {p.compradaEl}</span>
              <p className="text-[#5c7367]">{[p.riego, p.luz].filter(Boolean).join(' · ')}</p>
              <p className={`font-bold ${p.toca ? 'text-[#c2410c]' : 'text-[#134e2e]'}`}>Próximo cuidado: {p.proximoCuidado}{p.toca ? ' · ¡toca ahora!' : ''}</p>
            </div>
          ))}
          {!plantas.length && <p className="text-[#8fa89b] font-semibold">No hay plantas vivas en sus compras. Puedes registrar las que tiene en la pestaña Datos.</p>}
          {cliente.phone && (
            <a href={enlaceWhatsapp(cliente.phone, mensajeCuidados(cliente, plantas))} target="_blank" rel="noreferrer" className="w-full py-2.5 rounded-2xl bg-[#082017] text-[#d4af37] font-bold flex items-center justify-center gap-2">
              <Send className="w-3.5 h-3.5" /> Enviar cuidados por WhatsApp
            </a>
          )}
        </div>
      )}
    </ModalShell>
  );
}
