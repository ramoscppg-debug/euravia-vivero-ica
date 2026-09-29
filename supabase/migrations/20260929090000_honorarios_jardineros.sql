-- ========================================================
-- SERVICIOS DE JARDINEROS CON RECIBO POR HONORARIOS Y PRECIOS SIN IGV
-- - El jardinero cobra el servicio con su recibo por honorarios (RxH) al cliente;
--   la empresa le cobra una comisión (% configurable) con su boleta/factura (+ IGV).
-- - Si el cliente pide factura, la empresa factura el servicio (+ IGV) y el jardinero
--   le emite su RxH a la empresa por su parte (servicio − comisión):
--       provisión   633 Producción encargada a terceros  a  424 Honorarios por pagar
--                                                        y  40172 Renta de 4ta (retención 8% si el RxH supera S/ 1 500)
--       pago        424  a  101 Caja / 1041 Cuenta corriente
-- - Los precios del catálogo son valor de venta sin IGV: la tienda suma el 18% al total.
-- ========================================================

-- ---------- Cuentas ----------
INSERT INTO public.config_contable VALUES
    ('HONORARIOS', '633',   'Servicios de jardineros con recibo por honorarios'),
    ('CXP_HONOR',  '424',   'Honorarios por pagar a jardineros'),
    ('RET_4TA',    '40172', 'Retención de renta de cuarta categoría')
ON CONFLICT (clave) DO NOTHING;

-- ---------- Comisión por defecto (la fija el dueño; sin valor no se registran servicios) ----------
ALTER TABLE public.empresa_config
    ADD COLUMN IF NOT EXISTS comision_jardinero_pct NUMERIC(5,2) CHECK (comision_jardinero_pct IS NULL OR comision_jardinero_pct BETWEEN 0 AND 100);

-- ---------- Retención de 4ta categoría en los gastos (sólo recibos por honorarios) ----------
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS retencion NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.gastos ADD CONSTRAINT gastos_retencion_valida CHECK (retencion >= 0 AND retencion < total AND (retencion = 0 OR tipo_comprobante = '02'));

CREATE OR REPLACE FUNCTION public.contabilizar_gasto(g public.gastos)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_doc TEXT := concat_ws(' ', CASE g.tipo_comprobante WHEN '01' THEN 'Factura' WHEN '03' THEN 'Boleta' WHEN '02' THEN 'Recibo por honorarios' WHEN '12' THEN 'Ticket' WHEN '14' THEN 'Recibo' ELSE NULL END,
                           NULLIF(concat_ws('-', g.serie, g.numero), ''));
    v_rxh BOOLEAN := g.tipo_comprobante = '02';
    v_cxp TEXT := cuenta_config(CASE WHEN g.tipo_comprobante = '02' THEN 'CXP_HONOR' ELSE 'CXP' END);
    v_neto NUMERIC := g.total - g.retencion;
BEGIN
    PERFORM crear_asiento(g.fecha, g.descripcion || coalesce(' · ' || g.proveedor, '') || coalesce(' (' || NULLIF(v_doc, '') || ')', ''), 'GASTO', g.id::TEXT,
        CASE WHEN v_rxh
             THEN jsonb_build_array(linea_json(g.cuenta, g.total, 0), linea_json(cuenta_config('RET_4TA'), 0, g.retencion), linea_json(v_cxp, 0, v_neto))
             ELSE jsonb_build_array(linea_json(g.cuenta, g.base, 0), linea_json(cuenta_config('IGV'), g.igv, 0), linea_json(v_cxp, 0, g.total)) END,
        g.tipo_comprobante, g.serie, g.numero, g.registrado_por);
    IF g.medio_pago IS NOT NULL THEN
        PERFORM crear_asiento(coalesce(g.fecha_pago, g.fecha), 'Pago de ' || g.descripcion || ' · ' || g.medio_pago || coalesce(' op. ' || g.operacion, ''), 'PAGO', g.id::TEXT,
            jsonb_build_array(linea_json(v_cxp, v_neto, 0),
                              linea_json(cuenta_config(CASE WHEN g.medio_pago = 'Efectivo' THEN 'CAJA' ELSE 'BANCOS' END), 0, v_neto)),
            NULL, NULL, NULL, g.registrado_por);
    END IF;
END;
$$;

