-- ========================================================
-- POS PROFESIONAL: venta y nota de crédito atómicas
-- Una sola llamada guarda comprobante + Kardex + caja + guía + cliente.
-- Si algo falla (p. ej. stock insuficiente) no queda nada a medias.
-- ========================================================

ALTER TABLE public.comprobantes
    ADD COLUMN IF NOT EXISTS descuento_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pagos JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS comprobante_referencia VARCHAR(20) REFERENCES public.comprobantes(id),
    ADD COLUMN IF NOT EXISTS motivo TEXT;

CREATE INDEX IF NOT EXISTS comprobantes_referencia_idx ON public.comprobantes (comprobante_referencia);

/*
  p = {
    comprobante: { id, tipo_comprobante, serie, correlativo, fecha_emision, hora_emision, cliente,
                   cliente_tipo_doc, cliente_num_doc, op_gravadas, total_igv, monto_total, items,
                   estado_sunat, codigo_respuesta, descripcion_respuesta, hash_cpe, medio_pago,
                   descuento_total, pagos, comprobante_referencia, motivo },
    movimientos: [{ producto_sku, tipo_movimiento, cantidad_entrada, cantidad_salida, costo_unitario }],
    caja:        [{ tipo, medio_pago, monto, concepto }],
    guia:        { id, fecha_emision, datos } | null,
    cliente:     { nombre, tipo_doc, num_doc } | null,
    responsable: text
  }
  Devuelve los movimientos de Kardex creados (con el saldo que fijó el servidor).
  SECURITY INVOKER: cada insert respeta las reglas RLS del rol que llama.
*/
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
        descuento_total, pagos, comprobante_referencia, motivo
    ) VALUES (
        c->>'id', c->>'tipo_comprobante', c->>'serie', (c->>'correlativo')::INT, (c->>'fecha_emision')::DATE,
        c->>'hora_emision', c->>'cliente', c->>'cliente_tipo_doc', c->>'cliente_num_doc',
        (c->>'op_gravadas')::NUMERIC, (c->>'total_igv')::NUMERIC, (c->>'monto_total')::NUMERIC,
        COALESCE(c->'items', '[]'), c->>'estado_sunat', c->>'codigo_respuesta', c->>'descripcion_respuesta',
        c->>'hash_cpe', c->>'medio_pago', COALESCE((c->>'descuento_total')::NUMERIC, 0),
        COALESCE(c->'pagos', '[]'), c->>'comprobante_referencia', c->>'motivo'
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
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_comprobante(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_comprobante(JSONB) TO authenticated;
