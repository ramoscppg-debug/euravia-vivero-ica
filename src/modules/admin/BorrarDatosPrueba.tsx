// ==========================================
// BORRAR DATOS DE PRUEBA
// Deja la empresa lista para empezar. Se bloquea al operar de verdad (año cerrado o comprobante emitido en SUNAT),
// porque los libros y comprobantes deben conservarse.
// ==========================================
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Boton } from '../../components/ui';
import { useErp } from '../../store/ErpStore';

export default function BorrarDatosPrueba() {
  const { state, actions } = useErp();
  const [ruc, setRuc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueado = state.ejercicios.some(e => e.estado === 'CERRADO') || state.invoices.some(i => i.numeroSunat);

  const borrar = async () => {
    if (!window.confirm('¿Borrar todos los datos de prueba? Esta acción no se puede deshacer.')) return;
    setOcupado(true); setError(null); setOk(null);
    const r = await actions.borrarDatosPrueba(ruc);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setRuc('');
    setOk('Listo: los datos de prueba se borraron. Puedes empezar a registrar desde cero.');
  };

  return (
    <section aria-label="Borrar datos de prueba" className="bg-white rounded-3xl border border-error/40 p-6 space-y-3 text-sm">
      <h3 className="font-extrabold text-error flex items-center gap-2"><Trash2 className="w-4 h-4" aria-hidden /> Borrar datos de prueba</h3>
      <p className="text-tinta-suave text-xs">
        Borra ventas, comprobantes, compras, Kardex, caja, gastos, pedidos, cotizaciones, clientes, servicios, solicitudes de la tienda y el libro diario.
        Se conservan la empresa, las series, el plan de cuentas, los usuarios, la tienda, las tarifas, los jardineros y la ficha de los productos (con stock en cero).
      </p>
      {bloqueado ? (
        <p className="text-xs font-bold text-tinta">No disponible: ya hay operaciones reales (un año cerrado o comprobantes emitidos en SUNAT) y los libros deben conservarse.</p>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <input aria-label="RUC para confirmar el borrado" value={ruc} onChange={e => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="Escribe el RUC de la empresa para confirmar" inputMode="numeric" className="flex-1 min-w-[240px] min-h-[40px] px-3 rounded-control border border-crema-300 font-mono text-xs" />
          <Boton variante="acento" disabled={ruc.length !== 11} cargando={ocupado} onClick={() => void borrar()}><Trash2 className="w-4 h-4" aria-hidden /> Borrar datos de prueba</Boton>
        </div>
      )}
      {error && <p role="alert" className="text-error font-bold text-xs">{error}</p>}
      {ok && <p role="status" className="text-exito font-bold text-xs">{ok}</p>}
    </section>
  );
}
