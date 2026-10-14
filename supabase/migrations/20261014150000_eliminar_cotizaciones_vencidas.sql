-- ========================================================
-- COTIZACIONES NO ACEPTADAS: SE ELIMINAN A LOS 20 DÍAS
-- Pre-cotizaciones en borrador, enviadas o rechazadas sin ningún pago, y cotizaciones enviadas o
-- rechazadas, se borran cuando pasan 20 días desde su fecha. Las aceptadas, pagadas o convertidas en venta se conservan.
-- Corre todos los días a las 00:05 de Lima (05:05 UTC).
-- ========================================================

CREATE OR REPLACE FUNCTION public.eliminar_cotizaciones_vencidas()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_limite DATE := (now() AT TIME ZONE 'America/Lima')::DATE - 20;
    v_pre INT;
    v_cot INT;
BEGIN
    DELETE FROM public.precotizaciones
     WHERE estado IN ('BORRADOR', 'ENVIADA', 'RECHAZADA') AND jsonb_array_length(pagos) = 0 AND fecha < v_limite;
    GET DIAGNOSTICS v_pre = ROW_COUNT;
    DELETE FROM public.cotizaciones
     WHERE estado IN ('ENVIADA', 'RECHAZADA') AND comprobante_id IS NULL AND fecha < v_limite;
    GET DIAGNOSTICS v_cot = ROW_COUNT;
    RETURN v_pre + v_cot;
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_cotizaciones_vencidas() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('aurevia-eliminar-cotizaciones', '5 5 * * *', 'SELECT public.eliminar_cotizaciones_vencidas()');
