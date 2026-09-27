import { useEffect } from 'react';
import { Enlace } from '../../../app/router';
import { EstadoVacio } from '../../../components/ui';
import { url } from '../datos';
import { fijarMetadatos } from '../seo';
import { Pagina } from '../TiendaApp';

export default function NoEncontrado() {
  useEffect(() => fijarMetadatos({ titulo: 'Página no encontrada', descripcion: 'La página que buscas no existe.' }), []);
  return (
    <Pagina className="py-20">
      <EstadoVacio titulo="No encontramos esta página" detalle="Puede que el enlace esté incompleto." accion={<Enlace href={url()} className="inline-flex min-h-[48px] items-center px-6 rounded-full bg-hoja-700 text-white font-bold">Ir a la tienda</Enlace>} />
    </Pagina>
  );
}
