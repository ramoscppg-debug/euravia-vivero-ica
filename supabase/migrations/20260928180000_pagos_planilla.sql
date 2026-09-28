-- ========================================================
-- PAGO POSTERIOR DE GASTOS, ASIENTO DE PLANILLA Y RECIBOS DE SERVICIOS PÚBLICOS
-- - Un gasto registrado "por pagar" se paga después: 4212 a 101/1041 (y sale de caja si es efectivo).
-- - Planilla del mes: remuneraciones y aportes (62) contra tributos y remuneraciones por pagar (40/41),
--   más provisiones de CTS, gratificaciones y vacaciones. Un solo asiento por periodo.
-- - Tipo 14 (recibo por servicios públicos: luz, agua, teléfono) da crédito fiscal y va al RCE.
-- ========================================================

ALTER TABLE public.asientos DROP CONSTRAINT IF EXISTS asientos_origen_check;
ALTER TABLE public.asientos ADD CONSTRAINT asientos_origen_check
    CHECK (origen IN ('KARDEX', 'VENTA', 'COMPRA', 'COBRO', 'MANUAL', 'GASTO', 'PAGO', 'CAJA', 'PLANILLA'));

ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_tipo_comprobante_check;
ALTER TABLE public.gastos ADD CONSTRAINT gastos_tipo_comprobante_check CHECK (tipo_comprobante IN ('00', '01', '02', '03', '12', '14'));
ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_check1;
ALTER TABLE public.gastos ADD CONSTRAINT gastos_igv_con_credito CHECK (igv = 0 OR tipo_comprobante IN ('01', '14'));
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS fecha_pago DATE;
UPDATE public.gastos SET fecha_pago = fecha WHERE medio_pago IS NOT NULL AND fecha_pago IS NULL;

-- registrar_gasto con tipo 14 (IGV permitido) y fecha de pago
CREATE OR REPLACE FUNCTION public.registrar_gasto(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total NUMERIC := round((p->>'total')::NUMERIC, 2);
    v_tipo TEXT := coalesce(NULLIF(p->>'tipo_comprobante', ''), '00');
    v_igv NUMERIC := CASE WHEN v_tipo IN ('01', '14') THEN round(coalesce((p->>'igv')::NUMERIC, 0), 2) ELSE 0 END;
    v_cuenta TEXT := p->>'cuenta';
    v_medio TEXT := NULLIF(p->>'medio_pago', '');
    v_ruc TEXT := NULLIF(regexp_replace(coalesce(p->>'proveedor_ruc', ''), '\D', '', 'g'), '');
    v_fecha DATE := coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE);
    v_id BIGINT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar gastos' USING ERRCODE = '42501'; END IF;
    IF v_total IS NULL OR v_total <= 0 THEN RAISE EXCEPTION 'Indica el importe del gasto'; END IF;
    IF v_igv < 0 OR v_igv >= v_total THEN RAISE EXCEPTION 'El IGV no es válido'; END IF;
    IF length(btrim(coalesce(p->>'descripcion', ''))) < 3 THEN RAISE EXCEPTION 'Describe el gasto'; END IF;
    IF v_cuenta !~ '^6' THEN RAISE EXCEPTION 'Elige una cuenta de gasto del Elemento 6'; END IF;
    PERFORM validar_cuenta_imputable(v_cuenta);
    IF v_tipo IN ('01', '14') AND (v_ruc IS NULL OR v_ruc !~ '^(10|15|17|20)[0-9]{9}$') THEN RAISE EXCEPTION 'El comprobante necesita el RUC del proveedor'; END IF;
    IF v_medio IS NOT NULL AND v_medio NOT IN ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') THEN RAISE EXCEPTION 'Medio de pago inválido'; END IF;

    INSERT INTO public.gastos (fecha, cuenta, descripcion, proveedor_ruc, proveedor, tipo_comprobante, serie, numero, base, igv, total, medio_pago, operacion, registrado_por, fecha_pago)
    VALUES (v_fecha, v_cuenta, left(btrim(p->>'descripcion'), 200), v_ruc,
            NULLIF(btrim(coalesce(p->>'proveedor', '')), ''), v_tipo, NULLIF(upper(btrim(coalesce(p->>'serie', ''))), ''), NULLIF(btrim(coalesce(p->>'numero', '')), ''),
            v_total - v_igv, v_igv, v_total, v_medio, NULLIF(btrim(coalesce(p->>'operacion', '')), ''), p->>'usuario', CASE WHEN v_medio IS NOT NULL THEN v_fecha END)
    RETURNING id INTO v_id;

    IF v_medio = 'Efectivo' THEN
        INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, responsable, gasto_id, cuenta_gasto)
        VALUES ('EGRESO', 'Efectivo', v_total, left(btrim(p->>'descripcion'), 200), coalesce(p->>'usuario', 'Caja'), v_id, v_cuenta);
    END IF;
    RETURN v_id;
