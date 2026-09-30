// Convierte registros del negocio (cotización, pedido, pedido web) en documentos imprimibles.
import type { Cotizacion, Pedido, SolicitudTienda } from '../../domain/types';
import { imprimirDocumento, type DocumentoComercial, type TipoDocumento } from '../../lib/documentos';
import { hoyLocal, sumarDias } from '../../lib/fechas';
import { calcularCarrito } from '../../lib/pos';
import type { ErpState } from '../../store/ErpStore';

const contacto = (s: ErpState) => ({ whatsapp: s.tiendaConfig.whatsapp, email: s.tiendaConfig.email || s.company.email, telefono: s.company.telefono });

export function docDeCotizacion(s: ErpState, c: Cotizacion, tipo: TipoDocumento = 'COTIZACIÓN'): DocumentoComercial {
  const carrito = calcularCarrito(c.lineas, s.products, c.descuentoGlobal);
  return {
    tipo, numero: c.id, fecha: c.fecha, vence: c.vence, empresa: s.company, contacto: contacto(s),
    cliente: { nombre: c.cliente.nombre, doc: c.cliente.doc, telefono: c.cliente.telefono },
    comprobante: c.cliente.doc?.length === 11 ? 'FACTURA' : 'BOLETA',
    lineas: carrito.lineas.map(l => ({ codigo: l.sku, descripcion: l.name, cantidad: l.qty, precio: l.precioLista, descuentoPct: l.descuentoPct })),
    descuento: carrito.descuentoGlobal, notas: c.notas
  };
}

export function docDePedido(s: ErpState, p: Pedido, tipo: TipoDocumento = 'NOTA DE PEDIDO'): DocumentoComercial {
  return {
    tipo, numero: p.id, fecha: p.createdAt.slice(0, 10), vence: tipo === 'NOTA DE PEDIDO' ? undefined : sumarDias(hoyLocal(), 7),
    empresa: s.company, contacto: contacto(s),
    cliente: { nombre: p.razonSocial || p.cliente.nombre, doc: p.cliente.doc, telefono: p.cliente.telefono, direccion: [p.direccion, p.distrito].filter(Boolean).join(', ') },
    comprobante: p.tipoComprobante === '01' ? 'FACTURA' : p.tipoComprobante === '03' ? 'BOLETA' : undefined,
    lineas: p.items.map(it => ({ codigo: it.sku, descripcion: it.name, cantidad: it.qty, precio: it.unitPrice })),
    delivery: p.costoDelivery, notas: [p.notas, p.fechaEntrega && `Entrega: ${p.fechaEntrega}${p.franja ? ` (${p.franja})` : ''}`].filter(Boolean).join(' · ') || undefined,
    condiciones: tipo === 'NOTA DE PEDIDO' ? [`Estado: ${p.estado}`] : undefined
  };
}

export function docDeSolicitud(s: ErpState, sol: SolicitudTienda, tipo: TipoDocumento = 'PROFORMA'): DocumentoComercial {
  const servicio = s.serviciosPublicos.find(x => x.slug === sol.servicioSlug);
  return {
    tipo, numero: sol.id, fecha: hoyLocal(), vence: sumarDias(hoyLocal(), 7), empresa: s.company, contacto: contacto(s),
    cliente: { nombre: sol.razonSocial || sol.nombre, doc: sol.docCliente, telefono: sol.telefono, direccion: [sol.direccion, sol.distrito].filter(Boolean).join(', ') },
    comprobante: sol.comprobante,
    lineas: sol.items.length
      ? sol.items.map(it => ({ codigo: it.sku, descripcion: it.nombre, cantidad: it.cantidad, precio: s.products.find(p => p.sku === it.sku)?.price ?? it.precio }))
      : [{ descripcion: `Servicio: ${servicio?.nombre ?? sol.servicioSlug ?? 'por definir'} (monto por cotizar)`, cantidad: 1, precio: 0 }],
    notas: sol.mensaje,
    condiciones: sol.requiereAsesor ? ['Parte de las cantidades supera el stock actual: la fecha de entrega se confirma con el asesor.'] : undefined
  };
}

export const imprimir = imprimirDocumento;
