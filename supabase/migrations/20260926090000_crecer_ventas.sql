-- ========================================================
-- CRECER VENTAS: cotizaciones, cupones, puntos de fidelidad, contratos de mantenimiento
-- y datos para reportes (vendedor y canal de cada comprobante)
-- ========================================================

-- ---------- Comprobantes: quién vendió, por qué canal, cupón y puntos ----------
ALTER TABLE public.comprobantes
    ADD COLUMN IF NOT EXISTS vendedor VARCHAR(100),
    ADD COLUMN IF NOT EXISTS canal VARCHAR(40),
    ADD COLUMN IF NOT EXISTS cupon VARCHAR(30),
    ADD COLUMN IF NOT EXISTS puntos_ganados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS puntos_canjeados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cotizacion_id VARCHAR(20),
    ADD COLUMN IF NOT EXISTS contrato_id VARCHAR(20);

-- ---------- Cotizaciones de productos ----------
CREATE TABLE IF NOT EXISTS public.cotizaciones (
    id VARCHAR(20) PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    vence DATE NOT NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_doc VARCHAR(11),
    cliente_telefono VARCHAR(20),
    items JSONB NOT NULL, -- [{sku, name, qty, descuentoPct}]
    descuento_global JSONB NOT NULL DEFAULT '{"tipo":"PCT","valor":0}',
    total NUMERIC(12,2) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'ENVIADA' CHECK (estado IN ('ENVIADA', 'ACEPTADA', 'CONVERTIDA', 'RECHAZADA')),
    comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),
    notas TEXT,
    creado_por VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY cotizaciones_leer ON public.cotizaciones FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY cotizaciones_crear ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY cotizaciones_actualizar ON public.cotizaciones FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY cotizaciones_dueno_borra ON public.cotizaciones FOR DELETE TO authenticated USING (public.tiene_rol('{dueno}'));

-- ---------- Cupones ----------
CREATE TABLE IF NOT EXISTS public.cupones (
    codigo VARCHAR(30) PRIMARY KEY CHECK (codigo = upper(codigo) AND codigo ~ '^[A-Z0-9_-]{3,30}$'),
    descripcion TEXT,
    tipo VARCHAR(5) NOT NULL CHECK (tipo IN ('PCT', 'MONTO')),
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    minimo_compra NUMERIC(10,2) NOT NULL DEFAULT 0,
    vence DATE,
    usos_max INT CHECK (usos_max IS NULL OR usos_max > 0),
    usos INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (tipo <> 'PCT' OR valor <= 100)
);
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
CREATE POLICY cupones_leer ON public.cupones FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY cupones_dueno ON public.cupones FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

