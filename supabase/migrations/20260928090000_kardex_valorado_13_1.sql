-- ========================================================
-- REGISTRO DE INVENTARIO PERMANENTE VALORADO (SUNAT · Formato 13.1)
-- Método de valuación: costo promedio ponderado.
-- - Cada movimiento guarda documento (Tabla 10), operación (Tabla 12), costo del movimiento y saldo valorizado.
-- - El cálculo lo hace la base en el trigger del Kardex, con la fila del producto bloqueada (FOR UPDATE):
--   dos ventas o compras simultáneas del mismo producto se ejecutan una tras otra y el saldo nunca se descuadra.
-- - Entrada por producción propia (doc. 00 · op. 19) consumiendo insumos (op. 10) en una sola transacción.
-- Se conservan las columnas anteriores (cantidad_entrada/salida, saldo_resultante, tipo_movimiento) porque
-- la app y las funciones de venta las usan; el trigger mantiene ambas en sincronía.
-- ========================================================

-- ---------- 1. Catálogos SUNAT ----------
CREATE TABLE IF NOT EXISTS public.sunat_tabla10 (codigo VARCHAR(2) PRIMARY KEY, descripcion TEXT NOT NULL);
INSERT INTO public.sunat_tabla10 (codigo, descripcion) VALUES
    ('00', 'Otros (parte de producción, nota de ingreso interna)'),
    ('01', 'Factura'),
    ('03', 'Boleta de venta'),
    ('07', 'Nota de crédito'),
    ('09', 'Guía de remisión remitente')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

CREATE TABLE IF NOT EXISTS public.sunat_tabla12 (codigo VARCHAR(2) PRIMARY KEY, descripcion TEXT NOT NULL);
INSERT INTO public.sunat_tabla12 (codigo, descripcion) VALUES
    ('01', 'Venta'),
    ('02', 'Compra'),
    ('05', 'Devolución recibida'),
    ('06', 'Devolución entregada'),
    ('10', 'Salida a producción'),
    ('13', 'Mermas'),
    ('14', 'Desmedros'),
    ('16', 'Saldo inicial'),
    ('19', 'Entrada de producción'),
    ('28', 'Ajuste por diferencia de inventario'),
    ('99', 'Otros')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

ALTER TABLE public.sunat_tabla10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunat_tabla12 ENABLE ROW LEVEL SECURITY;
CREATE POLICY tabla10_leer ON public.sunat_tabla10 FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY tabla12_leer ON public.sunat_tabla12 FOR SELECT TO authenticated USING (TRUE);

-- ---------- 2. Productos: stock con decimales y saldo valorizado ----------
ALTER TABLE public.productos
    ALTER COLUMN stock_actual TYPE NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS valor_inventario NUMERIC(12,4) NOT NULL DEFAULT 0,  -- saldo costo total
    ADD COLUMN IF NOT EXISTS costo_promedio NUMERIC(12,4) NOT NULL DEFAULT 0,    -- saldo costo unitario
    ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(3) NOT NULL DEFAULT 'NIU',    -- SUNAT Tabla 6 (NIU = unidad, KGM = kilo…)
    ADD COLUMN IF NOT EXISTS tipo_existencia VARCHAR(2) NOT NULL DEFAULT '01';   -- SUNAT Tabla 5 (01 mercadería, 02 producto terminado, 03 materia prima…)

-- ---------- 3. Kardex: campos del Formato 13.1 ----------
ALTER TABLE public.kardex_movimientos
    ALTER COLUMN cantidad_entrada TYPE NUMERIC(12,4),
    ALTER COLUMN cantidad_salida TYPE NUMERIC(12,4),
    ALTER COLUMN saldo_resultante TYPE NUMERIC(12,4),
    ALTER COLUMN costo_unitario TYPE NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS fecha_emision DATE,
    ADD COLUMN IF NOT EXISTS sunat_tipo_comprobante VARCHAR(2) REFERENCES public.sunat_tabla10(codigo),
    ADD COLUMN IF NOT EXISTS comprobante_serie VARCHAR(4) NOT NULL DEFAULT '0000',
    ADD COLUMN IF NOT EXISTS comprobante_numero VARCHAR(8),
    ADD COLUMN IF NOT EXISTS sunat_tipo_operacion VARCHAR(2) REFERENCES public.sunat_tabla12(codigo),
    ADD COLUMN IF NOT EXISTS movimiento VARCHAR(7) CHECK (movimiento IN ('ENTRADA', 'SALIDA')),
    ADD COLUMN IF NOT EXISTS cantidad NUMERIC(12,4) CHECK (cantidad > 0),
    ADD COLUMN IF NOT EXISTS costo_total NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS saldo_cantidad NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS saldo_costo_unitario NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS saldo_costo_total NUMERIC(12,4);
