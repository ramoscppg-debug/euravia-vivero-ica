import { useEffect } from 'react';
import { Clock, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useUbicacion } from '../../../app/router';
import { claseBoton } from '../../../components/ui';
import { enlaceWhatsapp } from '../datos';
import { FormularioSolicitud } from '../componentes';
import { fijarMetadatos } from '../seo';
import { Pagina, useTienda } from '../TiendaApp';

export default function Contacto() {
  const { datos } = useTienda();
  const { query } = useUbicacion();
  const sku = query.get('producto');
  const producto = sku ? datos?.productos.find(p => p.sku === sku) : undefined;
  useEffect(() => fijarMetadatos({ titulo: 'Contacto', descripcion: 'Escríbenos para consultas sobre plantas, insumos y servicios de jardinería.' }), []);

  const c = datos?.config;
  const wa = c ? enlaceWhatsapp(c, 'Hola, tengo una consulta.') : null;
  const tieneDatos = !!(wa || c?.email || c?.direccion || c?.horario);

  return (
    <Pagina className="py-10 grid lg:grid-cols-[1fr_1.2fr] gap-10">
      <div className="space-y-5">
        <h1 className="font-serif text-4xl font-bold text-bosque-950">Contacto</h1>
        <p className="text-tinta-suave">Escríbenos y te respondemos a la brevedad.</p>
        {tieneDatos && (
          <ul className="space-y-3">
            {c?.direccion && <li className="flex gap-3"><MapPin className="w-5 h-5 text-bosque-600 shrink-0" aria-hidden />{c.direccion}</li>}
            {c?.horario && <li className="flex gap-3"><Clock className="w-5 h-5 text-bosque-600 shrink-0" aria-hidden />{c.horario}</li>}
            {c?.email && <li className="flex gap-3"><Mail className="w-5 h-5 text-bosque-600 shrink-0" aria-hidden /><a href={`mailto:${c.email}`} className="underline">{c.email}</a></li>}
          </ul>
        )}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={claseBoton('acento', 'lg')}><MessageCircle className="w-5 h-5" aria-hidden /> Escribir por WhatsApp</a>}
      </div>
      <div className="p-6 rounded-tarjeta bg-white border border-crema-300 shadow-suave">
        <FormularioSolicitud
          key={sku ?? 'general'}
          base={{ tipo: 'CONSULTA', mensaje: producto ? `Consulta sobre ${producto.nombre} (${producto.sku}).` : '' }}
          titulo="Envíanos tu consulta"
          boton="Enviar consulta"
        />
      </div>
    </Pagina>
  );
}
