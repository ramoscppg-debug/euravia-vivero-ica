-- ========================================================
-- ESQUEMA DE BASE DE DATOS: VIVERO 360° (PostgreSQL)
-- ========================================================

-- 1. ZONAS DE ALMACÉN
CREATE TABLE IF NOT EXISTS almacenes_zonas (
    id VARCHAR(10) PRIMARY KEY, -- 'ZONA-A', 'ZONA-B', 'ZONA-C', 'ZONA-D', 'ZONA-E'
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_almacenamiento VARCHAR(50)
);

-- 2. TABLA DE CLIENTES Y CRM
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    direccion TEXT,
    distrito VARCHAR(80),
    canal_origen VARCHAR(50) DEFAULT 'Directo / Vivero', -- 'Instagram Ads', 'Facebook Ads', 'TikTok Ads', 'Google'
    preferencias_botanicas TEXT,
    total_pedidos INT DEFAULT 0,
    monto_acumulado NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PRODUCTOS Y PLANTAS VIVAS
CREATE TABLE IF NOT EXISTS productos (
    sku VARCHAR(30) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nombre_cientifico VARCHAR(150),
    categoria VARCHAR(50) NOT NULL, -- 'interior', 'exterior', 'suculentas', 'macetas', 'fertilizantes'
    zona_id VARCHAR(10) REFERENCES almacenes_zonas(id),
    ubicacion_estante VARCHAR(50), -- 'Estante 03'
    costo_unitario NUMERIC(10,2) NOT NULL,
    precio_venta NUMERIC(10,2) NOT NULL,
    stock_actual INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 5,
    cuidado_luz VARCHAR(100),
    cuidado_riego VARCHAR(100),
    es_planta_viva BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. KARDEX CENTRAL DE MOVIMIENTOS
CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    producto_sku VARCHAR(30) REFERENCES productos(sku),
    tipo_movimiento VARCHAR(80) NOT NULL, 
    -- 'Compra Proveedor', 'Venta Cliente', 'Servicio Jardinería', 'Baja por Pérdida', 'Ajuste Inventario'
    cantidad_entrada INT DEFAULT 0,
    cantidad_salida INT DEFAULT 0,
    saldo_resultante INT NOT NULL,
    costo_unitario NUMERIC(10,2),
    documento_referencia VARCHAR(50),
    usuario_responsable VARCHAR(100) NOT NULL
);

