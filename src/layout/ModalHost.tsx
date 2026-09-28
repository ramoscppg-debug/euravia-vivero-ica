import { DevolucionModal } from '../modules/admin/Comprobantes';
import { GreModal } from '../modules/admin/Guias';
import { FichaClienteModal } from '../modules/clientes/Clientes';
import { BajaModal, CompraModal } from '../modules/inventario/InventarioModals';
import { NuevaCotizacionModal } from '../modules/servicios/Proyectos';
import { NuevoContratoModal } from '../modules/servicios/Contratos';
import { NuevaCotizacionProductosModal } from '../modules/ventas/Cotizaciones';
import { FichaProductoModal } from '../modules/ventas/FichaProductoModal';
import { ImportarProductosModal } from '../modules/ventas/ImportarProductosModal';
import { SolicitudAPedidoModal } from '../modules/ventas/Solicitudes';
import { GastoModal } from '../modules/admin/GastoModal';
import { CobroPedidoModal, EntregaPedidoModal, NuevoPedidoModal } from '../modules/ventas/Pedidos';
import { EgresoModal, PosModal, QrModal, TicketModal } from '../modules/ventas/VentasModals';
import { useUi } from '../store/UiStore';

/** Único punto donde se monta el modal activo (uno a la vez). */
export default function ModalHost() {
  const { modal } = useUi();
  if (!modal) return null;
  switch (modal.type) {
    case 'pos':
      return <PosModal key={`pos-${modal.sku ?? ''}-${modal.preset?.cotizacionId ?? ''}`} presetSku={modal.sku} preset={modal.preset} />;
    case 'qr':
      return <QrModal key={`qr-${modal.sku}`} presetSku={modal.sku} />;
    case 'ticket':
      return <TicketModal invoice={modal.invoice} vuelto={modal.vuelto} />;
    case 'compra':
      return <CompraModal key={modal.sku ?? 'compra'} presetSku={modal.sku} />;
    case 'importar-productos':
      return <ImportarProductosModal />;
    case 'baja':
      return <BajaModal />;
    case 'egreso':
      return <EgresoModal />;
    case 'gasto':
      return <GastoModal />;
    case 'gre':
      return <GreModal />;
    case 'proyecto':
      return <NuevaCotizacionModal />;
    case 'cotizacion':
      return <NuevaCotizacionProductosModal />;
    case 'contrato':
      return <NuevoContratoModal />;
    case 'cliente':
      return <FichaClienteModal key={modal.clienteId ?? 'nuevo'} clienteId={modal.clienteId} />;
    case 'solicitud-pedido':
      return <SolicitudAPedidoModal key={modal.solicitud.id} solicitud={modal.solicitud} />;
    case 'producto':
      return <FichaProductoModal key={modal.sku ?? modal.duplicarDe ?? 'nuevo'} sku={modal.sku} duplicarDe={modal.duplicarDe} />;
    case 'pedido-nuevo':
      return <NuevoPedidoModal />;
    case 'pedido-cobro':
      return <CobroPedidoModal key={modal.pedido.id} pedido={modal.pedido} />;
    case 'pedido-entrega':
      return <EntregaPedidoModal key={modal.pedido.id} pedido={modal.pedido} />;
    case 'devolucion':
      return <DevolucionModal key={modal.invoice.id} invoice={modal.invoice} />;
  }
}
