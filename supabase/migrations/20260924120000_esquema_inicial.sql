-- ========================================================
-- AUREVIA / VIVERO 360° — ESQUEMA INICIAL (PostgreSQL / Supabase)
-- Roles: dueno (todo), vendedor (ventas, clientes, caja, almacén), jardinero (servicios e insumos).
-- Toda tabla tiene RLS: con la llave pública (anon) y sin sesión no se puede leer ni escribir nada.
-- ========================================================

-- --------------------------------------------------------
-- USUARIOS Y ROLES
-- --------------------------------------------------------
CREATE TYPE public.rol_usuario AS ENUM ('dueno', 'vendedor', 'jardinero');

CREATE TABLE public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT,
    email TEXT,
    rol public.rol_usuario, -- NULL = sin acceso hasta que el dueño asigne un rol
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Cada usuario nuevo de Auth recibe un perfil sin rol
CREATE FUNCTION public.crear_perfil_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.perfiles (id, email, nombre)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$;

CREATE TRIGGER al_crear_usuario
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

CREATE FUNCTION public.mi_rol()
RETURNS public.rol_usuario LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;

CREATE FUNCTION public.tiene_rol(roles public.rol_usuario[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(public.mi_rol() = ANY(roles), FALSE)
$$;

-- --------------------------------------------------------
-- 1. ZONAS DE ALMACÉN
-- --------------------------------------------------------
CREATE TABLE public.almacenes_zonas (
    id VARCHAR(10) PRIMARY KEY, -- 'ZONA-A' … 'ZONA-E'
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_almacenamiento VARCHAR(50)
);

-- --------------------------------------------------------
-- 2. CLIENTES (CRM)
-- --------------------------------------------------------
CREATE TABLE public.clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo_doc VARCHAR(1),                 -- '1' DNI | '6' RUC
    num_doc VARCHAR(11),
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    direccion TEXT,
    distrito VARCHAR(80),
    canal_origen VARCHAR(50) DEFAULT 'Directo / Vivero', -- 'Instagram Ads', 'Facebook Ads', 'TikTok Ads', 'Google'
    preferencias_botanicas TEXT,
    total_pedidos INT DEFAULT 0,
    monto_acumulado NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 3. PRODUCTOS Y PLANTAS VIVAS
-- --------------------------------------------------------
CREATE TABLE public.productos (
    sku VARCHAR(30) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nombre_cientifico VARCHAR(150),
    categoria VARCHAR(50) NOT NULL,
    zona_id VARCHAR(10) REFERENCES public.almacenes_zonas(id),
    ubicacion_estante VARCHAR(50),
    costo_unitario NUMERIC(10,2) NOT NULL,
    precio_venta NUMERIC(10,2) NOT NULL,
    stock_actual INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INT NOT NULL DEFAULT 5,
    cuidado_luz VARCHAR(100),
    cuidado_riego VARCHAR(100),
    es_planta_viva BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 4. KARDEX CENTRAL (registro inmutable: sólo se inserta)
-- --------------------------------------------------------
CREATE TABLE public.kardex_movimientos (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ DEFAULT now(),
    producto_sku VARCHAR(30) NOT NULL REFERENCES public.productos(sku),
    tipo_movimiento VARCHAR(80) NOT NULL,
    -- 'Compra Proveedor', 'Venta Cliente', 'Servicio Jardineria', 'Baja por Perdida', 'Ajuste Inventario', 'Devolucion Cliente'
    cantidad_entrada INT DEFAULT 0 CHECK (cantidad_entrada >= 0),
    cantidad_salida INT DEFAULT 0 CHECK (cantidad_salida >= 0),
    saldo_resultante INT NOT NULL,
    costo_unitario NUMERIC(10,2),
    documento_referencia VARCHAR(50),
    usuario_responsable VARCHAR(100) NOT NULL,
    usuario_id UUID DEFAULT auth.uid() REFERENCES auth.users(id)
);

-- El stock del producto lo mueve sólo el Kardex: nadie actualiza productos.stock_actual a mano.
-- El saldo se recalcula en el servidor para que dos cajas a la vez no pisen el stock.
CREATE FUNCTION public.aplicar_movimiento_kardex()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    nuevo_saldo INT;
BEGIN
    UPDATE public.productos
       SET stock_actual = stock_actual + NEW.cantidad_entrada - NEW.cantidad_salida
     WHERE sku = NEW.producto_sku
    RETURNING stock_actual INTO nuevo_saldo;

    IF nuevo_saldo IS NULL THEN
        RAISE EXCEPTION 'Producto % no existe', NEW.producto_sku;
    END IF;
    NEW.saldo_resultante := nuevo_saldo;
    RETURN NEW;
END;
$$;

CREATE TRIGGER al_registrar_kardex
    BEFORE INSERT ON public.kardex_movimientos
    FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimiento_kardex();

-- --------------------------------------------------------
-- 5-6. PEDIDOS (ventas por redes / delivery)
-- --------------------------------------------------------
CREATE TABLE public.pedidos (
    id VARCHAR(20) PRIMARY KEY, -- '#000125'
    cliente_id INT REFERENCES public.clientes(id),
    canal_venta VARCHAR(50) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente','pagado','preparando','en-reparto','entregado'
    metodo_pago VARCHAR(50) NOT NULL,                -- 'Yape','Plin','Efectivo','Tarjeta','Transferencia'
    subtotal NUMERIC(10,2) NOT NULL,
    costo_delivery NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL,
    repartidor_asignado VARCHAR(100),
    foto_evidencia_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pedidos_detalle (
    id SERIAL PRIMARY KEY,
    pedido_id VARCHAR(20) REFERENCES public.pedidos(id) ON DELETE CASCADE,
    producto_sku VARCHAR(30) REFERENCES public.productos(sku),
    cantidad INT NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL
);

-- --------------------------------------------------------
-- 7-8. SERVICIOS DE JARDINERÍA
-- --------------------------------------------------------
CREATE TABLE public.servicios_jardineria (
    id VARCHAR(20) PRIMARY KEY, -- 'JAR-2026-001'
    cliente_id INT REFERENCES public.clientes(id),
    tipo_servicio VARCHAR(100) NOT NULL,
    direccion TEXT,
    fecha_programada TIMESTAMPTZ NOT NULL,
    personal_asignado VARCHAR(150),
    horas_mano_obra NUMERIC(6,2) DEFAULT 0,
    tarifa_hora NUMERIC(10,2) DEFAULT 0,
    precio_servicio NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'COTIZADO'
        CHECK (estado IN ('COTIZADO', 'APROBADO', 'EN_EJECUCION', 'CONCLUIDO')),
    stock_descontado BOOLEAN DEFAULT FALSE,
    comprobante_id VARCHAR(20)
);

CREATE TABLE public.servicios_materiales (
    id SERIAL PRIMARY KEY,
    servicio_id VARCHAR(20) REFERENCES public.servicios_jardineria(id) ON DELETE CASCADE,
    producto_sku VARCHAR(30) REFERENCES public.productos(sku),
    cantidad_utilizada INT NOT NULL,
    precio_unitario NUMERIC(10,2)
);

-- --------------------------------------------------------
-- 9. CONFIGURACIÓN FISCAL (ViveroApi.saveCompanyConfig)
-- La Clave SOL y el certificado NO se guardan aquí: van como secretos de una Edge Function.
-- --------------------------------------------------------
CREATE TABLE public.empresa_config (
    id VARCHAR(11) PRIMARY KEY, -- = RUC
    ruc VARCHAR(11) NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    nombre_comercial VARCHAR(200),
    direccion TEXT,
    ubigeo VARCHAR(6),
    sunat_ambiente VARCHAR(12) DEFAULT 'BETA', -- 'BETA' | 'PRODUCCION'
    serie_boleta VARCHAR(4),
    serie_factura VARCHAR(4),
    serie_gre VARCHAR(4),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 10. COMPROBANTES ELECTRÓNICOS (ViveroApi.upsertComprobante)
-- --------------------------------------------------------
CREATE TABLE public.comprobantes (
    id VARCHAR(20) PRIMARY KEY, -- 'B001-00000342'
    tipo_comprobante VARCHAR(2) NOT NULL, -- '01' Factura | '03' Boleta
    serie VARCHAR(4) NOT NULL,
    correlativo INT NOT NULL,
    fecha_emision DATE NOT NULL,
    cliente VARCHAR(200) NOT NULL,
    cliente_id INT REFERENCES public.clientes(id),
    pedido_id VARCHAR(20) REFERENCES public.pedidos(id),
    servicio_id VARCHAR(20) REFERENCES public.servicios_jardineria(id),
    op_gravadas NUMERIC(12,2) NOT NULL,
    total_igv NUMERIC(12,2) NOT NULL,
    monto_total NUMERIC(12,2) NOT NULL,
    estado_sunat VARCHAR(20),
    hash_cpe TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (serie, correlativo)
);

ALTER TABLE public.servicios_jardineria
    ADD CONSTRAINT servicios_comprobante_fk FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes(id);

-- --------------------------------------------------------
-- 11. COMPRAS A PROVEEDORES (Registro de Compras / SIRE RCE)
-- --------------------------------------------------------
CREATE TABLE public.compras (
    id VARCHAR(20) PRIMARY KEY, -- N° factura del proveedor
    proveedor_ruc VARCHAR(11) NOT NULL,
    proveedor_razon_social VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    gravada NUMERIC(12,2) NOT NULL,
    igv NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    detalle TEXT
);

-- --------------------------------------------------------
-- 12. DETRACCIONES SPOT
-- --------------------------------------------------------
CREATE TABLE public.detracciones (
    id VARCHAR(20) PRIMARY KEY,
    comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),
    fecha_vencimiento_bn DATE NOT NULL, -- 5to día hábil del mes siguiente
    tasa NUMERIC(5,4) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'DEPOSITADO')),
    constancia_bn VARCHAR(30),
    fecha_deposito DATE
);

-- --------------------------------------------------------
-- 13. BAJAS BIOLÓGICAS (mermas, desmedros, cuarentena)
-- --------------------------------------------------------
CREATE TABLE public.bajas_biologicas (
    id VARCHAR(20) PRIMARY KEY,
    producto_sku VARCHAR(30) REFERENCES public.productos(sku),
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('MERMA_NATURAL', 'DESMEDRO_PLAGA', 'CUARENTENA_FITOSANITARIA', 'ROTURA_MECANICA')),
    cantidad INT NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    motivo TEXT,
    estado VARCHAR(25) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE
);

-- --------------------------------------------------------
-- 14. CAJA DIARIA
-- --------------------------------------------------------
CREATE TABLE public.caja_movimientos (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ DEFAULT now(),
    tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('APERTURA', 'INGRESO', 'EGRESO', 'CIERRE')),
    medio_pago VARCHAR(20), -- 'Efectivo' | 'Yape' | 'Tarjeta' | 'Transferencia'
    monto NUMERIC(10,2) NOT NULL,
    concepto TEXT,
    comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),
    responsable VARCHAR(100) NOT NULL,
    usuario_id UUID DEFAULT auth.uid() REFERENCES auth.users(id)
);