CREATE INDEX IF NOT EXISTS kardex_producto_fecha_idx ON public.kardex_movimientos (producto_sku, fecha_emision, id);

-- ---------- 4. Códigos SUNAT a partir del concepto y del documento ----------
CREATE OR REPLACE FUNCTION public.kardex_codigos(p_tipo TEXT, p_doc TEXT, OUT tipo_comprobante TEXT, OUT tipo_operacion TEXT, OUT serie TEXT, OUT numero TEXT)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
    v_doc TEXT := upper(coalesce(p_doc, ''));
    v_baja TEXT;
BEGIN
    tipo_operacion := CASE p_tipo
        WHEN 'Compra Proveedor' THEN '02'
        WHEN 'Venta Cliente' THEN '01'
        WHEN 'Devolucion Cliente' THEN '05'
        WHEN 'Entrada por Produccion' THEN '19'
        WHEN 'Salida a Produccion' THEN '10'
        WHEN 'Ajuste Inventario' THEN CASE WHEN v_doc = 'INV-INICIAL' THEN '16' ELSE '28' END
        ELSE '99' END;
    IF p_tipo = 'Baja por Perdida' THEN
        SELECT tipo INTO v_baja FROM public.bajas_biologicas WHERE id = p_doc;
        tipo_operacion := CASE WHEN v_baja IN ('DESMEDRO_PLAGA', 'ROTURA_MECANICA') THEN '14' ELSE '13' END;
    END IF;

    -- Documento: SERIE-NÚMERO de un comprobante o guía; cualquier otro soporte es interno ('00')
    IF v_doc ~ '^[A-Z0-9]{1,4}-[0-9]{1,8}$' THEN
        serie := split_part(v_doc, '-', 1);
        numero := lpad(split_part(v_doc, '-', 2), 8, '0');
        tipo_comprobante := CASE
            WHEN tipo_operacion = '05' THEN '07'
            WHEN p_tipo = 'Compra Proveedor' THEN '01'
            WHEN serie LIKE 'T%' THEN '09'
            WHEN serie LIKE 'F%' THEN '01'
            WHEN serie LIKE 'B%' THEN '03'
            ELSE '00' END;
    ELSE
        tipo_comprobante := CASE WHEN p_tipo = 'Compra Proveedor' AND v_doc <> '' THEN '01' ELSE '00' END;
        serie := '0000';
        numero := right(lpad(regexp_replace(v_doc, '[^A-Z0-9]', '', 'g'), 8, '0'), 8);
    END IF;
END;
$$;

-- ---------- 5. Motor de saldos (costo promedio ponderado) ----------
CREATE OR REPLACE FUNCTION public.aplicar_movimiento_kardex()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_prev_cant NUMERIC(12,4);
    v_prev_valor NUMERIC(12,4);
    v_prev_prom NUMERIC(12,4);
    v_cant NUMERIC(12,4);
    v_cu NUMERIC(12,4);
    v_ct NUMERIC(12,4);
    v_saldo_cant NUMERIC(12,4);
    v_saldo_valor NUMERIC(12,4);
    v_saldo_cu NUMERIC(12,4);
    v_cod RECORD;