/** Paga un gasto "por pagar": 4212 (o 424 si es recibo por honorarios, neto de la retención) a caja o bancos. */
CREATE OR REPLACE FUNCTION public.pagar_gasto(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    g public.gastos;
    v_medio TEXT := p->>'medio_pago';
    v_fecha DATE := coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE);
    v_neto NUMERIC;
    v_cxp TEXT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede pagar gastos' USING ERRCODE = '42501'; END IF;
    IF v_medio IS NULL OR v_medio NOT IN ('Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia') THEN RAISE EXCEPTION 'Elige el medio de pago'; END IF;
    SELECT * INTO g FROM public.gastos WHERE id = (p->>'id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;
    IF g.medio_pago IS NOT NULL THEN RAISE EXCEPTION 'Este gasto ya está pagado'; END IF;
    IF v_fecha < g.fecha THEN RAISE EXCEPTION 'La fecha de pago no puede ser anterior al gasto'; END IF;
    v_neto := g.total - g.retencion;
    v_cxp := cuenta_config(CASE WHEN g.tipo_comprobante = '02' THEN 'CXP_HONOR' ELSE 'CXP' END);

    UPDATE public.gastos SET medio_pago = v_medio, operacion = NULLIF(btrim(coalesce(p->>'operacion', '')), ''), fecha_pago = v_fecha WHERE id = g.id;
    PERFORM crear_asiento(v_fecha, 'Pago de ' || g.descripcion || ' · ' || v_medio || coalesce(' op. ' || NULLIF(btrim(coalesce(p->>'operacion', '')), ''), ''), 'PAGO', g.id::TEXT,
        jsonb_build_array(linea_json(v_cxp, v_neto, 0),
                          linea_json(cuenta_config(CASE WHEN v_medio = 'Efectivo' THEN 'CAJA' ELSE 'BANCOS' END), 0, v_neto)),
        NULL, NULL, NULL, p->>'usuario');
    IF v_medio = 'Efectivo' THEN
        INSERT INTO public.caja_movimientos (tipo, medio_pago, monto, concepto, responsable, gasto_id, cuenta_gasto)
        VALUES ('EGRESO', 'Efectivo', v_neto, 'Pago: ' || g.descripcion, coalesce(p->>'usuario', 'Caja'), g.id, g.cuenta);
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pagar_gasto(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_gasto(JSONB) TO authenticated;

-- ---------- Jardineros ----------
CREATE TABLE IF NOT EXISTS public.jardineros (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    ruc VARCHAR(11) CHECK (ruc IS NULL OR ruc ~ '^(10|15|17)[0-9]{9}$'),
    dni VARCHAR(8) CHECK (dni IS NULL OR dni ~ '^[0-9]{8}$'),
    telefono VARCHAR(20),
    comision_pct NUMERIC(5,2) CHECK (comision_pct IS NULL OR comision_pct BETWEEN 0 AND 100), -- NULL = la de la empresa
    suspension_4ta BOOLEAN NOT NULL DEFAULT FALSE, -- constancia de suspensión de retenciones de 4ta
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jardineros_ruc_uk ON public.jardineros (ruc) WHERE ruc IS NOT NULL;
ALTER TABLE public.jardineros ENABLE ROW LEVEL SECURITY;
CREATE POLICY jardineros_leer ON public.jardineros FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY jardineros_editar ON public.jardineros FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- ---------- Servicios realizados por jardineros ----------
CREATE TABLE IF NOT EXISTS public.servicios_jardinero (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    jardinero_id BIGINT NOT NULL REFERENCES public.jardineros(id),
    descripcion VARCHAR(200) NOT NULL,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_doc VARCHAR(11),
    valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),                  -- precio acordado del servicio, sin IGV
    modalidad VARCHAR(12) NOT NULL CHECK (modalidad IN ('RXH_CLIENTE', 'FACTURA')),
    comision_pct NUMERIC(5,2) NOT NULL CHECK (comision_pct BETWEEN 0 AND 100),
    comision NUMERIC(12,2) NOT NULL CHECK (comision >= 0 AND comision <= valor),
    rxh_serie VARCHAR(4),
    rxh_numero VARCHAR(20),
    comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),   -- factura al cliente o comprobante de la comisión
    gasto_id BIGINT REFERENCES public.gastos(id),                    -- RxH del jardinero a la empresa (modalidad FACTURA)
    registrado_por VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (modalidad = 'FACTURA' OR gasto_id IS NULL),
    CHECK (modalidad = 'RXH_CLIENTE' OR cliente_doc ~ '^(10|15|17|20)[0-9]{9}$')
);
CREATE INDEX IF NOT EXISTS servicios_jardinero_fecha_idx ON public.servicios_jardinero (fecha DESC);
ALTER TABLE public.servicios_jardinero ENABLE ROW LEVEL SECURITY;
CREATE POLICY servicios_jardinero_leer ON public.servicios_jardinero FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));

