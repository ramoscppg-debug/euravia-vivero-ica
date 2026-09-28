import { useState } from 'react';
import { Check, ClipboardCopy, FileText, MessageCircle } from 'lucide-react';
import { Boton, Insignia } from '../../components/ui';
import type { ComprobanteSunat } from '../../domain/types';
import { imprimirModeloComprobante, textoModelo, TIPOS_CPE } from '../../lib/modelos';
import { useErp, type ErpState } from '../../store/ErpStore';

/** Teléfono del cliente: del pedido que se cobró con este comprobante o de su ficha. */
export function telefonoDe(inv: ComprobanteSunat, s: ErpState): string | undefined {
  return s.pedidos.find(p => p.comprobanteId === inv.id)?.cliente.telefono
    ?? (inv.cliente.numDoc ? s.crmClients.find(c => c.doc === inv.cliente.numDoc)?.phone : undefined)
    ?? s.solicitudes.find(x => x.docCliente && x.docCliente === inv.cliente.numDoc)?.telefono;
}

export const porEmitir = (inv: ComprobanteSunat) => !inv.numeroSunat && inv.estadoSunat === 'PENDIENTE';

export function EstadoEmision({ inv }: { inv: ComprobanteSunat }) {
  if (porEmitir(inv)) return <Insignia tono="aviso">Por emitir en SUNAT</Insignia>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Insignia tono="exito">{inv.numeroSunat ? `Emitido · ${inv.numeroSunat}` : 'Emitido'}</Insignia>
      {inv.enviadoClienteAt && <Insignia>Enviado al cliente</Insignia>}
    </span>
  );
}

/** Flujo mientras no hay API: modelo → emitir afuera → anotar número → enviar al cliente por WhatsApp. */
export function AccionesEmision({ inv }: { inv: ComprobanteSunat }) {
  const { state, actions } = useErp();
  const [numero, setNumero] = useState(inv.numeroSunat ?? inv.id);
  const [telefono, setTelefono] = useState(telefonoDe(inv, state) ?? '');
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendiente = porEmitir(inv);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoModelo(inv));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar: usa "Ver modelo" e imprímelo.');
    }
  };

  const guardar = async () => {
    setError(null);
    const r = await actions.registrarEmisionExterna(inv.id, numero);
    if (!r.ok) setError(r.error);
  };

  const digitos = telefono.replace(/\D/g, '');
  const conPais = digitos.length === 9 ? `51${digitos}` : digitos;
  const empresa = state.company.nombreComercial.split(' - ')[0] || state.company.razonSocial;
  const mensaje = `Hola ${inv.cliente.nombreRazonSocial.split(' ')[0]}, te enviamos tu ${(TIPOS_CPE[inv.tipoComprobante] ?? 'comprobante').toLowerCase()} N° ${inv.numeroSunat ?? inv.id} por S/ ${inv.montoTotal.toFixed(2)}${empresa ? ` de ${empresa}` : ''}. Te adjuntamos el PDF. ¡Gracias por tu compra! 🌿`;
  const wa = conPais.length >= 10 ? `https://wa.me/${conPais}?text=${encodeURIComponent(mensaje)}` : null;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <Boton tamano="sm" variante="secundario" onClick={() => imprimirModeloComprobante(inv, state.company)}><FileText className="w-3.5 h-3.5" aria-hidden /> Ver modelo</Boton>
        <Boton tamano="sm" variante="secundario" onClick={() => void copiar()}><ClipboardCopy className="w-3.5 h-3.5" aria-hidden /> {copiado ? 'Copiado ✓' : 'Copiar datos'}</Boton>
      </div>
      {pendiente ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`num-${inv.id}`}>N° emitido en SUNAT</label>
          <input id={`num-${inv.id}`} aria-label={`N° emitido en SUNAT de ${inv.id}`} value={numero} onChange={e => setNumero(e.target.value.toUpperCase())} className="w-36 min-h-[36px] px-2 rounded-control border border-crema-300 font-mono font-bold" />
          <Boton tamano="sm" onClick={() => void guardar()}><Check className="w-3.5 h-3.5" aria-hidden /> Ya lo emití</Boton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {!telefonoDe(inv, state) && <input aria-label="WhatsApp del cliente" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="WhatsApp del cliente" className="w-40 min-h-[36px] px-2 rounded-control border border-crema-300" />}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => void actions.marcarComprobanteEnviado(inv.id)}
              className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-control bg-exito-fondo text-exito font-bold">
              <MessageCircle className="w-4 h-4" aria-hidden /> {inv.enviadoClienteAt ? 'Reenviar por WhatsApp' : 'Enviar al cliente por WhatsApp'}
            </a>
          ) : <span className="text-tinta-suave">Escribe el WhatsApp del cliente para enviarle su comprobante.</span>}
        </div>
      )}
      {error && <p role="alert" className="text-error font-bold">{error}</p>}
    </div>
  );
}