BEGIN
    -- Sentido y cantidad: acepta el formato nuevo (movimiento + cantidad) o el anterior (entrada/salida)
    IF NEW.movimiento IS NULL THEN
        NEW.movimiento := CASE WHEN coalesce(NEW.cantidad_entrada, 0) > 0 THEN 'ENTRADA' ELSE 'SALIDA' END;
    END IF;
    v_cant := coalesce(NEW.cantidad, CASE WHEN NEW.movimiento = 'ENTRADA' THEN NEW.cantidad_entrada ELSE NEW.cantidad_salida END);
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'La cantidad del movimiento debe ser mayor a cero'; END IF;

    -- Bloquea el producto: los movimientos simultáneos del mismo producto se aplican en orden
    SELECT stock_actual, valor_inventario, costo_promedio INTO v_prev_cant, v_prev_valor, v_prev_prom
      FROM public.productos WHERE sku = NEW.producto_sku FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producto % no existe', NEW.producto_sku; END IF;
    -- Costo promedio vigente (con saldo cero se conserva el último promedio conocido)
    v_prev_prom := CASE WHEN v_prev_cant > 0 THEN round(v_prev_valor / v_prev_cant, 4) ELSE v_prev_prom END;

    IF NEW.movimiento = 'ENTRADA' THEN
        v_cu := round(coalesce(NEW.costo_unitario, v_prev_prom), 4); -- p. ej. una devolución sin costo entra al promedio
        IF v_cu < 0 THEN RAISE EXCEPTION 'El costo unitario no puede ser negativo'; END IF;
        v_ct := round(v_cant * v_cu, 4);
        v_saldo_cant := v_prev_cant + v_cant;
        v_saldo_valor := v_prev_valor + v_ct;
        v_saldo_cu := CASE WHEN v_saldo_cant > 0 THEN round(v_saldo_valor / v_saldo_cant, 4) ELSE v_cu END;
    ELSE
        IF v_prev_cant < v_cant THEN
            RAISE EXCEPTION 'productos_stock_actual_check: stock insuficiente de % (hay %, se piden %)', NEW.producto_sku, v_prev_cant, v_cant;
        END IF;
        v_cu := v_prev_prom; -- toda salida se valoriza al costo promedio vigente
        v_ct := round(v_cant * v_cu, 4);
        v_saldo_cant := v_prev_cant - v_cant;
        v_saldo_valor := CASE WHEN v_saldo_cant = 0 THEN 0 ELSE GREATEST(v_prev_valor - v_ct, 0) END;
        v_saldo_cu := v_prev_prom;
    END IF;

    NEW.cantidad := v_cant;
    NEW.cantidad_entrada := CASE WHEN NEW.movimiento = 'ENTRADA' THEN v_cant ELSE 0 END;
    NEW.cantidad_salida := CASE WHEN NEW.movimiento = 'SALIDA' THEN v_cant ELSE 0 END;
    NEW.costo_unitario := v_cu;
    NEW.costo_total := v_ct;
    NEW.saldo_cantidad := v_saldo_cant;
    NEW.saldo_costo_total := v_saldo_valor;
    NEW.saldo_costo_unitario := v_saldo_cu;
    NEW.saldo_resultante := v_saldo_cant;
    NEW.fecha_emision := coalesce(NEW.fecha_emision, (coalesce(NEW.fecha, now()) AT TIME ZONE 'America/Lima')::DATE);

    SELECT * INTO v_cod FROM public.kardex_codigos(NEW.tipo_movimiento, NEW.documento_referencia);
    NEW.sunat_tipo_operacion := coalesce(NEW.sunat_tipo_operacion, v_cod.tipo_operacion);
    NEW.sunat_tipo_comprobante := coalesce(NEW.sunat_tipo_comprobante, v_cod.tipo_comprobante);
    IF NEW.comprobante_numero IS NULL THEN
        NEW.comprobante_serie := v_cod.serie;
        NEW.comprobante_numero := v_cod.numero;
    END IF;

    UPDATE public.productos
       SET stock_actual = v_saldo_cant, valor_inventario = v_saldo_valor, costo_promedio = v_saldo_cu
     WHERE sku = NEW.producto_sku;
    RETURN NEW;
END;
$$;
-- (el trigger al_registrar_kardex ya apunta a esta función)

