-- ========================================================
-- PRE-COTIZACIONES (estructura de cotización detallada)
-- - Líneas libres o del catálogo: concepto, unidad, cantidad, precio unitario SIN IGV y afectación
--   (gravado / exonerado / inafecto). Totales: op. gravadas, exoneradas, inafectas, IGV y total.
-- - "Con IGV" se activa cuando el cliente pide boleta o factura.
-- - Se envía por WhatsApp con un enlace privado (token) donde el cliente la ve y la descarga.
-- - Al aceptarla se registran el adelanto y los pagos: entran a caja y queda el saldo.
-- - Contabilidad simple por defecto: el menú muestra registro de ventas y compras, Kardex e inventario.
-- ========================================================

CREATE SEQUENCE IF NOT EXISTS public.precotizaciones_numero_seq;

CREATE TABLE IF NOT EXISTS public.precotizaciones (
    id BIGSERIAL PRIMARY KEY,
    numero VARCHAR(12) NOT NULL UNIQUE DEFAULT ('PC-' || lpad(nextval('public.precotizaciones_numero_seq')::TEXT, 5, '0')),
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),   -- enlace privado para el cliente
    fecha DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Lima')::DATE,
    validez_dias SMALLINT NOT NULL DEFAULT 15 CHECK (validez_dias BETWEEN 1 AND 90),
    cliente_nombre VARCHAR(150) NOT NULL CHECK (length(btrim(cliente_nombre)) >= 2),
    cliente_doc VARCHAR(11) CHECK (cliente_doc IS NULL OR cliente_doc ~ '^([0-9]{8}|[0-9]{11})$'),
    cliente_telefono VARCHAR(20),
    cliente_direccion VARCHAR(250),
    con_igv BOOLEAN NOT NULL DEFAULT TRUE,
    lineas JSONB NOT NULL CHECK (jsonb_typeof(lineas) = 'array' AND jsonb_array_length(lineas) BETWEEN 1 AND 60),
    condiciones JSONB NOT NULL DEFAULT '[]',
    notas TEXT,
    op_gravadas NUMERIC(12,2) NOT NULL DEFAULT 0,
    op_exoneradas NUMERIC(12,2) NOT NULL DEFAULT 0,
    op_inafectas NUMERIC(12,2) NOT NULL DEFAULT 0,
    igv NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL CHECK (total > 0),
    estado VARCHAR(10) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'PAGADA', 'RECHAZADA')),
    pagos JSONB NOT NULL DEFAULT '[]',              -- [{fecha, monto, medio, operacion}]
    creado_por VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (round(op_gravadas + op_exoneradas + op_inafectas + igv, 2) = total)
);
CREATE INDEX IF NOT EXISTS precotizaciones_fecha_idx ON public.precotizaciones (fecha DESC);
ALTER TABLE public.precotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY precotizaciones_equipo ON public.precotizaciones FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));

/** Lo que ve el cliente con su enlace: la cotización y los datos de contacto de la empresa (nada interno). */
CREATE OR REPLACE FUNCTION public.precotizacion_publica(p_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'numero', c.numero, 'fecha', c.fecha, 'validez_dias', c.validez_dias, 'estado', c.estado,
        'cliente_nombre', c.cliente_nombre, 'cliente_doc', c.cliente_doc, 'cliente_direccion', c.cliente_direccion,
        'con_igv', c.con_igv, 'lineas', c.lineas, 'condiciones', c.condiciones, 'notas', c.notas,
        'op_gravadas', c.op_gravadas, 'op_exoneradas', c.op_exoneradas, 'op_inafectas', c.op_inafectas, 'igv', c.igv, 'total', c.total,
        'pagado', (SELECT coalesce(sum((x->>'monto')::NUMERIC), 0) FROM jsonb_array_elements(c.pagos) x),
        'empresa', (SELECT jsonb_build_object('ruc', e.ruc, 'razon_social', e.razon_social, 'nombre_comercial', e.nombre_comercial, 'direccion', e.direccion,
                                              'cuenta_bcp', e.cuenta_bcp_soles)
                      FROM public.empresa_config e LIMIT 1),
        'contacto', (SELECT jsonb_build_object('whatsapp', t.whatsapp, 'email', t.email) FROM public.tienda_config t WHERE t.id = 1)
    )
    FROM public.precotizaciones c
    WHERE c.token = p_token AND c.estado <> 'BORRADOR';
$$;
REVOKE ALL ON FUNCTION public.precotizacion_publica(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.precotizacion_publica(UUID) TO anon, authenticated;

/** Adelanto o pago del cliente: queda en la cotización y entra a caja; con saldo cero pasa a PAGADA. */
CREATE OR REPLACE FUNCTION public.registrar_pago_precotizacion(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    c public.precotizaciones;
    v_monto NUMERIC := round((p->>'monto')::NUMERIC, 2);
    v_medio TEXT := p->>'medio';
    v_op TEXT := NULLIF(btrim(coalesce(p->>'operacion', '')), '');
    v_pagado NUMERIC;
    v_saldo NUMERIC;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar pagos' USING ERRCODE = '42501'; END IF;
    IF v_medio IS NULL OR v_medio NOT IN ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') THEN RAISE EXCEPTION 'Elige el medio de pago'; END IF;
    IF v_medio <> 'Efectivo' AND v_op IS NULL THEN RAISE EXCEPTION 'Indica el N° de operación'; END IF;
    SELECT * INTO c FROM public.precotizaciones WHERE id = (p->>'id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
    IF c.estado IN ('RECHAZADA', 'PAGADA') THEN RAISE EXCEPTION 'La cotización % está %', c.numero, lower(c.estado); END IF;
    SELECT coalesce(sum((x->>'monto')::NUMERIC), 0) INTO v_pagado FROM jsonb_array_elements(c.pagos) x;
    v_saldo := c.total - v_pagado;
    IF v_monto IS NULL OR v_monto <= 0 OR v_monto > v_saldo THEN RAISE EXCEPTION 'El monto debe estar entre S/ 0.01 y el saldo (S/ %)', v_saldo; END IF;

    UPDATE public.precotizaciones
       SET pagos = pagos || jsonb_build_array(jsonb_build_object('fecha', (now() AT TIME ZONE 'America/Lima')::DATE, 'monto', v_monto, 'medio', v_medio, 'operacion', v_op)),
           estado = CASE WHEN v_saldo - v_monto = 0 THEN 'PAGADA' ELSE 'ACEPTADA' END,
           updated_at = now()
     WHERE id = c.id;
    INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, responsable)
    VALUES ('INGRESO', v_medio, v_monto,
            CASE WHEN v_pagado = 0 THEN 'Adelanto ' ELSE 'Pago ' END || c.numero || ' · ' || left(c.cliente_nombre, 60) || coalesce(' · op. ' || v_op, ''),
            coalesce(p->>'usuario', 'Caja'));
    RETURN jsonb_build_object('saldo', v_saldo - v_monto, 'estado', CASE WHEN v_saldo - v_monto = 0 THEN 'PAGADA' ELSE 'ACEPTADA' END);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_pago_precotizacion(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_precotizacion(JSONB) TO authenticated;

-- Contabilidad simple: el libro diario, detracciones, planilla y cierre siguen funcionando por detrás
-- pero sólo se muestran en el menú si el dueño activa la contabilidad completa
ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS contabilidad_completa BOOLEAN NOT NULL DEFAULT FALSE;
