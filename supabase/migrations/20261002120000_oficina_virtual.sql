-- ========================================================
-- OFICINA VIRTUAL
-- - Metas de venta por mes (avance, ritmo y proyección en el panel).
-- - Vencimientos que anota el dueño (cronograma SUNAT según su RUC, alquiler, préstamos…).
-- - Resumen diario por WhatsApp (CallMeBot) a las 8:00 a. m. de Lima: ventas de ayer, avance de la
--   meta, vencimientos próximos, detracciones por depositar y lo pendiente del día.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.metas_venta (
    periodo CHAR(7) PRIMARY KEY CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.metas_venta ENABLE ROW LEVEL SECURITY;
CREATE POLICY metas_ver ON public.metas_venta FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY metas_dueno ON public.metas_venta FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

CREATE TABLE IF NOT EXISTS public.vencimientos (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    descripcion VARCHAR(150) NOT NULL CHECK (length(btrim(descripcion)) >= 3),
    hecho BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vencimientos_fecha_idx ON public.vencimientos (fecha) WHERE NOT hecho;
ALTER TABLE public.vencimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY vencimientos_dueno ON public.vencimientos FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

ALTER TABLE public.notificaciones_config
    ADD COLUMN IF NOT EXISTS resumen_diario BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dias_anticipacion SMALLINT NOT NULL DEFAULT 3 CHECK (dias_anticipacion BETWEEN 0 AND 15);

/** Texto del resumen diario (mismo contenido que el tablero del día). */
CREATE OR REPLACE FUNCTION public.resumen_diario_texto()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_hoy DATE := (now() AT TIME ZONE 'America/Lima')::DATE;
    v_dias INT := coalesce((SELECT dias_anticipacion FROM public.notificaciones_config WHERE id = 1), 3);
    v_ayer NUMERIC;
    v_n INT;
    v_mes NUMERIC;
    v_meta NUMERIC;
    v_lineas TEXT[] := ARRAY[]::TEXT[];
    v_pend TEXT[] := ARRAY[]::TEXT[];
    r RECORD;
    v_cuenta INT;
    v_monto NUMERIC;
BEGIN
    -- Ventas (las notas de crédito restan)
    SELECT coalesce(sum(CASE WHEN tipo_comprobante = '07' THEN -monto_total ELSE monto_total END), 0), count(*) FILTER (WHERE tipo_comprobante <> '07')
      INTO v_ayer, v_n FROM public.comprobantes WHERE fecha_emision = v_hoy - 1 AND tipo_comprobante IN ('01', '03', '07');
    SELECT coalesce(sum(CASE WHEN tipo_comprobante = '07' THEN -monto_total ELSE monto_total END), 0)
      INTO v_mes FROM public.comprobantes WHERE fecha_emision >= date_trunc('month', v_hoy)::DATE AND fecha_emision < v_hoy AND tipo_comprobante IN ('01', '03', '07');
    SELECT monto INTO v_meta FROM public.metas_venta WHERE periodo = to_char(v_hoy, 'YYYY-MM');

    v_lineas := v_lineas || ('📋 AUREVIA · ' || to_char(v_hoy, 'DD/MM/YYYY'))
                         || ('💰 Ventas de ayer: S/ ' || to_char(v_ayer, 'FM999G999G990D00') || ' (' || v_n || ' comprobante(s))');
    IF v_meta IS NOT NULL THEN
        v_lineas := v_lineas || ('🎯 Meta del mes: S/ ' || to_char(v_mes, 'FM999G999G990D00') || ' de S/ ' || to_char(v_meta, 'FM999G999G990D00')
                                 || ' (' || round(v_mes * 100 / v_meta) || '%)');
    END IF;

    -- Vencimientos anotados
    FOR r IN SELECT fecha, descripcion FROM public.vencimientos WHERE NOT hecho AND fecha <= v_hoy + v_dias ORDER BY fecha LIMIT 8 LOOP
        v_pend := v_pend || ('📅 ' || CASE WHEN r.fecha < v_hoy THEN 'VENCIDO ' WHEN r.fecha = v_hoy THEN 'HOY ' ELSE '' END || to_char(r.fecha, 'DD/MM') || ' ' || r.descripcion);
    END LOOP;
    -- Detracciones por depositar
    FOR r IN SELECT comprobante_id, monto, fecha_vencimiento_bn FROM public.detracciones WHERE estado = 'PENDIENTE' AND fecha_vencimiento_bn <= v_hoy + v_dias ORDER BY fecha_vencimiento_bn LIMIT 5 LOOP
        v_pend := v_pend || ('🏦 Detracción ' || coalesce(r.comprobante_id, '') || ': S/ ' || to_char(r.monto, 'FM999G990D00') || ' vence ' || to_char(r.fecha_vencimiento_bn, 'DD/MM'));
    END LOOP;
    -- Lo pendiente del día
    SELECT count(*) INTO v_cuenta FROM public.comprobantes WHERE numero_sunat IS NULL AND estado_sunat = 'PENDIENTE';
    IF v_cuenta > 0 THEN v_pend := v_pend || ('🧾 ' || v_cuenta || ' comprobante(s) por emitir en SUNAT'); END IF;
    SELECT count(*) INTO v_cuenta FROM public.pedidos WHERE fecha_entrega = v_hoy AND estado NOT IN ('entregado', 'cancelado');
    IF v_cuenta > 0 THEN v_pend := v_pend || ('🚚 ' || v_cuenta || ' pedido(s) para entregar hoy'); END IF;
    SELECT count(*) INTO v_cuenta FROM public.solicitudes_tienda WHERE estado = 'NUEVA';
    IF v_cuenta > 0 THEN v_pend := v_pend || ('🛒 ' || v_cuenta || ' pedido(s) web sin atender'); END IF;
    SELECT count(*) INTO v_cuenta FROM public.cotizaciones WHERE estado = 'ENVIADA';
    IF v_cuenta > 0 THEN v_pend := v_pend || ('📝 ' || v_cuenta || ' cotización(es) esperando respuesta'); END IF;
    SELECT count(*), coalesce(sum(total - retencion), 0) INTO v_cuenta, v_monto FROM public.gastos WHERE medio_pago IS NULL;
    IF v_cuenta > 0 THEN v_pend := v_pend || ('💳 ' || v_cuenta || ' cuenta(s) por pagar: S/ ' || to_char(v_monto, 'FM999G999G990D00')); END IF;
    SELECT count(*) INTO v_cuenta FROM public.productos WHERE activo AND stock_actual <= stock_minimo;
    IF v_cuenta > 0 THEN v_pend := v_pend || ('🌱 ' || v_cuenta || ' producto(s) con stock bajo'); END IF;

    IF array_length(v_pend, 1) IS NULL THEN v_pend := ARRAY['✅ Nada pendiente para hoy']; END IF;
    RETURN array_to_string(v_lineas || ''::TEXT || v_pend, E'\n');
END;
$$;
REVOKE ALL ON FUNCTION public.resumen_diario_texto() FROM PUBLIC, anon, authenticated;

/** Lo llama el programador (pg_cron) cada mañana. */
CREATE OR REPLACE FUNCTION public.enviar_resumen_diario()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT coalesce((SELECT resumen_diario FROM public.notificaciones_config WHERE id = 1), FALSE) THEN RETURN FALSE; END IF;
    RETURN public.enviar_aviso_whatsapp(public.resumen_diario_texto());
END;
$$;
REVOKE ALL ON FUNCTION public.enviar_resumen_diario() FROM PUBLIC, anon, authenticated;

/** El dueño ve el resumen (y opcionalmente lo envía ahora para probar). */
CREATE OR REPLACE FUNCTION public.ver_resumen_diario(p_enviar BOOLEAN DEFAULT FALSE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_texto TEXT;
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño ve el resumen diario' USING ERRCODE = '42501'; END IF;
    v_texto := public.resumen_diario_texto();
    RETURN jsonb_build_object('texto', v_texto, 'enviado', CASE WHEN p_enviar THEN public.enviar_aviso_whatsapp(v_texto) ELSE FALSE END);
END;
$$;
REVOKE ALL ON FUNCTION public.ver_resumen_diario(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ver_resumen_diario(BOOLEAN) TO authenticated;

-- Todos los días a las 8:00 a. m. de Lima (13:00 UTC); si el resumen está apagado no envía nada
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('aurevia-resumen-diario', '0 13 * * *', 'SELECT public.enviar_resumen_diario()');
