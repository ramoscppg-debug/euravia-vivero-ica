-- ========================================================
-- CIERRE ANUAL Y BORRADO DE DATOS DE PRUEBA
-- Cierre del ejercicio (al 31/12):
--   1. Resultado: se saldan las cuentas 6x y 7x contra 891 Utilidad / 892 Pérdida.
--   2. Traslado: 891 a 5911 Utilidades acumuladas (o 5921 Pérdidas acumuladas a 892).
--   No hay asiento de cierre de balance: las cuentas 1 a 5 siguen con su saldo.
--   Se guarda la foto del 1 de enero siguiente: saldos iniciales (cuentas 1 a 5) e
--   inventario inicial por producto (saldo inicial del Kardex 13.1).
--   El año cerrado queda bloqueado; sólo el dueño lo reabre, con motivo.
-- Borrar datos de prueba: deja la empresa lista para empezar; se bloquea al operar de verdad.
-- ========================================================

ALTER TABLE public.asientos DROP CONSTRAINT IF EXISTS asientos_origen_check;
ALTER TABLE public.asientos ADD CONSTRAINT asientos_origen_check
    CHECK (origen IN ('KARDEX', 'VENTA', 'COMPRA', 'COBRO', 'MANUAL', 'GASTO', 'PAGO', 'CAJA', 'PLANILLA', 'CIERRE'));

CREATE TABLE IF NOT EXISTS public.ejercicios (
    anio INT PRIMARY KEY CHECK (anio BETWEEN 2000 AND 2100),
    estado VARCHAR(8) NOT NULL CHECK (estado IN ('CERRADO', 'ABIERTO')),
    resultado NUMERIC(14,2),               -- utilidad (+) o pérdida (−) del ejercicio
    cerrado_at TIMESTAMPTZ,
    cerrado_por VARCHAR(100),
    historial JSONB NOT NULL DEFAULT '[]'  -- cierres y reaperturas con su motivo
);

-- Saldos al 1 de enero del año (cuentas 1 a 5), tomados al cerrar el año anterior
CREATE TABLE IF NOT EXISTS public.saldos_iniciales (
    anio INT NOT NULL,
    cuenta VARCHAR(10) NOT NULL REFERENCES public.plan_cuentas(codigo),
    debe NUMERIC(14,2) NOT NULL DEFAULT 0,
    haber NUMERIC(14,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (anio, cuenta)
);

-- Inventario al 1 de enero del año (saldo inicial del Kardex 13.1)
CREATE TABLE IF NOT EXISTS public.inventario_inicial (
    anio INT NOT NULL,
    producto_sku VARCHAR(30) NOT NULL REFERENCES public.productos(sku),
    cantidad NUMERIC(12,4) NOT NULL,
    costo_unitario NUMERIC(12,4) NOT NULL,
    costo_total NUMERIC(14,4) NOT NULL,
    PRIMARY KEY (anio, producto_sku)
);

ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_iniciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_inicial ENABLE ROW LEVEL SECURITY;
CREATE POLICY ejercicios_leer ON public.ejercicios FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY saldos_iniciales_leer ON public.saldos_iniciales FOR SELECT TO authenticated USING (public.tiene_rol('{dueno}'));
CREATE POLICY inventario_inicial_leer ON public.inventario_inicial FOR SELECT TO authenticated USING (public.tiene_rol('{dueno}'));

-- ---------- Bloqueo del año cerrado ----------
CREATE OR REPLACE FUNCTION public.anio_cerrado(p_fecha DATE) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.ejercicios WHERE anio = extract(year FROM p_fecha)::INT AND estado = 'CERRADO');
$$;

/** TG_ARGV[0]: columna con la fecha; TG_ARGV[1] = 'tz' si es fecha y hora (se toma el día de Lima). */
CREATE OR REPLACE FUNCTION public.bloquear_periodo_cerrado()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_fila JSONB;
    v_texto TEXT;
    v_fecha DATE;
