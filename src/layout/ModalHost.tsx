import { GreModal } from '../modules/admin/Guias';
import { BajaModal, CompraModal } from '../modules/inventario/InventarioModals';
import { NuevaCotizacionModal } from '../modules/servicios/Proyectos';
import { EgresoModal, PosModal, QrModal, TicketModal } from '../modules/ventas/VentasModals';
import { useUi } from '../store/UiStore';

/** Único punto donde se monta el modal activo (uno a la vez). */
export default function ModalHost() {
  const { modal } = useUi();
  if (!modal) return null;
  switch (modal.type) {
    case 'pos':
      return <PosModal key={`pos-${modal.sku ?? ''}`} presetSku={modal.sku} />;
    case 'qr':
      return <QrModal key={`qr-${modal.sku}`} presetSku={modal.sku} />;
    case 'ticket':
      return <TicketModal invoice={modal.invoice} />;
    case 'compra':
      return <CompraModal />;
    case 'baja':
      return <BajaModal />;
    case 'egreso':
      return <EgresoModal />;
    case 'gre':
      return <GreModal />;
    case 'proyecto':
      return <NuevaCotizacionModal />;
  }
}
