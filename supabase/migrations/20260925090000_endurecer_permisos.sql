-- ========================================================
-- ENDURECER PERMISOS (auditoría): el vendedor registra y consulta,
-- pero no puede borrar ni editar caja, compras, comprobantes, guías ni clientes.
-- Sólo el dueño corrige o elimina registros.
-- ========================================================

-- Caja: nadie más que el dueño toca un movimiento ya registrado
DROP POLICY IF EXISTS caja_ventas ON public.caja_movimientos;
CREATE POLICY caja_leer ON public.caja_movimientos FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY caja_registrar ON public.caja_movimientos FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY caja_dueno_corrige ON public.caja_movimientos FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));
CREATE POLICY caja_dueno_borra ON public.caja_movimientos FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));

-- Compras
DROP POLICY IF EXISTS compras_almacen ON public.compras;
CREATE POLICY compras_leer ON public.compras FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY compras_registrar ON public.compras FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY compras_dueno_corrige ON public.compras FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));
CREATE POLICY compras_dueno_borra ON public.compras FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));

-- Comprobantes emitidos: no se editan montos; la corrección SUNAT es una nota de crédito
DROP POLICY IF EXISTS comprobantes_actualizar_cdr ON public.comprobantes;
CREATE POLICY comprobantes_dueno_corrige ON public.comprobantes FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Guías de remisión
DROP POLICY IF EXISTS guias_ventas ON public.guias_remision;
CREATE POLICY guias_leer ON public.guias_remision FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY guias_emitir ON public.guias_remision FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY guias_dueno_corrige ON public.guias_remision FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Clientes: el vendedor crea y actualiza fichas, pero no las borra
DROP POLICY IF EXISTS clientes_gestionar ON public.clientes;
CREATE POLICY clientes_registrar ON public.clientes FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY clientes_actualizar ON public.clientes FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY clientes_dueno_borra ON public.clientes FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));

-- Kardex: sólo el dueño hace ajustes de inventario manuales (sube o baja stock sin documento)
DROP POLICY IF EXISTS kardex_insertar ON public.kardex_movimientos;
CREATE POLICY kardex_insertar ON public.kardex_movimientos FOR INSERT TO authenticated
    WITH CHECK (
        public.tiene_rol('{dueno}')
        OR (public.tiene_rol('{vendedor}') AND tipo_movimiento IN ('Venta Cliente', 'Compra Proveedor', 'Baja por Perdida', 'Servicio Jardineria', 'Devolucion Cliente'))
        OR (public.tiene_rol('{jardinero}') AND tipo_movimiento IN ('Servicio Jardineria', 'Baja por Perdida'))
    );

-- Los datos fiscales ya no llevan secretos: se borra cualquier Clave SOL que hubiera quedado dentro de las guías
UPDATE public.guias_remision SET datos = datos #- '{emisor,claveSol}' #- '{emisor,usuarioSol}'
WHERE datos->'emisor' ? 'claveSol' OR datos->'emisor' ? 'usuarioSol';
