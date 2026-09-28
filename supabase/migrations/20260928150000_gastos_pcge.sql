-- ========================================================
-- GASTOS CON ASIENTO AUTOMÁTICO (PCGE 2026)
-- - Vale de caja chica con categoría:          6x  a  101 Caja
-- - Gasto con comprobante (luz, agua, alquiler, contador, fletes…):
--       provisión   6x (+ 40111 IGV si es factura)  a  4212
--       pago        4212  a  101 Caja / 1041 Cuenta corriente   (si ya se pagó)
-- Todo en una transacción; si se paga con efectivo de caja, también descuenta la caja del día.
-- ========================================================

ALTER TABLE public.asientos DROP CONSTRAINT IF EXISTS asientos_origen_check;
ALTER TABLE public.asientos ADD CONSTRAINT asientos_origen_check
    CHECK (origen IN ('KARDEX', 'VENTA', 'COMPRA', 'COBRO', 'MANUAL', 'GASTO', 'PAGO', 'CAJA'));

CREATE TABLE IF NOT EXISTS public.gastos (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    cuenta VARCHAR(10) NOT NULL REFERENCES public.plan_cuentas(codigo),   -- cuenta de gasto (Elemento 6)
    descripcion VARCHAR(200) NOT NULL,
    proveedor_ruc VARCHAR(11),
    proveedor VARCHAR(150),
    tipo_comprobante VARCHAR(2) NOT NULL DEFAULT '00' CHECK (tipo_comprobante IN ('00', '01', '02', '03', '12')), -- 02 recibo por honorarios, 12 ticket
    serie VARCHAR(4),
    numero VARCHAR(20),
    base NUMERIC(12,2) NOT NULL CHECK (base >= 0),
    igv NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (igv >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total > 0),
    medio_pago VARCHAR(20),          -- NULL = por pagar
    operacion VARCHAR(30),           -- N° de operación del pago
    registrado_por VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (round(base + igv, 2) = total),
    CHECK (igv = 0 OR tipo_comprobante = '01') -- sólo la factura da crédito fiscal
);
CREATE UNIQUE INDEX IF NOT EXISTS gastos_comprobante_uk ON public.gastos (proveedor_ruc, tipo_comprobante, serie, numero)
    WHERE proveedor_ruc IS NOT NULL AND numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS gastos_fecha_idx ON public.gastos (fecha DESC);
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_leer ON public.gastos FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));

-- El movimiento de caja de un gasto pagado en efectivo lo contabiliza el propio gasto (no se duplica)
ALTER TABLE public.caja_movimientos
    ADD COLUMN IF NOT EXISTS cuenta_gasto VARCHAR(10) REFERENCES public.plan_cuentas(codigo),
    ADD COLUMN IF NOT EXISTS gasto_id BIGINT REFERENCES public.gastos(id);

CREATE OR REPLACE FUNCTION public.contabilizar_gasto(g public.gastos)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_doc TEXT := concat_ws(' ', CASE g.tipo_comprobante WHEN '01' THEN 'Factura' WHEN '03' THEN 'Boleta' WHEN '02' THEN 'Recibo por honorarios' WHEN '12' THEN 'Ticket' ELSE NULL END,
                           NULLIF(concat_ws('-', g.serie, g.numero), ''));
BEGIN
    PERFORM crear_asiento(g.fecha, g.descripcion || coalesce(' · ' || g.proveedor, '') || coalesce(' (' || NULLIF(v_doc, '') || ')', ''), 'GASTO', g.id::TEXT,
        jsonb_build_array(linea_json(g.cuenta, g.base, 0), linea_json(cuenta_config('IGV'), g.igv, 0), linea_json(cuenta_config('CXP'), 0, g.total)),
        g.tipo_comprobante, g.serie, g.numero, g.registrado_por);
    IF g.medio_pago IS NOT NULL THEN
        PERFORM crear_asiento(g.fecha, 'Pago de ' || g.descripcion || ' · ' || g.medio_pago || coalesce(' op. ' || g.operacion, ''), 'PAGO', g.id::TEXT,
            jsonb_build_array(linea_json(cuenta_config('CXP'), g.total, 0),
                              linea_json(cuenta_config(CASE WHEN g.medio_pago = 'Efectivo' THEN 'CAJA' ELSE 'BANCOS' END), 0, g.total)),
            NULL, NULL, NULL, g.registrado_por);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gasto_a_diario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.contabilizar_gasto(NEW);
    RETURN NULL;
END;
$$;
CREATE TRIGGER gasto_contabilizar AFTER INSERT ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.gasto_a_diario();