/** Registra un servicio: fija el % de comisión (del jardinero o el de la empresa) y la comisión sobre el valor sin IGV. */
CREATE OR REPLACE FUNCTION public.registrar_servicio_jardinero(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    j public.jardineros;
    v_valor NUMERIC := round((p->>'valor')::NUMERIC, 2);
    v_modalidad TEXT := upper(coalesce(p->>'modalidad', ''));
    v_doc TEXT := NULLIF(regexp_replace(coalesce(p->>'cliente_doc', ''), '\D', '', 'g'), '');
    v_pct NUMERIC;
    v_id BIGINT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar servicios' USING ERRCODE = '42501'; END IF;
    SELECT * INTO j FROM public.jardineros WHERE id = (p->>'jardinero_id')::BIGINT AND activo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Elige un jardinero activo'; END IF;
    IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'Indica el precio del servicio (sin IGV)'; END IF;
    IF v_modalidad NOT IN ('RXH_CLIENTE', 'FACTURA') THEN RAISE EXCEPTION 'Elige si el cliente recibe recibo por honorarios o factura'; END IF;
    IF length(btrim(coalesce(p->>'descripcion', ''))) < 3 THEN RAISE EXCEPTION 'Describe el servicio'; END IF;
    IF length(btrim(coalesce(p->>'cliente_nombre', ''))) < 2 THEN RAISE EXCEPTION 'Indica el cliente'; END IF;
    IF v_modalidad = 'FACTURA' AND (v_doc IS NULL OR v_doc !~ '^(10|15|17|20)[0-9]{9}$') THEN RAISE EXCEPTION 'Para factura indica el RUC del cliente'; END IF;
    IF v_modalidad = 'FACTURA' AND j.ruc IS NULL THEN RAISE EXCEPTION 'El jardinero necesita RUC para emitir su recibo por honorarios a la empresa'; END IF;
    v_pct := coalesce(j.comision_pct, (SELECT comision_jardinero_pct FROM public.empresa_config LIMIT 1));
    IF v_pct IS NULL THEN RAISE EXCEPTION 'Configura el %% de comisión de los jardineros en Ajustes'; END IF;

    INSERT INTO public.servicios_jardinero (fecha, jardinero_id, descripcion, cliente_nombre, cliente_doc, valor, modalidad, comision_pct, comision,
                                            rxh_serie, rxh_numero, registrado_por)
    VALUES (coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE), j.id, left(btrim(p->>'descripcion'), 200), left(btrim(p->>'cliente_nombre'), 150),
            v_doc, v_valor, v_modalidad, v_pct, round(v_valor * v_pct / 100, 2),
            CASE WHEN v_modalidad = 'RXH_CLIENTE' THEN NULLIF(upper(btrim(coalesce(p->>'rxh_serie', ''))), '') END,
            CASE WHEN v_modalidad = 'RXH_CLIENTE' THEN NULLIF(btrim(coalesce(p->>'rxh_numero', '')), '') END,
            p->>'usuario')
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_servicio_jardinero(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_servicio_jardinero(JSONB) TO authenticated;

/** Enlaza el comprobante emitido (factura del servicio o comprobante de la comisión). */
CREATE OR REPLACE FUNCTION public.vincular_comprobante_servicio(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede modificar servicios' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.comprobantes WHERE id = p->>'comprobante_id') THEN RAISE EXCEPTION 'Comprobante no encontrado'; END IF;
    UPDATE public.servicios_jardinero SET comprobante_id = p->>'comprobante_id' WHERE id = (p->>'id')::BIGINT AND comprobante_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'El servicio no existe o ya tiene comprobante'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.vincular_comprobante_servicio(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_comprobante_servicio(JSONB) TO authenticated;

/**
  Recibo por honorarios del jardinero.
  - RXH_CLIENTE: sólo se anota el número del recibo que emitió al cliente.
  - FACTURA: el recibo va a la empresa por (servicio − comisión); queda como gasto por pagar con la retención de 4ta.
*/
CREATE OR REPLACE FUNCTION public.registrar_rxh_jardinero(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    s public.servicios_jardinero;
    j public.jardineros;
    v_serie TEXT := NULLIF(upper(btrim(coalesce(p->>'serie', ''))), '');
    v_numero TEXT := NULLIF(btrim(coalesce(p->>'numero', '')), '');
    v_fecha DATE := coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE);
    v_monto NUMERIC;
    v_ret NUMERIC;
    v_gasto BIGINT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar recibos' USING ERRCODE = '42501'; END IF;
    IF v_serie IS NULL OR v_numero IS NULL THEN RAISE EXCEPTION 'Indica la serie y el número del recibo por honorarios'; END IF;
    SELECT * INTO s FROM public.servicios_jardinero WHERE id = (p->>'id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Servicio no encontrado'; END IF;
    IF s.rxh_numero IS NOT NULL THEN RAISE EXCEPTION 'Este servicio ya tiene su recibo por honorarios'; END IF;
    SELECT * INTO j FROM public.jardineros WHERE id = s.jardinero_id;

    IF s.modalidad = 'RXH_CLIENTE' THEN
        UPDATE public.servicios_jardinero SET rxh_serie = v_serie, rxh_numero = v_numero WHERE id = s.id;
        RETURN NULL;
    END IF;

    IF j.ruc IS NULL THEN RAISE EXCEPTION 'El jardinero necesita RUC'; END IF;
    IF v_fecha < s.fecha THEN RAISE EXCEPTION 'El recibo no puede ser anterior al servicio'; END IF;
    v_monto := s.valor - s.comision;
    IF v_monto <= 0 THEN RAISE EXCEPTION 'Con esa comisión no queda honorario por pagar'; END IF;
    -- Retención del 8% cuando el recibo supera S/ 1 500, salvo constancia de suspensión
    v_ret := CASE WHEN v_monto > 1500 AND NOT j.suspension_4ta THEN round(v_monto * 0.08, 2) ELSE 0 END;

    INSERT INTO public.gastos (fecha, cuenta, descripcion, proveedor_ruc, proveedor, tipo_comprobante, serie, numero, base, igv, total, retencion, registrado_por)
    VALUES (v_fecha, cuenta_config('HONORARIOS'), left('Honorarios: ' || s.descripcion, 200), j.ruc, j.nombre, '02', v_serie, v_numero,
            v_monto, 0, v_monto, v_ret, p->>'usuario')
    RETURNING id INTO v_gasto;
    UPDATE public.servicios_jardinero SET rxh_serie = v_serie, rxh_numero = v_numero, gasto_id = v_gasto WHERE id = s.id;
    RETURN v_gasto;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_rxh_jardinero(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_rxh_jardinero(JSONB) TO authenticated;

-- ---------- Tienda: precios sin IGV y recibo por honorarios en servicios ----------
ALTER TABLE public.solicitudes_tienda DROP CONSTRAINT IF EXISTS solicitudes_tienda_comprobante_check;
ALTER TABLE public.solicitudes_tienda ADD CONSTRAINT solicitudes_tienda_comprobante_check CHECK (comprobante IN ('BOLETA', 'FACTURA', 'RXH'));
ALTER TABLE public.solicitudes_tienda ADD COLUMN IF NOT EXISTS igv_referencial NUMERIC(12,2);

CREATE OR REPLACE FUNCTION public.crear_solicitud(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tipo TEXT := upper(coalesce(p->>'tipo', 'CONSULTA'));
    v_nombre TEXT := btrim(coalesce(p->>'nombre', ''));
    v_tel TEXT := regexp_replace(coalesce(p->>'telefono', ''), '[^0-9+]', '', 'g');
    v_comp TEXT := upper(coalesce(NULLIF(p->>'comprobante', ''), 'BOLETA'));
    v_doc TEXT := NULLIF(regexp_replace(coalesce(p->>'doc', ''), '[^0-9]', '', 'g'), '');
    v_razon TEXT := NULLIF(btrim(coalesce(p->>'razon_social', '')), '');
    v_entrega TEXT := upper(coalesce(NULLIF(p->>'entrega', ''), 'RECOJO'));
    v_dir TEXT := NULLIF(btrim(coalesce(p->>'direccion', '')), '');
    v_distrito TEXT := left(NULLIF(btrim(coalesce(p->>'distrito', '')), ''), 80);
    v_delivery NUMERIC;
    v_items JSONB := '[]';
    v_valor NUMERIC := 0;
    v_igv NUMERIC;
    v_asesor BOOLEAN := FALSE;
    it JSONB;
    prod RECORD;
    v_qty INT;
    v_id BIGINT;
BEGIN
    IF v_tipo NOT IN ('PEDIDO', 'SERVICIO', 'CONSULTA') THEN RAISE EXCEPTION 'Tipo de solicitud inválido'; END IF;
    IF length(v_nombre) < 2 OR length(v_nombre) > 120 THEN RAISE EXCEPTION 'Indica tu nombre'; END IF;
    IF v_tel !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'Indica un teléfono o WhatsApp válido'; END IF;
    IF length(coalesce(p->>'mensaje', '')) > 1000 THEN RAISE EXCEPTION 'El mensaje es demasiado largo'; END IF;
    IF v_comp NOT IN ('BOLETA', 'FACTURA', 'RXH') THEN RAISE EXCEPTION 'Elige el comprobante'; END IF;
    IF v_comp = 'RXH' AND v_tipo <> 'SERVICIO' THEN RAISE EXCEPTION 'El recibo por honorarios sólo aplica a servicios'; END IF;
    IF v_comp = 'FACTURA' THEN
        IF v_doc IS NULL OR v_doc !~ '^(10|15|17|20)[0-9]{9}$' THEN RAISE EXCEPTION 'Para factura indica un RUC válido de 11 dígitos'; END IF;
        IF v_razon IS NULL OR length(v_razon) < 3 THEN RAISE EXCEPTION 'Para factura indica la razón social'; END IF;
    ELSIF v_doc IS NOT NULL AND v_doc !~ '^[0-9]{8}$' THEN
        RAISE EXCEPTION 'El DNI debe tener 8 dígitos';
    END IF;
    IF v_entrega NOT IN ('RECOJO', 'DELIVERY') THEN RAISE EXCEPTION 'Elige recojo o delivery'; END IF;
    IF v_entrega = 'DELIVERY' AND (v_dir IS NULL OR length(v_dir) < 5) THEN RAISE EXCEPTION 'Indica la dirección de entrega'; END IF;
    IF (SELECT count(*) FROM public.solicitudes_tienda WHERE telefono = v_tel AND created_at > now() - interval '1 hour') >= 5 THEN
        RAISE EXCEPTION 'Recibimos varias solicitudes de este número; te contactaremos pronto';
    END IF;

    IF v_tipo = 'SERVICIO' AND NOT EXISTS (SELECT 1 FROM public.servicios_publicos WHERE slug = p->>'servicio' AND visible) THEN
        RAISE EXCEPTION 'Servicio no disponible';
    END IF;

    IF jsonb_typeof(p->'items') = 'array' THEN
        IF jsonb_array_length(p->'items') > 30 THEN RAISE EXCEPTION 'Demasiados productos en una solicitud'; END IF;
        FOR it IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
            v_qty := (it->>'cantidad')::INT;
            IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
            SELECT sku, nombre, precio_venta, stock_actual INTO prod FROM public.productos WHERE sku = it->>'sku' AND activo AND visible_tienda;
            IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible: %', it->>'sku'; END IF;
            IF v_qty > GREATEST(prod.stock_actual, 0) THEN v_asesor := TRUE; END IF;
            v_items := v_items || jsonb_build_object('sku', prod.sku, 'nombre', prod.nombre, 'cantidad', v_qty, 'precio', prod.precio_venta,
                                                     'stock', GREATEST(prod.stock_actual, 0));
            v_valor := v_valor + v_qty * prod.precio_venta;
        END LOOP;
    END IF;
    IF v_tipo = 'PEDIDO' AND jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Tu pedido no tiene productos'; END IF;

    IF v_tipo = 'PEDIDO' AND v_entrega = 'DELIVERY' AND v_distrito IS NOT NULL THEN
        SELECT costo INTO v_delivery FROM public.tarifas_delivery WHERE activo AND lower(distrito) = lower(v_distrito);
    END IF;

    -- El precio del catálogo es valor de venta: la boleta o factura suma el IGV (la tarifa de delivery es precio final)
    v_igv := round(v_valor * 0.18, 2);
    INSERT INTO public.solicitudes_tienda (tipo, nombre, telefono, email, distrito, mensaje, servicio_slug, items, total_referencial, igv_referencial,
                                           comprobante, doc_cliente, razon_social, entrega, direccion, requiere_asesor, costo_delivery)
    VALUES (v_tipo, v_nombre, v_tel, NULLIF(btrim(p->>'email'), ''), v_distrito,
            NULLIF(btrim(p->>'mensaje'), ''), CASE WHEN v_tipo = 'SERVICIO' THEN p->>'servicio' END, v_items, round(v_valor, 2) + v_igv, v_igv,
            v_comp, v_doc, left(v_razon, 150), v_entrega, left(v_dir, 250), v_asesor, v_delivery)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_solicitud(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud(JSONB) TO anon, authenticated;
