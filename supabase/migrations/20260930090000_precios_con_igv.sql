-- ========================================================
-- Los precios de plantas e insumos vuelven a incluir IGV (evita confusión al cliente).
-- El total referencial del pedido web es la suma de precios; igv_referencial es el IGV contenido.
-- ========================================================

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
    ELSIF v_doc IS NOT NULL AND v_doc !~ '^[0-9]{8}$' AND v_doc !~ '^(10|15|17|20)[0-9]{9}$' THEN
        RAISE EXCEPTION 'Indica un DNI de 8 dígitos o un RUC de 11 dígitos';
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

    -- El precio del catálogo ya incluye IGV: se guarda el IGV contenido en el total
    v_igv := round(v_valor - v_valor / 1.18, 2);
    INSERT INTO public.solicitudes_tienda (tipo, nombre, telefono, email, distrito, mensaje, servicio_slug, items, total_referencial, igv_referencial,
                                           comprobante, doc_cliente, razon_social, entrega, direccion, requiere_asesor, costo_delivery)
    VALUES (v_tipo, v_nombre, v_tel, NULLIF(btrim(p->>'email'), ''), v_distrito,
            NULLIF(btrim(p->>'mensaje'), ''), CASE WHEN v_tipo = 'SERVICIO' THEN p->>'servicio' END, v_items, round(v_valor, 2), v_igv,
            v_comp, v_doc, left(v_razon, 150), v_entrega, left(v_dir, 250), v_asesor, v_delivery)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_solicitud(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud(JSONB) TO anon, authenticated;