END;
$$;

/** Paga un gasto que quedó "por pagar": asiento 4212 a caja o bancos y salida de caja si es en efectivo. */
CREATE OR REPLACE FUNCTION public.pagar_gasto(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    g public.gastos;
    v_medio TEXT := p->>'medio_pago';
    v_fecha DATE := coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE);
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede pagar gastos' USING ERRCODE = '42501'; END IF;
    IF v_medio IS NULL OR v_medio NOT IN ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') THEN RAISE EXCEPTION 'Elige el medio de pago'; END IF;
    SELECT * INTO g FROM public.gastos WHERE id = (p->>'id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;
    IF g.medio_pago IS NOT NULL THEN RAISE EXCEPTION 'Este gasto ya está pagado'; END IF;
    IF v_fecha < g.fecha THEN RAISE EXCEPTION 'La fecha de pago no puede ser anterior al gasto'; END IF;

    UPDATE public.gastos SET medio_pago = v_medio, operacion = NULLIF(btrim(coalesce(p->>'operacion', '')), ''), fecha_pago = v_fecha WHERE id = g.id;
    PERFORM crear_asiento(v_fecha, 'Pago de ' || g.descripcion || ' · ' || v_medio || coalesce(' op. ' || NULLIF(btrim(coalesce(p->>'operacion', '')), ''), ''), 'PAGO', g.id::TEXT,
        jsonb_build_array(linea_json(cuenta_config('CXP'), g.total, 0),
                          linea_json(cuenta_config(CASE WHEN v_medio = 'Efectivo' THEN 'CAJA' ELSE 'BANCOS' END), 0, g.total)),
        NULL, NULL, NULL, p->>'usuario');
    IF v_medio = 'Efectivo' THEN
        INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, responsable, gasto_id, cuenta_gasto)
        VALUES ('EGRESO', 'Efectivo', g.total, 'Pago: ' || g.descripcion, coalesce(p->>'usuario', 'Caja'), g.id, g.cuenta);
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pagar_gasto(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_gasto(JSONB) TO authenticated;

/**
  Asiento de planilla del periodo (lo calcula la app con la planilla vigente; la base valida cuadre y cuentas).
  Un solo asiento por periodo: para corregirlo se usa un asiento manual.
*/
CREATE OR REPLACE FUNCTION public.contabilizar_planilla(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_periodo TEXT := p->>'periodo';
    v_id BIGINT;
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño contabiliza la planilla' USING ERRCODE = '42501'; END IF;
    IF v_periodo !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Periodo inválido'; END IF;
    IF EXISTS (SELECT 1 FROM public.asientos WHERE origen = 'PLANILLA' AND origen_id = v_periodo) THEN
        RAISE EXCEPTION 'La planilla de % ya está contabilizada', v_periodo;
    END IF;
    v_id := crear_asiento((date_trunc('month', (v_periodo || '-01')::DATE) + interval '1 month - 1 day')::DATE,
                          'Planilla de remuneraciones ' || v_periodo, 'PLANILLA', v_periodo, p->'lineas', '00', NULL, NULL, p->>'usuario');
    IF v_id IS NULL THEN RAISE EXCEPTION 'La planilla no tiene importes'; END IF;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.contabilizar_planilla(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contabilizar_planilla(JSONB) TO authenticated;
