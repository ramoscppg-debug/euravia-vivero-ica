-- ========================================================
-- EMISIÓN EXTERNA DE COMPROBANTES (hasta conectar la API de SUNAT o un proveedor OSE/PSE)
-- El sistema registra la venta y prepara un MODELO con los datos; el comprobante legal se emite
-- en el portal SOL u otra plataforma y aquí se anota el número que dio SUNAT.
-- La numeración sigue a la serie y al último número usado que el dueño configura.
-- ========================================================
ALTER TABLE public.empresa_config
    ADD COLUMN IF NOT EXISTS modo_emision VARCHAR(8) NOT NULL DEFAULT 'EXTERNA' CHECK (modo_emision IN ('EXTERNA', 'DIRECTA')),
    ADD COLUMN IF NOT EXISTS ultimos_numeros JSONB NOT NULL DEFAULT '{}', -- {"B001": 245, "F001": 18, "T001": 3}
    ADD COLUMN IF NOT EXISTS serie_nc_boleta VARCHAR(4),
    ADD COLUMN IF NOT EXISTS serie_nc_factura VARCHAR(4);

ALTER TABLE public.comprobantes
    ADD COLUMN IF NOT EXISTS numero_sunat VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emitido_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS enviado_cliente_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS comprobantes_numero_sunat_uk ON public.comprobantes (numero_sunat) WHERE numero_sunat IS NOT NULL;

/** Anota el número con el que se emitió en SUNAT y deja la serie al día (ventas o dueño). */
CREATE OR REPLACE FUNCTION public.registrar_emision_externa(p_id TEXT, p_numero TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_num TEXT := upper(btrim(p_numero));
    v_serie TEXT := split_part(v_num, '-', 1);
    v_corr INT;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar comprobantes' USING ERRCODE = '42501'; END IF;
    IF v_num !~ '^[A-Z0-9]{4}-[0-9]{1,8}$' THEN RAISE EXCEPTION 'El número debe tener el formato SERIE-NÚMERO, ej. B001-245'; END IF;
    v_corr := split_part(v_num, '-', 2)::INT;
    UPDATE public.comprobantes
       SET numero_sunat = v_num, estado_sunat = 'ACEPTADO', emitido_at = now(),
           descripcion_respuesta = 'Emitido fuera del sistema con el N° ' || v_num
     WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Comprobante % no encontrado', p_id; END IF;
    UPDATE public.empresa_config
       SET ultimos_numeros = jsonb_set(ultimos_numeros, ARRAY[v_serie], to_jsonb(GREATEST(coalesce((ultimos_numeros->>v_serie)::INT, 0), v_corr)));
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_emision_externa(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_emision_externa(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_comprobante_enviado(p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede actualizar comprobantes' USING ERRCODE = '42501'; END IF;
    UPDATE public.comprobantes SET enviado_cliente_at = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.marcar_comprobante_enviado(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_comprobante_enviado(TEXT) TO authenticated;

/** Igual para la guía de remisión (el documento vive en el JSON "datos"). */
CREATE OR REPLACE FUNCTION public.registrar_guia_externa(p_id TEXT, p_numero TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_num TEXT := upper(btrim(p_numero));
    v_serie TEXT := split_part(v_num, '-', 1);
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN RAISE EXCEPTION 'Tu rol no puede registrar guías' USING ERRCODE = '42501'; END IF;
    IF v_num !~ '^[A-Z0-9]{4}-[0-9]{1,8}$' THEN RAISE EXCEPTION 'El número debe tener el formato SERIE-NÚMERO, ej. T001-12'; END IF;
    UPDATE public.guias_remision
       SET datos = datos || jsonb_build_object('numeroSunat', v_num, 'estadoSunat', 'ACEPTADO')
     WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Guía % no encontrada', p_id; END IF;
    UPDATE public.empresa_config
       SET ultimos_numeros = jsonb_set(ultimos_numeros, ARRAY[v_serie], to_jsonb(GREATEST(coalesce((ultimos_numeros->>v_serie)::INT, 0), split_part(v_num, '-', 2)::INT)));
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_guia_externa(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_guia_externa(TEXT, TEXT) TO authenticated;
