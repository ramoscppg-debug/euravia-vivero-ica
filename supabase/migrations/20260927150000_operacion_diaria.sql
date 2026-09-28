-- ========================================================
-- OPERACIÓN DIARIA
-- 1. Aviso al WhatsApp del dueño cuando llega un pedido web (CallMeBot, gratuito).
--    La llamada sale desde la base (pg_net): la clave nunca viaja al navegador del cliente.
-- 2. Tarifas de delivery por distrito: la tienda muestra el costo y el servidor lo fija (no se confía en el navegador).
-- ========================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------- 1. Notificaciones ----------
CREATE TABLE IF NOT EXISTS public.notificaciones_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    whatsapp VARCHAR(16) CHECK (whatsapp IS NULL OR whatsapp ~ '^\+?[0-9]{8,15}$'),
    apikey VARCHAR(40), -- clave personal de CallMeBot (sólo la lee el dueño)
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    url_panel TEXT,
    ultimo_envio TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.notificaciones_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.notificaciones_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificaciones_dueno_ver ON public.notificaciones_config FOR SELECT TO authenticated USING (public.tiene_rol('{dueno}'));
CREATE POLICY notificaciones_dueno_editar ON public.notificaciones_config FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

/** Encola el mensaje de WhatsApp (pg_net es asíncrono: nunca frena ni rompe el pedido). */
CREATE OR REPLACE FUNCTION public.enviar_aviso_whatsapp(p_texto TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    c public.notificaciones_config;
BEGIN
    SELECT * INTO c FROM public.notificaciones_config WHERE id = 1;
    IF NOT FOUND OR NOT c.activo OR c.whatsapp IS NULL OR c.apikey IS NULL THEN RETURN FALSE; END IF;
    PERFORM net.http_get(
        url := 'https://api.callmebot.com/whatsapp.php',
        params := jsonb_build_object('phone', c.whatsapp, 'text', left(p_texto, 900), 'apikey', c.apikey)
    );
    UPDATE public.notificaciones_config SET ultimo_envio = now() WHERE id = 1;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE; -- un aviso fallido no debe perder el pedido
END;
$$;
REVOKE ALL ON FUNCTION public.enviar_aviso_whatsapp(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.avisar_solicitud_nueva()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_url TEXT;
    v_texto TEXT;
BEGIN
    SELECT url_panel INTO v_url FROM public.notificaciones_config WHERE id = 1;
    v_texto := concat_ws(E'\n',
        CASE NEW.tipo WHEN 'PEDIDO' THEN '🛒 Nuevo pedido web N° ' WHEN 'SERVICIO' THEN '🌿 Nueva cotización de servicio N° ' ELSE '✉️ Nueva consulta N° ' END || NEW.id,
        NEW.nombre || ' · ' || NEW.telefono,
        CASE WHEN jsonb_array_length(NEW.items) > 0
             THEN jsonb_array_length(NEW.items) || ' producto(s) · S/ ' || to_char(NEW.total_referencial, 'FM999G990D00') END,
        CASE WHEN NEW.tipo <> 'CONSULTA' THEN (CASE WHEN NEW.comprobante = 'FACTURA' THEN 'Factura' ELSE 'Boleta' END)
             || CASE WHEN NEW.tipo = 'PEDIDO' THEN ' · ' || (CASE WHEN NEW.entrega = 'DELIVERY' THEN 'Delivery ' || coalesce(NEW.distrito, '') ELSE 'Recojo' END) END END,
        CASE WHEN NEW.requiere_asesor THEN '⚠️ Pide más que el stock: atender con asesor' END,
        CASE WHEN v_url IS NOT NULL THEN 'Ver: ' || v_url || '/#solicitudes' END
    );
    PERFORM public.enviar_aviso_whatsapp(v_texto);
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS solicitudes_aviso_whatsapp ON public.solicitudes_tienda;
CREATE TRIGGER solicitudes_aviso_whatsapp AFTER INSERT ON public.solicitudes_tienda
    FOR EACH ROW EXECUTE FUNCTION public.avisar_solicitud_nueva();

/** Botón "Enviar prueba" del panel (sólo el dueño). */
CREATE OR REPLACE FUNCTION public.probar_aviso_whatsapp()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño puede probar los avisos' USING ERRCODE = '42501'; END IF;
    RETURN public.enviar_aviso_whatsapp('✅ AUREVIA: los avisos de pedidos web llegarán a este WhatsApp.');
END;
$$;
REVOKE ALL ON FUNCTION public.probar_aviso_whatsapp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.probar_aviso_whatsapp() TO authenticated;

-- ---------- 2. Delivery por distrito ----------
CREATE TABLE IF NOT EXISTS public.tarifas_delivery (
    distrito VARCHAR(80) PRIMARY KEY,
    costo NUMERIC(10,2) NOT NULL CHECK (costo >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tarifas_delivery ENABLE ROW LEVEL SECURITY;
CREATE POLICY tarifas_ver ON public.tarifas_delivery FOR SELECT TO anon, authenticated USING (activo OR public.tiene_rol('{dueno}'));
CREATE POLICY tarifas_dueno ON public.tarifas_delivery FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

ALTER TABLE public.solicitudes_tienda
    ADD COLUMN IF NOT EXISTS costo_delivery NUMERIC(10,2) CHECK (costo_delivery IS NULL OR costo_delivery >= 0);

/**
  crear_solicitud (v3): igual que la v2 y además fija el costo de delivery desde tarifas_delivery
  (distrito sin tarifa = "a coordinar", costo NULL).
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
    v_distrito TEXT := left(NULLIF(btrim(coalesce(p->>'distrito', '')), ''), 80);
    v_delivery NUMERIC;
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

    IF v_tipo = 'PEDIDO' AND v_entrega = 'DELIVERY' AND v_distrito IS NOT NULL THEN
        SELECT costo INTO v_delivery FROM public.tarifas_delivery WHERE activo AND lower(distrito) = lower(v_distrito);
    END IF;

    INSERT INTO public.solicitudes_tienda (tipo, nombre, telefono, email, distrito, mensaje, servicio_slug, items, total_referencial,
                                           comprobante, doc_cliente, razon_social, entrega, direccion, requiere_asesor, costo_delivery)
    VALUES (v_tipo, v_nombre, v_tel, NULLIF(btrim(p->>'email'), ''), v_distrito,
            NULLIF(btrim(p->>'mensaje'), ''), CASE WHEN v_tipo = 'SERVICIO' THEN p->>'servicio' END, v_items, round(v_total, 2),
            v_comp, v_doc, left(v_razon, 150), v_entrega, left(v_dir, 250), v_asesor, v_delivery)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_solicitud(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud(JSONB) TO anon, authenticated;
