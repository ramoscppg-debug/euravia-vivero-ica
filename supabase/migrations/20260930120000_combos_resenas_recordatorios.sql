-- ========================================================
-- COMERCIAL: COMBOS, DELIVERY GRATIS, RESEÑAS Y RECORDATORIOS POR WHATSAPP
-- - Combos (planta + maceta + sustrato…): se venden como uno en la tienda y al registrarse
--   se separan en sus productos con el precio repartido (stock, Kardex y contabilidad no cambian).
-- - Delivery gratis desde un monto de compra (tienda_config.delivery_gratis_desde).
-- - Reseñas: el cliente deja estrellas y comentario; sólo se publican las aprobadas por el dueño.
-- - Recordatorios: el equipo los envía desde su WhatsApp; aquí se anota cuáles ya se enviaron.
-- ========================================================

-- ---------- Combos ----------
CREATE TABLE IF NOT EXISTS public.combos (
    codigo VARCHAR(30) PRIMARY KEY CHECK (codigo ~ '^CMB-[A-Z0-9-]{1,20}$'),
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    precio NUMERIC(10,2) NOT NULL CHECK (precio > 0),       -- precio final del combo, IGV incluido
    items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 2 AND 10), -- [{sku, cantidad}]
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
CREATE POLICY combos_panel ON public.combos FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY combos_dueno ON public.combos FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

/** Vitrina de combos: precio, contenido y unidades disponibles (el menor alcance de sus productos). Sin costos. */
CREATE OR REPLACE FUNCTION public.combos_publicos()
RETURNS TABLE (codigo VARCHAR, nombre VARCHAR, descripcion TEXT, imagen_url TEXT, precio NUMERIC, stock INT, contenido JSONB, orden INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.codigo, c.nombre, c.descripcion, c.imagen_url, c.precio,
           coalesce((SELECT min(floor(GREATEST(p.stock_actual, 0) / (x->>'cantidad')::NUMERIC))::INT
                       FROM jsonb_array_elements(c.items) x JOIN public.productos p ON p.sku = x->>'sku'), 0),
           (SELECT jsonb_agg(jsonb_build_object('sku', p.sku, 'nombre', p.nombre, 'cantidad', (x->>'cantidad')::INT))
              FROM jsonb_array_elements(c.items) x JOIN public.productos p ON p.sku = x->>'sku'),
           c.orden
      FROM public.combos c
     WHERE c.visible AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(c.items) x
                                      LEFT JOIN public.productos p ON p.sku = x->>'sku' AND p.activo WHERE p.sku IS NULL)
     ORDER BY c.orden, c.nombre;
$$;
REVOKE ALL ON FUNCTION public.combos_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.combos_publicos() TO anon, authenticated;

-- ---------- Delivery gratis ----------
ALTER TABLE public.tienda_config ADD COLUMN IF NOT EXISTS delivery_gratis_desde NUMERIC(10,2) CHECK (delivery_gratis_desde IS NULL OR delivery_gratis_desde > 0);

-- ---------- Reseñas ----------
CREATE TABLE IF NOT EXISTS public.resenas (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    telefono VARCHAR(20),                        -- privado: sólo para que el equipo verifique
    estrellas INT NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    texto VARCHAR(600) NOT NULL,
    producto_sku VARCHAR(30) REFERENCES public.productos(sku) ON DELETE SET NULL,
    foto_url TEXT,                               -- la sube el dueño (foto que envió el cliente)
    aprobada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resenas_aprobadas_idx ON public.resenas (aprobada, created_at DESC);
ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
CREATE POLICY resenas_panel ON public.resenas FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY resenas_dueno ON public.resenas FOR ALL TO authenticated USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

/** El cliente deja su reseña (queda por aprobar). Límite: 3 por teléfono al día. */
CREATE OR REPLACE FUNCTION public.crear_resena(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_nombre TEXT := btrim(coalesce(p->>'nombre', ''));
    v_texto TEXT := btrim(coalesce(p->>'texto', ''));
    v_tel TEXT := regexp_replace(coalesce(p->>'telefono', ''), '[^0-9+]', '', 'g');
    v_estrellas INT := (p->>'estrellas')::INT;
    v_sku TEXT := NULLIF(p->>'sku', '');
    v_id BIGINT;
BEGIN
    IF length(v_nombre) < 2 OR length(v_nombre) > 80 THEN RAISE EXCEPTION 'Indica tu nombre'; END IF;
    IF v_tel !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'Indica tu teléfono o WhatsApp'; END IF;
    IF v_estrellas IS NULL OR v_estrellas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Elige de 1 a 5 estrellas'; END IF;
    IF length(v_texto) < 5 OR length(v_texto) > 600 THEN RAISE EXCEPTION 'Cuéntanos tu experiencia (hasta 600 caracteres)'; END IF;
    IF v_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.productos WHERE sku = v_sku AND activo) THEN v_sku := NULL; END IF;
    IF (SELECT count(*) FROM public.resenas WHERE telefono = v_tel AND created_at > now() - interval '1 day') >= 3 THEN
        RAISE EXCEPTION 'Ya recibimos tus comentarios de hoy. ¡Gracias!';
    END IF;
    INSERT INTO public.resenas (nombre, telefono, estrellas, texto, producto_sku) VALUES (v_nombre, v_tel, v_estrellas, v_texto, v_sku) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_resena(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_resena(JSONB) TO anon, authenticated;

/** Reseñas aprobadas para la tienda (sin teléfono). */
CREATE OR REPLACE FUNCTION public.resenas_publicas()
RETURNS TABLE (id BIGINT, nombre VARCHAR, estrellas INT, texto VARCHAR, producto_sku VARCHAR, foto_url TEXT, fecha DATE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT r.id, r.nombre, r.estrellas, r.texto, r.producto_sku, r.foto_url, (r.created_at AT TIME ZONE 'America/Lima')::DATE
      FROM public.resenas r WHERE r.aprobada ORDER BY r.created_at DESC LIMIT 60;
$$;
REVOKE ALL ON FUNCTION public.resenas_publicas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resenas_publicas() TO anon, authenticated;

-- ---------- Recordatorios enviados ----------
CREATE TABLE IF NOT EXISTS public.recordatorios_enviados (
    clave VARCHAR(80) PRIMARY KEY,                -- p. ej. COT:123, CUIDADO:B001-45
    enviado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario VARCHAR(100)
);
ALTER TABLE public.recordatorios_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY recordatorios_equipo ON public.recordatorios_enviados FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));

-- ---------- Pedido web con combos y delivery gratis ----------
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
