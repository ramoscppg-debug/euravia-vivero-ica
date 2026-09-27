-- ========================================================
-- FLUJO COMERCIAL: tienda → solicitud → pedido → comprobante
-- - La tienda muestra la cantidad disponible (sin costos) y avisa cuando se pide más que el stock.
-- - La solicitud trae el comprobante que pide el cliente (boleta o factura) y cómo recibe su pedido.
-- - El pedido conserva ese comprobante para que contabilidad lo emita al cobrar.
-- - Fotos del catálogo y de servicios en un almacenamiento público de sólo lectura.
-- ========================================================

-- ---------- Catálogo público con cantidad disponible ----------
DROP FUNCTION IF EXISTS public.catalogo_publico();
CREATE FUNCTION public.catalogo_publico()
RETURNS TABLE (
    sku VARCHAR, nombre VARCHAR, nombre_cientifico VARCHAR, categoria VARCHAR, categoria_nombre VARCHAR,
    familia_botanica VARCHAR, descripcion TEXT, imagen_url TEXT, precio NUMERIC, disponibilidad TEXT, stock INT,
    cuidado_luz VARCHAR, cuidado_riego VARCHAR, es_planta_viva BOOLEAN, destacado BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.sku, p.nombre, p.nombre_cientifico, p.categoria, p.categoria_nombre, p.familia_botanica,
           p.descripcion, p.imagen_url, p.precio_venta,
           CASE WHEN p.stock_actual <= 0 THEN 'AGOTADO'
                WHEN p.stock_actual <= p.stock_minimo THEN 'POCAS'
                ELSE 'DISPONIBLE' END,
           GREATEST(p.stock_actual, 0),
           p.cuidado_luz, p.cuidado_riego, p.es_planta_viva, p.destacado
    FROM public.productos p
    WHERE p.activo AND p.visible_tienda
    ORDER BY p.destacado DESC, p.nombre;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico() TO anon, authenticated;

-- ---------- Solicitud: comprobante, entrega y atención por asesor ----------
ALTER TABLE public.solicitudes_tienda
    ADD COLUMN IF NOT EXISTS comprobante VARCHAR(7) NOT NULL DEFAULT 'BOLETA' CHECK (comprobante IN ('BOLETA', 'FACTURA')),
    ADD COLUMN IF NOT EXISTS doc_cliente VARCHAR(11) CHECK (doc_cliente IS NULL OR doc_cliente ~ '^[0-9]{8}$|^[0-9]{11}$'),
    ADD COLUMN IF NOT EXISTS razon_social VARCHAR(150),
    ADD COLUMN IF NOT EXISTS entrega VARCHAR(8) NOT NULL DEFAULT 'RECOJO' CHECK (entrega IN ('RECOJO', 'DELIVERY')),
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(250),
    ADD COLUMN IF NOT EXISTS requiere_asesor BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------- Pedido: comprobante que pidió el cliente ----------
ALTER TABLE public.pedidos
    ADD COLUMN IF NOT EXISTS tipo_comprobante VARCHAR(2) CHECK (tipo_comprobante IS NULL OR tipo_comprobante IN ('01', '03')),
    ADD COLUMN IF NOT EXISTS razon_social VARCHAR(150);

/**
  Crea una solicitud desde la tienda. Todo se valida en el servidor:
  - contacto con formato; factura exige RUC de 11 dígitos y razón social; boleta acepta DNI opcional;
  - productos existentes y visibles, cantidades 1..999, máximo 30 líneas; precios tomados de la base;
  - si alguna cantidad supera el stock, la solicitud queda marcada para un asesor de ventas;
  - freno anti-spam: máximo 5 solicitudes por teléfono por hora.
*/
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
    v_items JSONB := '[]';
    v_total NUMERIC := 0;
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
    IF v_comp NOT IN ('BOLETA', 'FACTURA') THEN RAISE EXCEPTION 'Elige boleta o factura'; END IF;
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
            v_total := v_total + v_qty * prod.precio_venta;
        END LOOP;
    END IF;
    IF v_tipo = 'PEDIDO' AND jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Tu pedido no tiene productos'; END IF;

    INSERT INTO public.solicitudes_tienda (tipo, nombre, telefono, email, distrito, mensaje, servicio_slug, items, total_referencial,
                                           comprobante, doc_cliente, razon_social, entrega, direccion, requiere_asesor)
    VALUES (v_tipo, v_nombre, v_tel, NULLIF(btrim(p->>'email'), ''), left(NULLIF(btrim(p->>'distrito'), ''), 80),
            NULLIF(btrim(p->>'mensaje'), ''), CASE WHEN v_tipo = 'SERVICIO' THEN p->>'servicio' END, v_items, round(v_total, 2),
            v_comp, v_doc, left(v_razon, 150), v_entrega, left(v_dir, 250), v_asesor)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_solicitud(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud(JSONB) TO anon, authenticated;

-- ---------- Fotos del catálogo y servicios (lectura pública, sólo el dueño sube) ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalogo', 'catalogo', TRUE, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY catalogo_subir ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'catalogo' AND public.tiene_rol('{dueno}'));
CREATE POLICY catalogo_actualizar ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'catalogo' AND public.tiene_rol('{dueno}'));
CREATE POLICY catalogo_borrar ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'catalogo' AND public.tiene_rol('{dueno}'));
