// ==========================================
// COTIZACIÓN DEL CLIENTE (enlace privado que llega por WhatsApp)
// Sólo se ve con el código del enlace; muestra la cotización, la descarga en PDF y la acepta por WhatsApp.
// ==========================================
import { useEffect, useState } from 'react';
import { CheckCircle2, FileDown } from 'lucide-react';
import { cargarEstadoDemo } from '../../../data/estadoDemo';
import { EstadoVacio, Esqueleto } from '../../../components/ui';
import { imprimirHtml } from '../../../lib/documentos';
import { empresaDoc, ESTILO_PRECOTIZACION, htmlPrecotizacion, type EmpresaDoc, type Precotizacion } from '../../../lib/precotizacion';
import { precotizacionPublica } from '../../../lib/repo';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { enlaceWhatsapp } from '../datos';
import { fijarMetadatos } from '../seo';
import { Pagina } from '../TiendaApp';

type Datos = { c: Omit<Precotizacion, 'id' | 'token'>; e: EmpresaDoc };

async function cargar(token: string): Promise<Datos | null> {
  if (!isSupabaseConfigured) {
    const s = cargarEstadoDemo();
    const c = (s.precotizaciones ?? []).find(x => x.token === token && x.estado !== 'BORRADOR');
    return c ? { c, e: empresaDoc(s.company, s.tiendaConfig) } : null;
  }
  const r = await precotizacionPublica(token);
  if (!r) return null;
  const pagado = Number(r.pagado ?? 0);
  return {
    c: {
      numero: r.numero, fecha: r.fecha, validezDias: r.validez_dias, estado: r.estado, conIgv: !!r.con_igv, notas: r.notas ?? undefined,
      cliente: { nombre: r.cliente_nombre, doc: r.cliente_doc ?? undefined, direccion: r.cliente_direccion ?? undefined },
      lineas: (r.lineas ?? []).map((l: Record<string, unknown>) => ({ ...l, cantidad: Number(l.cantidad), precio: Number(l.precio) })), condiciones: r.condiciones ?? [],
      opGravadas: Number(r.op_gravadas), opExoneradas: Number(r.op_exoneradas), opInafectas: Number(r.op_inafectas), igv: Number(r.igv), total: Number(r.total),
      pagos: pagado ? [{ fecha: r.fecha, monto: pagado, medio: '' }] : [],
      comprobantes: (r.comprobantes ?? []).map((x: Record<string, string>) => ({ tipo: x.tipo, numero: x.numero, url: x.url, fecha: '' }))
    } as Omit<Precotizacion, 'id' | 'token'>,
    e: { ruc: r.empresa?.ruc, razonSocial: r.empresa?.razon_social, nombreComercial: r.empresa?.nombre_comercial, direccion: r.empresa?.direccion, cuentaBcp: r.empresa?.cuenta_bcp, whatsapp: r.contacto?.whatsapp ?? undefined, email: r.contacto?.email ?? undefined }
  };
}

export default function CotizacionCliente({ token }: { token: string }) {
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined);
  useEffect(() => { fijarMetadatos({ titulo: 'Tu cotización', descripcion: 'Cotización de AUREVIA' }); }, []);
  useEffect(() => { cargar(token).then(setDatos).catch(() => setDatos(null)); }, [token]);

  if (datos === undefined) return <Pagina className="py-10"><Esqueleto className="h-96 !rounded-3xl" /></Pagina>;
  if (!datos) return <Pagina className="py-16"><EstadoVacio titulo="No encontramos esta cotización" detalle="Revisa el enlace o pide a tu asesor que te la envíe de nuevo." /></Pagina>;

  const html = htmlPrecotizacion(datos.c, datos.e);
  const aceptar = enlaceWhatsapp({ whatsapp: datos.e.whatsapp }, `Hola, acepto la cotización N° ${datos.c.numero}. ¿Cómo coordinamos el adelanto?`);
  return (
    <Pagina className="py-8 space-y-4">
      {datos.c.comprobantes.length > 0 && (
        <div aria-label="Tus comprobantes" className="p-4 rounded-3xl bg-hoja-50 border border-hoja-100 flex flex-wrap items-center gap-3">
          <span className="font-bold text-hoja-900">Tu comprobante:</span>
          {datos.c.comprobantes.map(x => (
            <a key={x.numero} href={x.url} target="_blank" rel="noreferrer" className="min-h-[44px] px-4 rounded-full bg-hoja-700 text-white font-bold inline-flex items-center gap-2">
              <FileDown className="w-4 h-4" aria-hidden /> {x.tipo === '01' ? 'Factura' : 'Boleta'} {x.numero}
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 justify-end">
        <button onClick={() => imprimirHtml(`Cotización ${datos.c.numero}`, html, ESTILO_PRECOTIZACION)} className="min-h-[48px] px-5 rounded-full border border-slate-300 font-bold inline-flex items-center gap-2"><FileDown className="w-5 h-5" aria-hidden /> Descargar PDF</button>
        {aceptar && (datos.c.estado === 'ENVIADA') && <a href={aceptar} target="_blank" rel="noreferrer" className="min-h-[48px] px-5 rounded-full bg-hoja-700 text-white font-bold inline-flex items-center gap-2"><CheckCircle2 className="w-5 h-5" aria-hidden /> Aceptar por WhatsApp</a>}
      </div>
      <style>{ESTILO_PRECOTIZACION}</style>
      <div aria-label="Cotización" className="bg-white rounded-3xl border border-slate-200 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    </Pagina>
  );
}
