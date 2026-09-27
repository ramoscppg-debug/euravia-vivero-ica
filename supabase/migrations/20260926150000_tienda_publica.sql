-- ========================================================
-- TIENDA PÚBLICA
-- Principio de mínimo acceso: el visitante (rol anon) NO lee tablas del negocio.
-- Sólo puede: ver el catálogo por catalogo_publico() (sin costos ni stock exacto),
-- ver servicios y datos de contacto publicados, y enviar una solicitud por crear_solicitud().
-- ========================================================

-- ---------- Productos: qué se muestra en la tienda ----------
ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS visible_tienda BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;

/** Catálogo público: sólo campos de vitrina. Disponibilidad por rangos, nunca el número de stock. */
CREATE OR REPLACE FUNCTION public.catalogo_publico()
RETURNS TABLE (
    sku VARCHAR, nombre VARCHAR, nombre_cientifico VARCHAR, categoria VARCHAR, categoria_nombre VARCHAR,
    familia_botanica VARCHAR, descripcion TEXT, imagen_url TEXT, precio NUMERIC, disponibilidad TEXT,
    cuidado_luz VARCHAR, cuidado_riego VARCHAR, es_planta_viva BOOLEAN, destacado BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p.sku, p.nombre, p.nombre_cientifico, p.categoria, p.categoria_nombre, p.familia_botanica,
           p.descripcion, p.imagen_url, p.precio_venta,
           CASE WHEN p.stock_actual <= 0 THEN 'AGOTADO'
                WHEN p.stock_actual <= p.stock_minimo THEN 'POCAS'
                ELSE 'DISPONIBLE' END,
           p.cuidado_luz, p.cuidado_riego, p.es_planta_viva, p.destacado
    FROM public.productos p
    WHERE p.activo AND p.visible_tienda
    ORDER BY p.destacado DESC, p.nombre;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico() TO anon, authenticated;

-- ---------- Servicios publicados en la tienda ----------
CREATE TABLE IF NOT EXISTS public.servicios_publicos (
    slug VARCHAR(60) PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    nombre VARCHAR(120) NOT NULL,
    resumen VARCHAR(240) NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    orden INT NOT NULL DEFAULT 0,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.servicios_publicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY servicios_publicos_ver ON public.servicios_publicos FOR SELECT TO anon, authenticated USING (visible OR public.tiene_rol('{dueno}'));
CREATE POLICY servicios_publicos_dueno ON public.servicios_publicos FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Los mismos tipos de servicio que ya usa el sistema de proyectos; textos descriptivos sin precios (el dueño los ajusta)
INSERT INTO public.servicios_publicos (slug, nombre, resumen, descripcion, orden) VALUES
    ('diseno-paisajista', 'Diseño Paisajista', 'Diseño de jardines y áreas verdes para casas, terrazas y empresas.', 'Te ayudamos a planificar tu jardín: selección de especies según luz y espacio, distribución y materiales. Solicita una cotización con las medidas y fotos de tu espacio.', 1),
    ('mantenimiento-residencial', 'Mantenimiento de Jardines', 'Cuidado periódico de jardines: poda, fertilización y control de plagas.', 'Visitas programadas para mantener tus plantas sanas. Podemos coordinar una frecuencia mensual.', 2),
    ('jardin-vertical', 'Jardín Vertical', 'Instalación y cuidado de jardines verticales para interiores y fachadas.', 'Diseño, instalación y mantenimiento de muros verdes. Cuéntanos el tamaño y la ubicación para cotizar.', 3),
    ('riego-automatizado', 'Riego Automatizado', 'Sistemas de riego por goteo y aspersión para jardines y macetas.', 'Evaluamos tu espacio para proponer un sistema de riego que ahorre agua y tiempo.', 4)
ON CONFLICT (slug) DO NOTHING;

-- ---------- Datos de contacto de la tienda (vacíos hasta que el dueño los complete) ----------
CREATE TABLE IF NOT EXISTS public.tienda_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    whatsapp VARCHAR(16) CHECK (whatsapp IS NULL OR whatsapp ~ '^\+?[0-9]{8,15}$'),
    email VARCHAR(120) CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    direccion TEXT,
    horario VARCHAR(200),
    mensaje_portada VARCHAR(300),
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.tienda_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tienda_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY tienda_config_ver ON public.tienda_config FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY tienda_config_dueno ON public.tienda_config FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- ---------- Solicitudes desde la tienda (pedido, cotización de servicio o consulta) ----------
CREATE TABLE IF NOT EXISTS public.solicitudes_tienda (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PEDIDO', 'SERVICIO', 'CONSULTA')),
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(120),
    distrito VARCHAR(80),
    mensaje VARCHAR(1000),
    servicio_slug VARCHAR(60) REFERENCES public.servicios_publicos(slug),
    items JSONB NOT NULL DEFAULT '[]', -- [{sku, nombre, cantidad, precio}] con precios del servidor
    total_referencial NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(12) NOT NULL DEFAULT 'NUEVA' CHECK (estado IN ('NUEVA', 'EN_PROCESO', 'ATENDIDA', 'DESCARTADA')),
    pedido_id VARCHAR(20) REFERENCES public.pedidos(id),
    atendida_por VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solicitudes_estado_idx ON public.solicitudes_tienda (estado, created_at DESC);
ALTER TABLE public.solicitudes_tienda ENABLE ROW LEVEL SECURITY;
-- Sin políticas para anon: el público sólo inserta mediante crear_solicitud() y no puede leer nada
CREATE POLICY solicitudes_leer ON public.solicitudes_tienda FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY solicitudes_atender ON public.solicitudes_tienda FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY solicitudes_dueno_borra ON public.solicitudes_tienda FOR DELETE TO authenticated USING (public.tiene_rol('{dueno}'));

/**
  Crea una solicitud desde la tienda. Todo se valida en el servidor:
  - datos de contacto con longitud y formato;
  - productos existentes y visibles, cantidades 1..99, máximo 30 líneas; precios tomados de la base;
  - freno anti-spam: máximo 5 solicitudes por teléfono por hora.
  Devuelve el número de solicitud.
*/
CREATE OR REPLACE FUNCTION public.crear_solicitud(p JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tipo TEXT := upper(coalesce(p->>'tipo', 'CONSULTA'));
    v_nombre TEXT := btrim(coalesce(p->>'nombre', ''));
    v_tel TEXT := regexp_replace(coalesce(p->>'telefono', ''), '[^0-9+]', '', 'g');
    v_items JSONB := '[]';
    v_total NUMERIC := 0;
    it JSONB;
    prod RECORD;
    v_qty INT;
    v_id BIGINT;
BEGIN
    IF v_tipo NOT IN ('PEDIDO', 'SERVICIO', 'CONSULTA') THEN RAISE EXCEPTION 'Tipo de solicitud inválido'; END IF;
    IF length(v_nombre) < 2 OR length(v_nombre) > 120 THEN RAISE EXCEPTION 'Indica tu nombre'; END IF;
    IF v_tel !~ '^\+?[0-9]{7,15}$' THEN RAISE EXCEPTION 'Indica un teléfono o WhatsApp válido'; END IF;
    IF length(coalesce(p->>'mensaje', '')) > 1000 THEN RAISE EXCEPTION 'El mensaje es demasiado largo'; END IF;
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
            IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
            SELECT sku, nombre, precio_venta INTO prod FROM public.productos WHERE sku = it->>'sku' AND activo AND visible_tienda;
            IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible: %', it->>'sku'; END IF;
            v_items := v_items || jsonb_build_object('sku', prod.sku, 'nombre', prod.nombre, 'cantidad', v_qty, 'precio', prod.precio_venta);
            v_total := v_total + v_qty * prod.precio_venta;
        END LOOP;
    END IF;
    IF v_tipo = 'PEDIDO' AND jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Tu pedido no tiene productos'; END IF;

    INSERT INTO public.solicitudes_tienda (tipo, nombre, telefono, email, distrito, mensaje, servicio_slug, items, total_referencial)
    VALUES (v_tipo, v_nombre, v_tel, NULLIF(btrim(p->>'email'), ''), left(NULLIF(btrim(p->>'distrito'), ''), 80),
            NULLIF(btrim(p->>'mensaje'), ''), CASE WHEN v_tipo = 'SERVICIO' THEN p->>'servicio' END, v_items, round(v_total, 2))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_solicitud(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud(JSONB) TO anon, authenticated;
