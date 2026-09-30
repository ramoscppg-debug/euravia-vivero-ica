-- ========================================================
-- OFERTAS, PRODUCTOS NUEVOS Y EVENTOS CON PROMOCIÓN
-- - Oferta por producto: precio de oferta (IGV incluido) con fecha de fin opcional.
-- - Eventos (Día de la Madre, Navidad…): fechas, banner y % de descuento para productos o categorías.
-- - Precio vigente = el menor entre el de lista, la oferta y el de un evento activo.
--   Lo usan la tienda, el pedido web y el panel (misma regla en TypeScript).
-- - La tienda muestra primero las ofertas y luego lo nuevo (subido en los últimos 30 días).
-- ========================================================

ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS precio_oferta NUMERIC(10,2) CHECK (precio_oferta IS NULL OR precio_oferta > 0),
    ADD COLUMN IF NOT EXISTS oferta_hasta DATE;

CREATE TABLE IF NOT EXISTS public.eventos_promocion (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(300),
    imagen_url TEXT,
    desde DATE NOT NULL,
    hasta DATE NOT NULL,
    descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 90),
    categorias TEXT[] NOT NULL DEFAULT '{}',   -- vacío y sin productos = todo el catálogo
    skus TEXT[] NOT NULL DEFAULT '{}',
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (hasta >= desde)
);
ALTER TABLE public.eventos_promocion ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_ver ON public.eventos_promocion FOR SELECT TO anon, authenticated USING (visible OR public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY eventos_dueno ON public.eventos_promocion FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

/** Precio que se cobra hoy (IGV incluido): el menor entre lista, oferta vigente y evento activo. */
CREATE OR REPLACE FUNCTION public.precio_vigente(p_sku TEXT) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT LEAST(
        p.precio_venta,
        CASE WHEN p.precio_oferta IS NOT NULL AND (p.oferta_hasta IS NULL OR p.oferta_hasta >= (now() AT TIME ZONE 'America/Lima')::DATE) THEN p.precio_oferta END,
        (SELECT min(round(p.precio_venta * (1 - e.descuento_pct / 100), 2))
           FROM public.eventos_promocion e
          WHERE e.visible AND e.descuento_pct > 0 AND (now() AT TIME ZONE 'America/Lima')::DATE BETWEEN e.desde AND e.hasta
            AND (p.sku = ANY (e.skus) OR p.categoria = ANY (e.categorias) OR (cardinality(e.skus) = 0 AND cardinality(e.categorias) = 0))))
    FROM public.productos p WHERE p.sku = p_sku;
$$;
GRANT EXECUTE ON FUNCTION public.precio_vigente(TEXT) TO anon, authenticated;

/** Eventos activos de un producto (para mostrar la etiqueta en la tienda). */
CREATE OR REPLACE FUNCTION public.eventos_de(p_sku TEXT, p_categoria TEXT) RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(array_agg(e.id::TEXT ORDER BY e.desde), '{}')
      FROM public.eventos_promocion e
     WHERE e.visible AND (now() AT TIME ZONE 'America/Lima')::DATE BETWEEN e.desde AND e.hasta
       AND (p_sku = ANY (e.skus) OR p_categoria = ANY (e.categorias) OR (cardinality(e.skus) = 0 AND cardinality(e.categorias) = 0));
$$;

DROP FUNCTION IF EXISTS public.catalogo_publico();
CREATE FUNCTION public.catalogo_publico()
RETURNS TABLE (
    sku VARCHAR, nombre VARCHAR, nombre_cientifico VARCHAR, categoria VARCHAR, categoria_nombre VARCHAR,
    familia_botanica VARCHAR, descripcion TEXT, imagen_url TEXT, precio NUMERIC, disponibilidad TEXT, stock INT,
    cuidado_luz VARCHAR, cuidado_riego VARCHAR, es_planta_viva BOOLEAN, destacado BOOLEAN,
    precio_regular NUMERIC, es_nuevo BOOLEAN, eventos TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.sku, p.nombre, p.nombre_cientifico, p.categoria, p.categoria_nombre, p.familia_botanica,
           p.descripcion, p.imagen_url, public.precio_vigente(p.sku),
           CASE WHEN p.stock_actual <= 0 THEN 'AGOTADO'
                WHEN p.stock_actual <= p.stock_minimo THEN 'POCAS'
                ELSE 'DISPONIBLE' END,
           floor(GREATEST(p.stock_actual, 0))::INT,
           p.cuidado_luz, p.cuidado_riego, p.es_planta_viva, p.destacado,
           p.precio_venta,
           p.created_at > now() - interval '30 days',
           public.eventos_de(p.sku, p.categoria)
    FROM public.productos p
    WHERE p.activo AND p.visible_tienda
    ORDER BY p.destacado DESC, p.nombre;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico() TO anon, authenticated;

-- ---------- Pedido web con el precio vigente ----------
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
    c RECORD;
    comp JSONB;
    v_peso NUMERIC;
    v_acum NUMERIC;
    v_linea NUMERIC;
    v_n INT;
    v_i INT;
    v_gratis NUMERIC;
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
            -- Combo: se separa en sus productos con el precio del combo repartido según el precio de lista
            SELECT * INTO c FROM public.combos WHERE codigo = it->>'sku' AND visible;
            IF FOUND THEN
                SELECT sum((x->>'cantidad')::NUMERIC * p2.precio_venta), count(*) INTO v_peso, v_n
                  FROM jsonb_array_elements(c.items) x JOIN public.productos p2 ON p2.sku = x->>'sku' AND p2.activo;
                IF coalesce(v_n, 0) <> jsonb_array_length(c.items) OR coalesce(v_peso, 0) <= 0 THEN RAISE EXCEPTION 'Combo no disponible: %', c.nombre; END IF;
                v_acum := 0;
                v_i := 0;
                FOR comp IN SELECT * FROM jsonb_array_elements(c.items) LOOP
                    v_i := v_i + 1;
                    SELECT sku, nombre, precio_venta, stock_actual INTO prod FROM public.productos WHERE sku = comp->>'sku';
                    v_linea := CASE WHEN v_i = v_n THEN c.precio - v_acum
                                    ELSE round(c.precio * (comp->>'cantidad')::NUMERIC * prod.precio_venta / v_peso, 2) END;
                    v_acum := v_acum + v_linea;
                    IF v_qty * (comp->>'cantidad')::INT > GREATEST(prod.stock_actual, 0) THEN v_asesor := TRUE; END IF;
                    v_items := v_items || jsonb_build_object('sku', prod.sku, 'nombre', prod.nombre, 'cantidad', v_qty * (comp->>'cantidad')::INT,
                        'precio', round(v_linea / (comp->>'cantidad')::NUMERIC, 4), 'stock', GREATEST(prod.stock_actual, 0), 'combo', c.nombre);
                END LOOP;
                v_valor := v_valor + v_qty * c.precio;
                CONTINUE;
            END IF;
            -- Precio vigente: el menor entre el de lista, la oferta y el de un evento activo
            SELECT sku, nombre, public.precio_vigente(sku) AS precio_venta, stock_actual INTO prod FROM public.productos WHERE sku = it->>'sku' AND activo AND visible_tienda;
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
        -- Delivery gratis desde el monto que fija el dueño
        SELECT delivery_gratis_desde INTO v_gratis FROM public.tienda_config WHERE id = 1;
        IF v_delivery IS NOT NULL AND v_gratis IS NOT NULL AND v_valor >= v_gratis THEN v_delivery := 0; END IF;
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