/** Valida el cupón para una base (ya con otros descuentos), suma un uso y devuelve el descuento. */
CREATE OR REPLACE FUNCTION public.aplicar_cupon(p_codigo TEXT, p_base NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    cu public.cupones;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN
        RAISE EXCEPTION 'Tu rol no puede aplicar cupones' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO cu FROM public.cupones WHERE codigo = upper(p_codigo) FOR UPDATE;
    IF NOT FOUND OR NOT cu.activo THEN RAISE EXCEPTION 'Cupón % no existe o está desactivado', p_codigo; END IF;
    IF cu.vence IS NOT NULL AND cu.vence < CURRENT_DATE THEN RAISE EXCEPTION 'Cupón % vencido', p_codigo; END IF;
    IF cu.usos_max IS NOT NULL AND cu.usos >= cu.usos_max THEN RAISE EXCEPTION 'Cupón % agotado', p_codigo; END IF;
    IF p_base < cu.minimo_compra THEN RAISE EXCEPTION 'El cupón % pide una compra mínima de S/ %', p_codigo, cu.minimo_compra; END IF;
    UPDATE public.cupones SET usos = usos + 1 WHERE codigo = cu.codigo;
    RETURN round(LEAST(p_base, CASE WHEN cu.tipo = 'PCT' THEN p_base * cu.valor / 100 ELSE cu.valor END), 2);
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_cupon(TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_cupon(TEXT, NUMERIC) TO authenticated;

-- ---------- Puntos de fidelidad (libro de movimientos) ----------
-- Regla: 1 punto por cada S/ 10 pagados; 1 punto canjeado = S/ 0.10 de descuento
CREATE TABLE IF NOT EXISTS public.puntos_movimientos (
    id BIGSERIAL PRIMARY KEY,
    cliente_doc VARCHAR(11) NOT NULL,
    puntos INT NOT NULL CHECK (puntos <> 0),
    comprobante_id VARCHAR(20) NOT NULL REFERENCES public.comprobantes(id),
    motivo VARCHAR(12) NOT NULL CHECK (motivo IN ('GANADOS', 'CANJE', 'DEVOLUCION')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (comprobante_id, motivo)
);
CREATE INDEX IF NOT EXISTS puntos_cliente_idx ON public.puntos_movimientos (cliente_doc);
ALTER TABLE public.puntos_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY puntos_leer ON public.puntos_movimientos FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));

CREATE OR REPLACE VIEW public.puntos_saldos WITH (security_invoker = true) AS
    SELECT cliente_doc, SUM(puntos)::INT AS saldo FROM public.puntos_movimientos GROUP BY cliente_doc;

/**
  Mueve puntos ligados a un comprobante ya guardado. Sólo el servidor decide cuántos:
  GANADOS = piso(total/10) del comprobante; DEVOLUCION = −piso(total/10) de la nota de crédito;
  CANJE = lo pedido, si el cliente tiene saldo. Cada comprobante mueve puntos una sola vez por motivo.
*/
CREATE OR REPLACE FUNCTION public.mover_puntos(p_comprobante TEXT, p_motivo TEXT, p_canje INT DEFAULT 0)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    cp public.comprobantes;
    pts INT;
    saldo INT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN
        RAISE EXCEPTION 'Tu rol no puede mover puntos' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO cp FROM public.comprobantes WHERE id = p_comprobante;
    IF NOT FOUND OR coalesce(cp.cliente_num_doc, '') !~ '^[0-9]{8}([0-9]{3})?$' THEN RETURN 0; END IF;

    IF p_motivo = 'GANADOS' THEN
        pts := floor(cp.monto_total / 10);
    ELSIF p_motivo = 'DEVOLUCION' THEN
        pts := -floor(cp.monto_total / 10);
    ELSIF p_motivo = 'CANJE' THEN
        SELECT coalesce(SUM(puntos), 0) INTO saldo FROM public.puntos_movimientos WHERE cliente_doc = cp.cliente_num_doc;
        IF p_canje > saldo THEN RAISE EXCEPTION 'El cliente sólo tiene % puntos', saldo; END IF;
        pts := -p_canje;
    ELSE
        RAISE EXCEPTION 'Motivo de puntos inválido';
    END IF;

    IF pts <> 0 THEN
        INSERT INTO public.puntos_movimientos (cliente_doc, puntos, comprobante_id, motivo)
        VALUES (cp.cliente_num_doc, pts, cp.id, p_motivo);
    END IF;
    RETURN pts;
END;
$$;
REVOKE ALL ON FUNCTION public.mover_puntos(TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mover_puntos(TEXT, TEXT, INT) TO authenticated;

-- ---------- Contratos de mantenimiento mensual ----------
CREATE TABLE IF NOT EXISTS public.contratos (
    id VARCHAR(20) PRIMARY KEY,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_doc VARCHAR(11) NOT NULL,
    cliente_telefono VARCHAR(20),
    direccion TEXT,
    servicio TEXT NOT NULL,
    monto_mensual NUMERIC(10,2) NOT NULL CHECK (monto_mensual > 0),
    dia_cobro INT NOT NULL CHECK (dia_cobro BETWEEN 1 AND 28),
    visitas_mes INT NOT NULL DEFAULT 1 CHECK (visitas_mes BETWEEN 1 AND 8),
    jardinero VARCHAR(100),
    inicio DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_periodo VARCHAR(7), -- 'YYYY-MM' último mes facturado
    creado_por VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contratos_leer ON public.contratos FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY contratos_crear ON public.contratos FOR INSERT TO authenticated WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY contratos_actualizar ON public.contratos FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY contratos_dueno_borra ON public.contratos FOR DELETE TO authenticated USING (public.tiene_rol('{dueno}'));

-- ---------- registrar_comprobante: vendedor, canal, cupón, puntos, cotización y contrato ----------
CREATE OR REPLACE FUNCTION public.registrar_comprobante(p JSONB)
RETURNS SETOF public.kardex_movimientos
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    c JSONB := p->'comprobante';
    m JSONB;
    k public.kardex_movimientos;
    excede TEXT;
    desc_cupon NUMERIC;
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

    -- Cupón: el servidor lo valida, suma el uso y confirma el descuento que calculó la caja
    IF coalesce(c->>'cupon', '') <> '' THEN
        desc_cupon := public.aplicar_cupon(c->>'cupon', (c->>'base_cupon')::NUMERIC);
        IF abs(desc_cupon - coalesce((c->>'descuento_cupon')::NUMERIC, 0)) > 0.01 THEN
            RAISE EXCEPTION 'El descuento del cupón no coincide (servidor: S/ %)', desc_cupon;
        END IF;
    END IF;

    INSERT INTO public.comprobantes (
        id, tipo_comprobante, serie, correlativo, fecha_emision, hora_emision, cliente,
        cliente_tipo_doc, cliente_num_doc, op_gravadas, total_igv, monto_total, items,
        estado_sunat, codigo_respuesta, descripcion_respuesta, hash_cpe, medio_pago,
        descuento_total, pagos, comprobante_referencia, motivo, pedido_id,
        vendedor, canal, cupon, puntos_canjeados, cotizacion_id, contrato_id
    ) VALUES (
        c->>'id', c->>'tipo_comprobante', c->>'serie', (c->>'correlativo')::INT, (c->>'fecha_emision')::DATE,
        c->>'hora_emision', c->>'cliente', c->>'cliente_tipo_doc', c->>'cliente_num_doc',
        (c->>'op_gravadas')::NUMERIC, (c->>'total_igv')::NUMERIC, (c->>'monto_total')::NUMERIC,
        COALESCE(c->'items', '[]'), c->>'estado_sunat', c->>'codigo_respuesta', c->>'descripcion_respuesta',
        c->>'hash_cpe', c->>'medio_pago', COALESCE((c->>'descuento_total')::NUMERIC, 0),
        COALESCE(c->'pagos', '[]'), c->>'comprobante_referencia', c->>'motivo', c->>'pedido_id',
        p->>'responsable', c->>'canal', NULLIF(upper(c->>'cupon'), ''), COALESCE((c->>'puntos_canjeados')::INT, 0),
        c->>'cotizacion_id', c->>'contrato_id'
    );

    -- Puntos de fidelidad (sólo clientes con DNI/RUC)
    IF COALESCE((c->>'puntos_canjeados')::INT, 0) > 0 THEN
        PERFORM public.mover_puntos(c->>'id', 'CANJE', (c->>'puntos_canjeados')::INT);
    END IF;
    IF c->>'tipo_comprobante' IN ('01', '03') THEN
        UPDATE public.comprobantes SET puntos_ganados = public.mover_puntos(c->>'id', 'GANADOS') WHERE id = c->>'id';
    ELSIF c->>'tipo_comprobante' = '07' THEN
        PERFORM public.mover_puntos(c->>'id', 'DEVOLUCION');
    END IF;

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
           SET estado = 'pagado', comprobante_id = c->>'id', metodo_pago = c->>'medio_pago',
               guia_id = COALESCE(p->'guia'->>'id', guia_id), updated_at = now()
         WHERE id = c->>'pedido_id' AND estado = 'pendiente';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El pedido % ya no está pendiente de cobro', c->>'pedido_id';
        END IF;
    END IF;

    -- Cotización convertida en venta
    IF c->>'cotizacion_id' IS NOT NULL THEN
        UPDATE public.cotizaciones SET estado = 'CONVERTIDA', comprobante_id = c->>'id'
         WHERE id = c->>'cotizacion_id' AND estado IN ('ENVIADA', 'ACEPTADA');
        IF NOT FOUND THEN RAISE EXCEPTION 'La cotización % ya fue convertida o rechazada', c->>'cotizacion_id'; END IF;
    END IF;

    -- Mensualidad de un contrato: un solo comprobante por mes
    IF c->>'contrato_id' IS NOT NULL THEN
        UPDATE public.contratos SET ultimo_periodo = to_char((c->>'fecha_emision')::DATE, 'YYYY-MM')
         WHERE id = c->>'contrato_id' AND activo
           AND (ultimo_periodo IS NULL OR ultimo_periodo < to_char((c->>'fecha_emision')::DATE, 'YYYY-MM'));
        IF NOT FOUND THEN RAISE EXCEPTION 'El contrato % ya se facturó este mes o está inactivo', c->>'contrato_id'; END IF;
    END IF;
END;
$$;