BEGIN
    FOR v_fila IN SELECT x FROM unnest(ARRAY[
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END]) AS x WHERE x IS NOT NULL LOOP
        v_texto := v_fila->>TG_ARGV[0];
        CONTINUE WHEN v_texto IS NULL;
        v_fecha := CASE WHEN TG_NARGS > 1 AND TG_ARGV[1] = 'tz' THEN (v_texto::TIMESTAMPTZ AT TIME ZONE 'America/Lima')::DATE ELSE left(v_texto, 10)::DATE END;
        IF public.anio_cerrado(v_fecha) THEN
            RAISE EXCEPTION 'El ejercicio % está cerrado: no se puede registrar ni modificar nada con fecha %', extract(year FROM v_fecha), v_fecha;
        END IF;
    END LOOP;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- "zz_" para correr después de los triggers que completan la fecha (p. ej. el del Kardex)
CREATE TRIGGER zz_periodo_asientos BEFORE INSERT OR UPDATE OR DELETE ON public.asientos FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha');
CREATE TRIGGER zz_periodo_kardex BEFORE INSERT ON public.kardex_movimientos FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha_emision');
CREATE TRIGGER zz_periodo_comprobantes BEFORE INSERT ON public.comprobantes FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha_emision');
CREATE TRIGGER zz_periodo_compras BEFORE INSERT ON public.compras FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha');
CREATE TRIGGER zz_periodo_gastos BEFORE INSERT ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha');
CREATE TRIGGER zz_periodo_caja BEFORE INSERT ON public.caja_movimientos FOR EACH ROW EXECUTE FUNCTION public.bloquear_periodo_cerrado('fecha', 'tz');

