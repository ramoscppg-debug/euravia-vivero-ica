-- Los cupones vencen al final del día en hora de Lima (la base trabaja en UTC)
CREATE OR REPLACE FUNCTION public.aplicar_cupon(p_codigo TEXT, p_base NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    cu public.cupones;
    hoy_lima DATE := (now() AT TIME ZONE 'America/Lima')::DATE;
BEGIN
    IF NOT public.tiene_rol('{dueno,vendedor}') THEN
        RAISE EXCEPTION 'Tu rol no puede aplicar cupones' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO cu FROM public.cupones WHERE codigo = upper(p_codigo) FOR UPDATE;
    IF NOT FOUND OR NOT cu.activo THEN RAISE EXCEPTION 'Cupón % no existe o está desactivado', p_codigo; END IF;
    IF cu.vence IS NOT NULL AND cu.vence < hoy_lima THEN RAISE EXCEPTION 'Cupón % vencido', p_codigo; END IF;
    IF cu.usos_max IS NOT NULL AND cu.usos >= cu.usos_max THEN RAISE EXCEPTION 'Cupón % agotado', p_codigo; END IF;
    IF p_base < cu.minimo_compra THEN RAISE EXCEPTION 'El cupón % pide una compra mínima de S/ %', p_codigo, cu.minimo_compra; END IF;
    UPDATE public.cupones SET usos = usos + 1 WHERE codigo = cu.codigo;
    RETURN round(LEAST(p_base, CASE WHEN cu.tipo = 'PCT' THEN p_base * cu.valor / 100 ELSE cu.valor END), 2);
END;
$$;