-- ========================================================
-- SEGURIDAD: RLS POR ROL
-- ========================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacenes_zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kardex_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_jardineria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_materiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detracciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bajas_biologicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caja_movimientos ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada uno ve el suyo; el dueño ve y asigna roles a todos
CREATE POLICY perfiles_leer ON public.perfiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.tiene_rol('{dueno}'));
CREATE POLICY perfiles_dueno_edita ON public.perfiles FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Catálogo: todo el personal lo ve; sólo el dueño lo edita (el stock lo mueve el Kardex)
CREATE POLICY zonas_leer ON public.almacenes_zonas FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY zonas_dueno ON public.almacenes_zonas FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));
CREATE POLICY productos_leer ON public.productos FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY productos_dueno ON public.productos FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Kardex: todos leen e insertan (venta, servicio, merma); nadie edita ni borra
CREATE POLICY kardex_leer ON public.kardex_movimientos FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY kardex_insertar ON public.kardex_movimientos FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));

-- Clientes: dueño y vendedor gestionan; el jardinero sólo consulta (dirección, teléfono)
CREATE POLICY clientes_leer ON public.clientes FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY clientes_gestionar ON public.clientes FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));

-- Ventas, comprobantes, compras y caja: dueño y vendedor
CREATE POLICY pedidos_ventas ON public.pedidos FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY pedidos_detalle_ventas ON public.pedidos_detalle FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY comprobantes_leer ON public.comprobantes FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY comprobantes_emitir ON public.comprobantes FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY comprobantes_actualizar_cdr ON public.comprobantes FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY compras_almacen ON public.compras FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY caja_ventas ON public.caja_movimientos FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));

-- Servicios: todos ven y actualizan avance; crear/cotizar es de dueño y vendedor
CREATE POLICY servicios_leer ON public.servicios_jardineria FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY servicios_crear ON public.servicios_jardineria FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY servicios_avanzar ON public.servicios_jardineria FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}')) WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY servicios_borrar ON public.servicios_jardineria FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));
CREATE POLICY materiales_leer ON public.servicios_materiales FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY materiales_registrar ON public.servicios_materiales FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));

-- Mermas: cualquiera del vivero puede reportar; sólo el dueño corrige
CREATE POLICY bajas_leer ON public.bajas_biologicas FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY bajas_reportar ON public.bajas_biologicas FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY bajas_dueno ON public.bajas_biologicas FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Configuración fiscal: el personal de ventas la lee para emitir; sólo el dueño la cambia
CREATE POLICY empresa_leer ON public.empresa_config FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY empresa_dueno ON public.empresa_config FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Detracciones: sólo el dueño
CREATE POLICY detracciones_dueno ON public.detracciones FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));
