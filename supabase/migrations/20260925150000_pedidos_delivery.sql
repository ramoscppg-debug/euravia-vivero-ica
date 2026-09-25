-- ========================================================
-- PEDIDOS & DELIVERY
-- Pedido (WhatsApp, redes, web) → cobro con comprobante → preparación → reparto → entrega con foto.
-- ========================================================

ALTER TABLE public.pedidos
    ALTER COLUMN metodo_pago DROP NOT NULL, -- un pedido pendiente aún no tiene pago
    ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(150),
    ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cliente_doc VARCHAR(11),
    ADD COLUMN IF NOT EXISTS direccion TEXT,
    ADD COLUMN IF NOT EXISTS distrito VARCHAR(80),
    ADD COLUMN IF NOT EXISTS referencia TEXT,
    ADD COLUMN IF NOT EXISTS fecha_entrega DATE,
    ADD COLUMN IF NOT EXISTS franja_horaria VARCHAR(30),
    ADD COLUMN IF NOT EXISTS notas TEXT,
    ADD COLUMN IF NOT EXISTS comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),
    ADD COLUMN IF NOT EXISTS guia_id VARCHAR(20),
    ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS creado_por VARCHAR(100),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.pedidos
    ADD CONSTRAINT pedidos_estado_valido
    CHECK (estado IN ('pendiente', 'pagado', 'preparando', 'en-reparto', 'entregado', 'cancelado'));

CREATE INDEX IF NOT EXISTS pedidos_estado_idx ON public.pedidos (estado, fecha_entrega);

-- Permisos: ventas gestiona pedidos; sólo el dueño borra
DROP POLICY IF EXISTS pedidos_ventas ON public.pedidos;
CREATE POLICY pedidos_leer ON public.pedidos FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY pedidos_crear ON public.pedidos FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY pedidos_actualizar ON public.pedidos FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY pedidos_dueno_borra ON public.pedidos FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));

-- Fotos de evidencia de entrega (carpeta privada: se ven con enlace temporal)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidencias', 'evidencias', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY evidencias_subir ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'evidencias' AND public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY evidencias_ver ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'evidencias' AND public.tiene_rol('{dueno,vendedor}'));

-- El cobro de un pedido va en la misma transacción que su comprobante, Kardex y caja
CREATE OR REPLACE FUNCTION public.registrar_comprobante(p JSONB)
RETURNS SETOF public.kardex_movimientos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    c JSONB := p->'comprobante';
    m JSONB;
    k public.kardex_movimientos;
    excede TEXT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN
        RAISE EXCEPTION 'Tu rol no puede emitir comprobantes' USING ERRCODE = '42501';
    END IF;

    -- Nota de crédito: lo devuelto (acumulado) nunca supera lo vendido en el comprobante original
    IF c->>'tipo_comprobante' = '07' THEN
        IF NOT EXISTS (SELECT 1 FROM public.comprobantes WHERE id = c->>'comprobante_referencia' AND tipo_comprobante IN ('01', '03')) THEN
            RAISE EXCEPTION 'El comprobante de referencia % no existe', c->>'comprobante_referencia';
        END IF;
        SELECT string_agg(dev.sku, ', ') INTO excede
        FROM (
            SELECT it->>'sku' AS sku, SUM((it->>'cantidad')::NUMERIC) AS q
            FROM (
                SELECT jsonb_array_elements(n.items) AS it FROM public.comprobantes n
                 WHERE n.comprobante_referencia = c->>'comprobante_referencia' AND n.tipo_comprobante = '07'
                UNION ALL
                SELECT jsonb_array_elements(c->'items')
            ) z GROUP BY 1
        ) dev
        LEFT JOIN (
            SELECT it->>'sku' AS sku, SUM((it->>'cantidad')::NUMERIC) AS q
            FROM public.comprobantes o, jsonb_array_elements(o.items) it
            WHERE o.id = c->>'comprobante_referencia' GROUP BY 1
        ) ven USING (sku)
        WHERE ven.q IS NULL OR dev.q > ven.q;
        IF excede IS NOT NULL THEN
            RAISE EXCEPTION 'La devolución supera lo vendido para: %', excede;
        END IF;
    END IF;

    INSERT INTO public.comprobantes (
        id, tipo_comprobante, serie, correlativo, fecha_emision, hora_emision, cliente,
        cliente_tipo_doc, cliente_num_doc, op_gravadas, total_igv, monto_total, items,
        estado_sunat, codigo_respuesta, descripcion_respuesta, hash_cpe, medio_pago,
        descuento_total, pagos, comprobante_referencia, motivo, pedido_id
    ) VALUES (
        c->>'id', c->>'tipo_comprobante', c->>'serie', (c->>'correlativo')::INT, (c->>'fecha_emision')::DATE,
        c->>'hora_emision', c->>'cliente', c->>'cliente_tipo_doc', c->>'cliente_num_doc',
        (c->>'op_gravadas')::NUMERIC, (c->>'total_igv')::NUMERIC, (c->>'monto_total')::NUMERIC,
        COALESCE(c->'items', '[]'), c->>'estado_sunat', c->>'codigo_respuesta', c->>'descripcion_respuesta',
        c->>'hash_cpe', c->>'medio_pago', COALESCE((c->>'descuento_total')::NUMERIC, 0),
        COALESCE(c->'pagos', '[]'), c->>'comprobante_referencia', c->>'motivo', c->>'pedido_id'
    );

    FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(p->'movimientos', '[]')) LOOP
        INSERT INTO public.kardex_movimientos (
            producto_sku, tipo_movimiento, cantidad_entrada, cantidad_salida, saldo_resultante,
            costo_unitario, documento_referencia, usuario_responsable
        ) VALUES (
            m->>'producto_sku', m->>'tipo_movimiento', COALESCE((m->>'cantidad_entrada')::INT, 0),
            COALESCE((m->>'cantidad_salida')::INT, 0), 0, (m->>'costo_unitario')::NUMERIC,
            c->>'id', p->>'responsable'
        ) RETURNING * INTO k;
        RETURN NEXT k;
    END LOOP;

    INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, comprobante_id, responsable)
    SELECT x->>'tipo', x->>'medio_pago', (x->>'monto')::NUMERIC, x->>'concepto', c->>'id', p->>'responsable'
    FROM jsonb_array_elements(COALESCE(p->'caja', '[]')) x;

    IF jsonb_typeof(p->'guia') = 'object' THEN
        INSERT INTO public.guias_remision (id, fecha_emision, comprobante_id, datos)
        VALUES (p->'guia'->>'id', (p->'guia'->>'fecha_emision')::DATE, c->>'id', p->'guia'->'datos');
    END IF;

    IF jsonb_typeof(p->'cliente') = 'object' THEN
        INSERT INTO public.clientes (nombre, tipo_doc, num_doc)
        VALUES (p->'cliente'->>'nombre', p->'cliente'->>'tipo_doc', p->'cliente'->>'num_doc')
        ON CONFLICT (num_doc) DO UPDATE SET nombre = EXCLUDED.nombre;
    END IF;

    -- Cobro de un pedido: pasa de pendiente a pagado en la misma transacción
    IF c->>'pedido_id' IS NOT NULL THEN
        UPDATE public.pedidos
           SET estado = 'pagado',
               comprobante_id = c->>'id',
               metodo_pago = c->>'medio_pago',
               guia_id = COALESCE(p->'guia'->>'id', guia_id),
               updated_at = now()
         WHERE id = c->>'pedido_id' AND estado = 'pendiente';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El pedido % ya no está pendiente de cobro', c->>'pedido_id';
        END IF;
    END IF;
END;
$$;
