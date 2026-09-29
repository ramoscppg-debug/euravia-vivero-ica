-- ========================================================
-- SERVICIOS DE JARDINEROS: QUIÉN COBRA
-- - Cliente con recibo por honorarios: cobra el jardinero y la empresa NO cobra comisión (sólo se anota).
-- - Cliente con factura o boleta: la empresa cobra el servicio + 18% de IGV y el jardinero le emite
--   su recibo por honorarios por (servicio − comisión).
-- ========================================================

ALTER TABLE public.servicios_jardinero DROP CONSTRAINT IF EXISTS servicios_jardinero_modalidad_check;
ALTER TABLE public.servicios_jardinero ADD CONSTRAINT servicios_jardinero_modalidad_check CHECK (modalidad IN ('RXH_CLIENTE', 'FACTURA', 'BOLETA'));
ALTER TABLE public.servicios_jardinero DROP CONSTRAINT IF EXISTS servicios_jardinero_check1;
ALTER TABLE public.servicios_jardinero ADD CONSTRAINT servicios_jardinero_gasto_empresa CHECK (modalidad <> 'RXH_CLIENTE' OR gasto_id IS NULL);
ALTER TABLE public.servicios_jardinero DROP CONSTRAINT IF EXISTS servicios_jardinero_check2;
ALTER TABLE public.servicios_jardinero ADD CONSTRAINT servicios_jardinero_factura_ruc CHECK (modalidad <> 'FACTURA' OR cliente_doc ~ '^(10|15|17|20)[0-9]{9}$');
ALTER TABLE public.servicios_jardinero ADD CONSTRAINT servicios_jardinero_rxh_sin_comision CHECK (modalidad <> 'RXH_CLIENTE' OR comision = 0) NOT VALID;

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
    IF v_modalidad NOT IN ('RXH_CLIENTE', 'FACTURA', 'BOLETA') THEN RAISE EXCEPTION 'Elige recibo por honorarios, boleta o factura'; END IF;
    IF length(btrim(coalesce(p->>'descripcion', ''))) < 3 THEN RAISE EXCEPTION 'Describe el servicio'; END IF;
    IF length(btrim(coalesce(p->>'cliente_nombre', ''))) < 2 THEN RAISE EXCEPTION 'Indica el cliente'; END IF;
    IF v_modalidad = 'FACTURA' AND (v_doc IS NULL OR v_doc !~ '^(10|15|17|20)[0-9]{9}$') THEN RAISE EXCEPTION 'Para factura indica el RUC del cliente'; END IF;
    IF v_modalidad = 'BOLETA' AND v_doc IS NOT NULL AND v_doc !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Para boleta el DNI debe tener 8 dígitos'; END IF;
    IF v_modalidad <> 'RXH_CLIENTE' AND j.ruc IS NULL THEN RAISE EXCEPTION 'El jardinero necesita RUC para emitir su recibo por honorarios a la empresa'; END IF;

    -- Con recibo por honorarios cobra el jardinero: la empresa no cobra comisión
    IF v_modalidad = 'RXH_CLIENTE' THEN
        v_pct := 0;
    ELSE
        v_pct := coalesce(j.comision_pct, (SELECT comision_jardinero_pct FROM public.empresa_config LIMIT 1));
        IF v_pct IS NULL THEN RAISE EXCEPTION 'Configura el %% de comisión de los jardineros en Ajustes'; END IF;
    END IF;

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