-- ---------- 6. Recalcular el historial existente con el mismo método ----------
CREATE OR REPLACE FUNCTION public.recalcular_kardex(p_sku TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r RECORD;
    v_cant NUMERIC(12,4) := 0;
    v_valor NUMERIC(12,4) := 0;
    v_prom NUMERIC(12,4) := 0;
    v_q NUMERIC(12,4);
    v_cu NUMERIC(12,4);
    v_ct NUMERIC(12,4);
    v_cod RECORD;
BEGIN
    PERFORM 1 FROM public.productos WHERE sku = p_sku FOR UPDATE;
    FOR r IN SELECT * FROM public.kardex_movimientos WHERE producto_sku = p_sku ORDER BY coalesce(fecha_emision, fecha::DATE), id LOOP
        v_q := CASE WHEN coalesce(r.cantidad_entrada, 0) > 0 THEN r.cantidad_entrada ELSE r.cantidad_salida END;
        IF v_q IS NULL OR v_q <= 0 THEN CONTINUE; END IF;
        IF coalesce(r.cantidad_entrada, 0) > 0 THEN
            v_cu := round(coalesce(r.costo_unitario, v_prom), 4);
            v_ct := round(v_q * v_cu, 4);
            v_cant := v_cant + v_q;
            v_valor := v_valor + v_ct;
            v_prom := CASE WHEN v_cant > 0 THEN round(v_valor / v_cant, 4) ELSE v_cu END;
        ELSE
            v_cu := v_prom;
            v_ct := round(v_q * v_cu, 4);
            v_cant := v_cant - v_q;
            v_valor := CASE WHEN v_cant <= 0 THEN 0 ELSE GREATEST(v_valor - v_ct, 0) END;
        END IF;
        SELECT * INTO v_cod FROM public.kardex_codigos(r.tipo_movimiento, r.documento_referencia);
        UPDATE public.kardex_movimientos
           SET movimiento = CASE WHEN coalesce(r.cantidad_entrada, 0) > 0 THEN 'ENTRADA' ELSE 'SALIDA' END,
               cantidad = v_q, costo_unitario = v_cu, costo_total = v_ct,
               saldo_cantidad = v_cant, saldo_costo_unitario = v_prom, saldo_costo_total = v_valor, saldo_resultante = v_cant,
               fecha_emision = coalesce(r.fecha_emision, (r.fecha AT TIME ZONE 'America/Lima')::DATE),
               sunat_tipo_operacion = coalesce(r.sunat_tipo_operacion, v_cod.tipo_operacion),
               sunat_tipo_comprobante = coalesce(r.sunat_tipo_comprobante, v_cod.tipo_comprobante),
               comprobante_serie = CASE WHEN r.comprobante_numero IS NULL THEN v_cod.serie ELSE r.comprobante_serie END,
               comprobante_numero = coalesce(r.comprobante_numero, v_cod.numero)
         WHERE id = r.id;
    END LOOP;
    UPDATE public.productos SET stock_actual = GREATEST(v_cant, 0), valor_inventario = v_valor, costo_promedio = v_prom WHERE sku = p_sku;
END;
$$;
REVOKE ALL ON FUNCTION public.recalcular_kardex(TEXT) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE s TEXT;
BEGIN
    FOR s IN SELECT sku FROM public.productos LOOP PERFORM public.recalcular_kardex(s); END LOOP;
END $$;

-- ---------- 7. Producción propia: parte de producción (doc. 00) ----------
CREATE SEQUENCE IF NOT EXISTS public.partes_produccion_seq;
CREATE TABLE IF NOT EXISTS public.partes_produccion (
    numero VARCHAR(8) PRIMARY KEY,
    fecha DATE NOT NULL,
    producto_sku VARCHAR(30) NOT NULL REFERENCES public.productos(sku),
    cantidad NUMERIC(12,4) NOT NULL CHECK (cantidad > 0),
    costo_insumos NUMERIC(12,4) NOT NULL DEFAULT 0,
    costo_adicional NUMERIC(12,4) NOT NULL DEFAULT 0, -- mano de obra, agua, energía… (cálculo manual)
    costo_unitario NUMERIC(12,4) NOT NULL,
    insumos JSONB NOT NULL DEFAULT '[]',
    notas TEXT,
    responsable VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.partes_produccion ENABLE ROW LEVEL SECURITY;
CREATE POLICY partes_leer ON public.partes_produccion FOR SELECT TO authenticated USING (public.tiene_rol('{dueno,jardinero}'));

/**
  Registra una producción propia en UNA transacción:
  - salida de cada insumo (op. 10 · doc. 00) valorizada al costo promedio vigente;
  - entrada del producto terminado (op. 19 · doc. 00) con costo = (insumos + costo adicional) / cantidad.
  Si algo falla (p. ej. falta insumo), no se registra nada.
*/
CREATE OR REPLACE FUNCTION public.registrar_produccion(p JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_sku TEXT := p->>'producto_sku';
    v_cant NUMERIC(12,4) := (p->>'cantidad')::NUMERIC;
    v_adic NUMERIC(12,4) := round(coalesce((p->>'costo_adicional')::NUMERIC, 0), 4);
    v_fecha DATE := coalesce((p->>'fecha')::DATE, (now() AT TIME ZONE 'America/Lima')::DATE);
    v_resp TEXT := coalesce(NULLIF(btrim(p->>'responsable'), ''), 'Producción');
    v_num TEXT;
    v_insumos NUMERIC(12,4) := 0;
    v_cu NUMERIC(12,4);
    it JSONB;
    v_ct NUMERIC(12,4);
BEGIN
    IF NOT public.tiene_rol('{dueno,jardinero}') THEN RAISE EXCEPTION 'Tu rol no puede registrar producción' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.productos WHERE sku = v_sku) THEN RAISE EXCEPTION 'Producto % no existe', v_sku; END IF;
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'La cantidad producida debe ser mayor a cero'; END IF;
    IF v_adic < 0 THEN RAISE EXCEPTION 'El costo adicional no puede ser negativo'; END IF;
    IF jsonb_array_length(coalesce(p->'insumos', '[]')) = 0 AND v_adic = 0 THEN
        RAISE EXCEPTION 'Indica los insumos usados o el costo de producción';
    END IF;

    v_num := lpad(nextval('public.partes_produccion_seq')::TEXT, 8, '0');

    FOR it IN SELECT * FROM jsonb_array_elements(coalesce(p->'insumos', '[]')) LOOP
        IF it->>'sku' = v_sku THEN RAISE EXCEPTION 'Un producto no puede ser insumo de sí mismo'; END IF;
        IF coalesce((it->>'cantidad')::NUMERIC, 0) <= 0 THEN RAISE EXCEPTION 'Cantidad de insumo inválida'; END IF;
        INSERT INTO public.kardex_movimientos (producto_sku, tipo_movimiento, movimiento, cantidad, saldo_resultante,
            documento_referencia, usuario_responsable, fecha_emision, sunat_tipo_comprobante, comprobante_serie, comprobante_numero, sunat_tipo_operacion)
        VALUES (it->>'sku', 'Salida a Produccion', 'SALIDA', (it->>'cantidad')::NUMERIC, 0,
            'PP-' || v_num, v_resp, v_fecha, '00', '0000', v_num, '10')
        RETURNING costo_total INTO v_ct;
        v_insumos := v_insumos + v_ct;
    END LOOP;

    v_cu := round((v_insumos + v_adic) / v_cant, 4);
    INSERT INTO public.kardex_movimientos (producto_sku, tipo_movimiento, movimiento, cantidad, costo_unitario, saldo_resultante,
        documento_referencia, usuario_responsable, fecha_emision, sunat_tipo_comprobante, comprobante_serie, comprobante_numero, sunat_tipo_operacion)
    VALUES (v_sku, 'Entrada por Produccion', 'ENTRADA', v_cant, v_cu, 0,
        'PP-' || v_num, v_resp, v_fecha, '00', '0000', v_num, '19');

    INSERT INTO public.partes_produccion (numero, fecha, producto_sku, cantidad, costo_insumos, costo_adicional, costo_unitario, insumos, notas, responsable)
    VALUES (v_num, v_fecha, v_sku, v_cant, v_insumos, v_adic, v_cu, coalesce(p->'insumos', '[]'), NULLIF(btrim(p->>'notas'), ''), v_resp);

    RETURN jsonb_build_object('numero', v_num, 'costo_insumos', v_insumos, 'costo_unitario', v_cu);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_produccion(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_produccion(JSONB) TO authenticated;

-- ---------- 8. Saldos al inicio de un periodo (para el libro 13.1) ----------
CREATE OR REPLACE FUNCTION public.kardex_saldos_al(p_fecha DATE)
RETURNS TABLE (producto_sku VARCHAR, saldo_cantidad NUMERIC, saldo_costo_unitario NUMERIC, saldo_costo_total NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT DISTINCT ON (k.producto_sku) k.producto_sku, k.saldo_cantidad, k.saldo_costo_unitario, k.saldo_costo_total
    FROM public.kardex_movimientos k
    WHERE k.fecha_emision < p_fecha
    ORDER BY k.producto_sku, k.fecha_emision DESC, k.id DESC;
$$;
GRANT EXECUTE ON FUNCTION public.kardex_saldos_al(DATE) TO authenticated;

-- ---------- 9. El catálogo público muestra unidades enteras ----------
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
           floor(GREATEST(p.stock_actual, 0))::INT,
           p.cuidado_luz, p.cuidado_riego, p.es_planta_viva, p.destacado
    FROM public.productos p
    WHERE p.activo AND p.visible_tienda
    ORDER BY p.destacado DESC, p.nombre;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico() TO anon, authenticated;
