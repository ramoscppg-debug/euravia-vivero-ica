import { useEffect } from 'react';
import { Enlace } from '../../../app/router';
import { claseBoton, EstadoVacio } from '../../../components/ui';
import { fijarMetadatos } from '../seo';
import { Pagina } from '../TiendaApp';

export default function NoEncontrado() {
  useEffect(() => fijarMetadatos({ titulo: 'Página no encontrada', descripcion: 'La página que buscas no existe.' }), []);
  return (
    <Pagina className="py-20">
      <EstadoVacio titulo="No encontramos esta página" detalle="Puede que el enlace esté incompleto." accion={<Enlace href="/" className={claseBoton('primario', 'md')}>Ir al inicio</Enlace>} />
    </Pagina>
  );
}