-- ---------- Cierre ----------
CREATE OR REPLACE FUNCTION public.cerrar_ejercicio(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_anio INT := (p->>'anio')::INT;
    v_fin DATE;
    v_hoy DATE := (now() AT TIME ZONE 'America/Lima')::DATE;
    v_lineas JSONB := '[]';
    v_resultado NUMERIC := 0;
    v_pend INT;
    v_previo INT;
    r RECORD;
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño cierra el ejercicio' USING ERRCODE = '42501'; END IF;
    IF v_anio IS NULL THEN RAISE EXCEPTION 'Indica el año'; END IF;
    v_fin := make_date(v_anio, 12, 31);
    IF v_hoy <= v_fin THEN RAISE EXCEPTION 'El ejercicio % aún no termina: se cierra desde el 1 de enero de %', v_anio, v_anio + 1; END IF;
    IF public.anio_cerrado(v_fin) THEN RAISE EXCEPTION 'El ejercicio % ya está cerrado', v_anio; END IF;
    SELECT min(extract(year FROM a.fecha))::INT INTO v_previo FROM public.asientos a
     WHERE a.fecha < make_date(v_anio, 1, 1) AND NOT public.anio_cerrado(a.fecha);
    IF v_previo IS NOT NULL THEN RAISE EXCEPTION 'Cierra primero el ejercicio %', v_previo; END IF;
    SELECT count(*) INTO v_pend FROM public.comprobantes
     WHERE extract(year FROM fecha_emision) = v_anio AND numero_sunat IS NULL AND estado_sunat = 'PENDIENTE';
    IF v_pend > 0 THEN RAISE EXCEPTION 'Hay % comprobante(s) de % por emitir en SUNAT: regístralos antes de cerrar', v_pend, v_anio; END IF;

    -- 1. Resultado: se saldan las cuentas de gastos (6) e ingresos (7)
    FOR r IN
        SELECT l.cuenta, round(sum(l.debe - l.haber), 2) AS saldo
          FROM public.asiento_lineas l JOIN public.asientos a ON a.id = l.asiento_id
         WHERE a.fecha BETWEEN make_date(v_anio, 1, 1) AND v_fin AND left(l.cuenta, 1) IN ('6', '7')
         GROUP BY l.cuenta HAVING round(sum(l.debe - l.haber), 2) <> 0
         ORDER BY l.cuenta
    LOOP
        v_lineas := v_lineas || jsonb_build_array(linea_json(r.cuenta, GREATEST(-r.saldo, 0), GREATEST(r.saldo, 0)));
        v_resultado := v_resultado - r.saldo;
    END LOOP;

    IF jsonb_array_length(v_lineas) > 0 THEN
        v_lineas := v_lineas || jsonb_build_array(CASE WHEN v_resultado >= 0 THEN linea_json('891', 0, v_resultado) ELSE linea_json('892', -v_resultado, 0) END);
        PERFORM crear_asiento(v_fin, 'Cierre del ejercicio ' || v_anio || ': determinación del resultado', 'CIERRE', v_anio::TEXT, v_lineas, '00', NULL, NULL, p->>'usuario');
        -- 2. Traslado del resultado al patrimonio
        IF v_resultado > 0 THEN
            PERFORM crear_asiento(v_fin, 'Utilidad del ejercicio ' || v_anio || ' a resultados acumulados', 'CIERRE', v_anio || '-T',
                jsonb_build_array(linea_json('891', v_resultado, 0), linea_json('5911', 0, v_resultado)), '00', NULL, NULL, p->>'usuario');
        ELSIF v_resultado < 0 THEN
            PERFORM crear_asiento(v_fin, 'Pérdida del ejercicio ' || v_anio || ' a resultados acumulados', 'CIERRE', v_anio || '-T',
                jsonb_build_array(linea_json('5921', -v_resultado, 0), linea_json('892', 0, -v_resultado)), '00', NULL, NULL, p->>'usuario');
        END IF;
    END IF;

    -- 3. Foto del 1 de enero siguiente: saldos de las cuentas 1 a 5 e inventario por producto
    DELETE FROM public.saldos_iniciales WHERE anio = v_anio + 1;
    INSERT INTO public.saldos_iniciales (anio, cuenta, debe, haber)
    SELECT v_anio + 1, l.cuenta, GREATEST(round(sum(l.debe - l.haber), 2), 0), GREATEST(round(sum(l.haber - l.debe), 2), 0)
      FROM public.asiento_lineas l JOIN public.asientos a ON a.id = l.asiento_id
     WHERE a.fecha <= v_fin AND left(l.cuenta, 1) IN ('1', '2', '3', '4', '5')
     GROUP BY l.cuenta HAVING round(sum(l.debe - l.haber), 2) <> 0;

    DELETE FROM public.inventario_inicial WHERE anio = v_anio + 1;
    INSERT INTO public.inventario_inicial (anio, producto_sku, cantidad, costo_unitario, costo_total)
    SELECT v_anio + 1, k.producto_sku, k.saldo_cantidad, coalesce(k.saldo_costo_unitario, 0), coalesce(k.saldo_costo_total, 0)
      FROM public.kardex_saldos_al(make_date(v_anio + 1, 1, 1)) k
     WHERE k.saldo_cantidad <> 0 OR coalesce(k.saldo_costo_total, 0) <> 0;

    -- 4. El año queda cerrado (a partir de aquí nadie registra con fecha de ese año)
    INSERT INTO public.ejercicios (anio, estado, resultado, cerrado_at, cerrado_por, historial)
    VALUES (v_anio, 'CERRADO', round(v_resultado, 2), now(), p->>'usuario',
            jsonb_build_array(jsonb_build_object('accion', 'CIERRE', 'fecha', now(), 'usuario', p->>'usuario', 'resultado', round(v_resultado, 2))))
    ON CONFLICT (anio) DO UPDATE SET estado = 'CERRADO', resultado = EXCLUDED.resultado, cerrado_at = now(), cerrado_por = EXCLUDED.cerrado_por,
        historial = public.ejercicios.historial || EXCLUDED.historial;

    RETURN jsonb_build_object('resultado', round(v_resultado, 2),
        'cuentas', (SELECT count(*) FROM public.saldos_iniciales WHERE anio = v_anio + 1),
        'productos', (SELECT count(*) FROM public.inventario_inicial WHERE anio = v_anio + 1));
END;
$$;
REVOKE ALL ON FUNCTION public.cerrar_ejercicio(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_ejercicio(JSONB) TO authenticated;

/** Reabre el último año cerrado (p. ej. para corregir algo antes de declarar): borra sus asientos de cierre y la foto del año siguiente. */
CREATE OR REPLACE FUNCTION public.reabrir_ejercicio(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_anio INT := (p->>'anio')::INT;
    v_motivo TEXT := btrim(coalesce(p->>'motivo', ''));
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño reabre el ejercicio' USING ERRCODE = '42501'; END IF;
    IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Indica el motivo de la reapertura'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ejercicios WHERE anio = v_anio AND estado = 'CERRADO') THEN RAISE EXCEPTION 'El ejercicio % no está cerrado', v_anio; END IF;
    IF EXISTS (SELECT 1 FROM public.ejercicios WHERE anio > v_anio AND estado = 'CERRADO') THEN RAISE EXCEPTION 'Reabre primero los ejercicios posteriores'; END IF;

    UPDATE public.ejercicios SET estado = 'ABIERTO',
        historial = historial || jsonb_build_array(jsonb_build_object('accion', 'REAPERTURA', 'fecha', now(), 'usuario', p->>'usuario', 'motivo', v_motivo))
     WHERE anio = v_anio;
    DELETE FROM public.asientos WHERE origen = 'CIERRE' AND origen_id IN (v_anio::TEXT, v_anio || '-T'); -- resultado y traslado
    DELETE FROM public.saldos_iniciales WHERE anio = v_anio + 1;
    DELETE FROM public.inventario_inicial WHERE anio = v_anio + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.reabrir_ejercicio(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_ejercicio(JSONB) TO authenticated;

-- ---------- Borrar datos de prueba ----------
/**
  Deja la empresa lista para empezar: borra ventas, compras, Kardex, caja, gastos, pedidos, asientos,
  clientes y solicitudes. Conserva la empresa, series, plan de cuentas, usuarios, tienda, tarifas,
  jardineros y la ficha de los productos (con stock en cero).
  Se bloquea cuando ya se opera de verdad: un ejercicio cerrado o un comprobante con número SUNAT.
*/
CREATE OR REPLACE FUNCTION public.borrar_datos_prueba(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_ruc TEXT := (SELECT ruc FROM public.empresa_config LIMIT 1);
BEGIN
    IF NOT public.tiene_rol('{dueno}') THEN RAISE EXCEPTION 'Sólo el dueño puede borrar los datos' USING ERRCODE = '42501'; END IF;
    IF v_ruc IS NULL OR btrim(coalesce(p->>'ruc', '')) <> v_ruc THEN RAISE EXCEPTION 'Escribe el RUC de la empresa para confirmar'; END IF;
    IF EXISTS (SELECT 1 FROM public.ejercicios WHERE estado = 'CERRADO') THEN
        RAISE EXCEPTION 'Ya hay un ejercicio cerrado: los libros deben conservarse y no se pueden borrar';
    END IF;
    IF EXISTS (SELECT 1 FROM public.comprobantes WHERE numero_sunat IS NOT NULL) THEN
        RAISE EXCEPTION 'Ya hay comprobantes emitidos en SUNAT: son operaciones reales y no se pueden borrar';
    END IF;

    TRUNCATE public.asiento_lineas, public.asientos, public.bajas_biologicas, public.caja_movimientos, public.cliente_notas,
             public.clientes, public.compras, public.comprobantes, public.contratos, public.cotizaciones, public.detracciones,
             public.gastos, public.guias_remision, public.kardex_movimientos, public.partes_produccion, public.pedidos,
             public.pedidos_detalle, public.puntos_movimientos, public.servicios_jardineria, public.servicios_jardinero,
             public.servicios_materiales, public.solicitudes_tienda, public.tareas,
             public.ejercicios, public.saldos_iniciales, public.inventario_inicial
    RESTART IDENTITY;
    UPDATE public.productos SET stock_actual = 0, valor_inventario = 0, costo_promedio = 0;
    UPDATE public.cupones SET usos = 0;
END;
$$;
REVOKE ALL ON FUNCTION public.borrar_datos_prueba(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.borrar_datos_prueba(JSONB) TO authenticated;