/** Registra un gasto (y su salida de caja si se pagó en efectivo) en una sola transacción. */
CREATE OR REPLACE FUNCTION public.registrar_gasto(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total NUMERIC := round((p->>'total')::NUMERIC, 2);
    v_tipo TEXT := coalesce(NULLIF(p->>'tipo_comprobante', ''), '00');
    v_igv NUMERIC := CASE WHEN v_tipo = '01' THEN round(coalesce((p->>'igv')::NUMERIC, 0), 2) ELSE 0 END;
    v_cuenta TEXT := p->>'cuenta';
    v_medio TEXT := NULLIF(p->>'medio_pago', '');
    v_ruc TEXT := NULLIF(regexp_replace(coalesce(p->>'proveedor_ruc', ''), '\D', '', 'g'), '');
    v_id BIGINT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar gastos' USING ERRCODE = '42501'; END IF;
    IF v_total IS NULL OR v_total <= 0 THEN RAISE EXCEPTION 'Indica el importe del gasto'; END IF;
    IF v_igv < 0 OR v_igv >= v_total THEN RAISE EXCEPTION 'El IGV no es válido'; END IF;
    IF length(btrim(coalesce(p->>'descripcion', ''))) < 3 THEN RAISE EXCEPTION 'Describe el gasto'; END IF;
    IF v_cuenta !~ '^6' THEN RAISE EXCEPTION 'Elige una cuenta de gasto del Elemento 6'; END IF;
    PERFORM validar_cuenta_imputable(v_cuenta);
    IF v_tipo = '01' AND (v_ruc IS NULL OR v_ruc !~ '^(10|15|17|20)[0-9]{9}$') THEN RAISE EXCEPTION 'La factura necesita el RUC del proveedor'; END IF;
    IF v_medio IS NOT NULL AND v_medio NOT IN ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') THEN RAISE EXCEPTION 'Medio de pago inválido'; END IF;

    INSERT INTO public.gastos (fecha, cuenta, descripcion, proveedor_ruc, proveedor, tipo_comprobante, serie, numero, base, igv, total, medio_pago, operacion, registrado_por)
    VALUES (coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE), v_cuenta, left(btrim(p->>'descripcion'), 200), v_ruc,
            NULLIF(btrim(coalesce(p->>'proveedor', '')), ''), v_tipo, NULLIF(upper(btrim(coalesce(p->>'serie', ''))), ''), NULLIF(btrim(coalesce(p->>'numero', '')), ''),
            v_total - v_igv, v_igv, v_total, v_medio, NULLIF(btrim(coalesce(p->>'operacion', '')), ''), p->>'usuario')
    RETURNING id INTO v_id;

    IF v_medio = 'Efectivo' AND coalesce((p->>'desde_caja')::BOOLEAN, TRUE) THEN
        INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, responsable, gasto_id, cuenta_gasto)
        VALUES ('EGRESO', 'Efectivo', v_total, left(btrim(p->>'descripcion'), 200), coalesce(p->>'usuario', 'Caja'), v_id, v_cuenta);
    END IF;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_gasto(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_gasto(JSONB) TO authenticated;

-- Caja: vale de caja chica con categoría → 6x a 101; lo que viene de un gasto ya está contabilizado
CREATE OR REPLACE FUNCTION public.contabilizar_caja(m public.caja_movimientos)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_disp TEXT := cuenta_config(CASE WHEN m.medio_pago = 'Efectivo' OR m.medio_pago IS NULL THEN 'CAJA' ELSE 'BANCOS' END);
BEGIN
    IF m.gasto_id IS NOT NULL OR coalesce(m.monto, 0) <= 0 THEN RETURN NULL; END IF;
    IF m.comprobante_id IS NULL THEN
        IF m.tipo = 'EGRESO' AND m.cuenta_gasto IS NOT NULL THEN
            RETURN crear_asiento((m.fecha AT TIME ZONE 'America/Lima')::DATE, 'Caja chica: ' || coalesce(m.concepto, 'gasto'), 'CAJA', m.id::TEXT,
                jsonb_build_array(linea_json(m.cuenta_gasto, m.monto, 0), linea_json(v_disp, 0, m.monto)), '00', NULL, NULL, m.responsable);
        END IF;
        RETURN NULL;
    END IF;
    IF m.tipo NOT IN ('INGRESO', 'EGRESO') THEN RETURN NULL; END IF;
    RETURN crear_asiento((m.fecha AT TIME ZONE 'America/Lima')::DATE,
        CASE WHEN m.tipo = 'INGRESO' THEN 'Cobro ' ELSE 'Reembolso ' END || m.comprobante_id || ' · ' || coalesce(m.medio_pago, ''),
        'COBRO', m.id::TEXT,
        CASE WHEN m.tipo = 'INGRESO' THEN jsonb_build_array(linea_json(v_disp, m.monto, 0), linea_json(cuenta_config('CXC'), 0, m.monto))
             ELSE jsonb_build_array(linea_json(cuenta_config('CXC'), m.monto, 0), linea_json(v_disp, 0, m.monto)) END,
        NULL, NULL, NULL, m.responsable);
END;
$$;

-- Los vales de caja chica permiten indicar su cuenta (el vendedor los registra)
CREATE OR REPLACE FUNCTION public.validar_cuenta_gasto_caja()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.cuenta_gasto IS NOT NULL THEN
        IF NEW.cuenta_gasto !~ '^6' THEN RAISE EXCEPTION 'La cuenta del gasto debe ser del Elemento 6'; END IF;
        PERFORM validar_cuenta_imputable(NEW.cuenta_gasto);
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER caja_cuenta_gasto_valida BEFORE INSERT ON public.caja_movimientos FOR EACH ROW EXECUTE FUNCTION public.validar_cuenta_gasto_caja();
