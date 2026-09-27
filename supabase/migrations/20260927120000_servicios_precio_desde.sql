-- ========================================================
-- SERVICIOS: precio referencial opcional ("desde S/ X") que fija el dueño.
-- Si queda vacío, la tienda sólo ofrece "Cotizar" (no se inventan precios).
-- ========================================================
ALTER TABLE public.servicios_publicos
    ADD COLUMN IF NOT EXISTS precio_desde NUMERIC(10,2) CHECK (precio_desde IS NULL OR precio_desde >= 0);

-- Borrar un servicio no borra ni bloquea las solicitudes que lo pidieron: quedan sin vínculo.
ALTER TABLE public.solicitudes_tienda DROP CONSTRAINT IF EXISTS solicitudes_tienda_servicio_slug_fkey;
ALTER TABLE public.solicitudes_tienda
    ADD CONSTRAINT solicitudes_tienda_servicio_slug_fkey FOREIGN KEY (servicio_slug)
    REFERENCES public.servicios_publicos(slug) ON UPDATE CASCADE ON DELETE SET NULL;