-- 5. PEDIDOS Y VENTAS
CREATE TABLE IF NOT EXISTS pedidos (
    id VARCHAR(20) PRIMARY KEY, -- '#000125'
    cliente_id INT REFERENCES clientes(id),
    canal_venta VARCHAR(50) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'pagado', 'preparando', 'en-reparto', 'entregado'
    metodo_pago VARCHAR(50) NOT NULL, -- 'Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia'
    subtotal NUMERIC(10,2) NOT NULL,
    costo_delivery NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL,
    repartidor_asignado VARCHAR(100),
    foto_evidencia_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DETALLE DE PEDIDOS
CREATE TABLE IF NOT EXISTS pedidos_detalle (
    id SERIAL PRIMARY KEY,
    pedido_id VARCHAR(20) REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_sku VARCHAR(30) REFERENCES productos(sku),
    cantidad INT NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL
);

-- 7. SERVICIOS DE JARDINERÍA
CREATE TABLE IF NOT EXISTS servicios_jardineria (
    id VARCHAR(20) PRIMARY KEY, -- 'SRV-001'
    cliente_id INT REFERENCES clientes(id),
    tipo_servicio VARCHAR(100) NOT NULL,
    fecha_programada TIMESTAMP NOT NULL,
    personal_asignado VARCHAR(150),
    precio_servicio NUMERIC(10,2) NOT NULL,
    estado VARCHAR(30) DEFAULT 'Programado'
);

-- 8. CONSUMO DE MATERIALES EN SERVICIOS (DESCUENTO EN KARDEX)
CREATE TABLE IF NOT EXISTS servicios_materiales (
    id SERIAL PRIMARY KEY,
    servicio_id VARCHAR(20) REFERENCES servicios_jardineria(id),
    producto_sku VARCHAR(30) REFERENCES productos(sku),
    cantidad_utilizada INT NOT NULL
);

-- ========================================================
-- AMPLIACIÓN PLAN A: tablas que el ERP ya usa (ViveroApi) o necesita para persistir todo el flujo
-- ========================================================

-- 9. CONFIGURACIÓN FISCAL DE LA EMPRESA (ViveroApi.saveCompanyConfig)
CREATE TABLE IF NOT EXISTS empresa_config (
    id VARCHAR(11) PRIMARY KEY,           -- = RUC
    ruc VARCHAR(11) NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    nombre_comercial VARCHAR(200),
    direccion TEXT,
    ubigeo VARCHAR(6),
    sunat_ambiente VARCHAR(12) DEFAULT 'BETA', -- 'BETA' | 'PRODUCCION'
    serie_boleta VARCHAR(4),
    serie_factura VARCHAR(4),
    serie_gre VARCHAR(4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- La Clave SOL y el certificado NO se guardan aquí: van en un secreto del servidor (Edge Function)
);

-- 10. COMPROBANTES ELECTRÓNICOS (ViveroApi.upsertComprobante)
CREATE TABLE IF NOT EXISTS comprobantes (
    id VARCHAR(20) PRIMARY KEY,           -- 'B001-00000342'
    tipo_comprobante VARCHAR(2) NOT NULL, -- '01' Factura | '03' Boleta
    serie VARCHAR(4) NOT NULL,
    correlativo INT NOT NULL,
    fecha_emision DATE NOT NULL,
    cliente VARCHAR(200) NOT NULL,
    cliente_id INT REFERENCES clientes(id),
    pedido_id VARCHAR(20) REFERENCES pedidos(id),
    servicio_id VARCHAR(20) REFERENCES servicios_jardineria(id),
    op_gravadas NUMERIC(12,2) NOT NULL,
    total_igv NUMERIC(12,2) NOT NULL,
    monto_total NUMERIC(12,2) NOT NULL,
    estado_sunat VARCHAR(20),
    hash_cpe TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (serie, correlativo)
);

-- 11. COMPRAS A PROVEEDORES (Registro de Compras / SIRE RCE)
CREATE TABLE IF NOT EXISTS compras (
    id VARCHAR(20) PRIMARY KEY,           -- N° factura del proveedor
    proveedor_ruc VARCHAR(11) NOT NULL,
    proveedor_razon_social VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    gravada NUMERIC(12,2) NOT NULL,
    igv NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    detalle TEXT
);

-- 12. DETRACCIONES SPOT
CREATE TABLE IF NOT EXISTS detracciones (
    id VARCHAR(20) PRIMARY KEY,
    comprobante_id VARCHAR(20) REFERENCES comprobantes(id),
    fecha_vencimiento_bn DATE NOT NULL,   -- 5to día hábil del mes siguiente
    tasa NUMERIC(5,4) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE' | 'DEPOSITADO'
    constancia_bn VARCHAR(30),
    fecha_deposito DATE
);

-- 13. BAJAS BIOLÓGICAS (mermas, desmedros, cuarentena)
CREATE TABLE IF NOT EXISTS bajas_biologicas (
    id VARCHAR(20) PRIMARY KEY,
    producto_sku VARCHAR(30) REFERENCES productos(sku),
    tipo VARCHAR(30) NOT NULL,
    cantidad INT NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    motivo TEXT,
    estado VARCHAR(25) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE
);

-- 14. CAJA DIARIA (apertura, cobros por medio de pago y egresos)
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo VARCHAR(12) NOT NULL,            -- 'APERTURA' | 'INGRESO' | 'EGRESO' | 'CIERRE'
    medio_pago VARCHAR(20),               -- 'Efectivo' | 'Yape' | 'Tarjeta' | 'Transferencia'
    monto NUMERIC(10,2) NOT NULL,
    concepto TEXT,
    comprobante_id VARCHAR(20) REFERENCES comprobantes(id),
    responsable VARCHAR(100) NOT NULL
);

-- 15. ETAPA Y FACTURA DE CADA SERVICIO (cotizado → aprobado → en ejecución → concluido)
ALTER TABLE servicios_jardineria ADD COLUMN IF NOT EXISTS stock_descontado BOOLEAN DEFAULT FALSE;
ALTER TABLE servicios_jardineria ADD COLUMN IF NOT EXISTS comprobante_id VARCHAR(20);
