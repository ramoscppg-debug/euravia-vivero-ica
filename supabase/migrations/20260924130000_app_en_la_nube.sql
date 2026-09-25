-- ========================================================
-- APP EN LA NUBE: columnas para que la app lea y escriba todo su flujo en Supabase
-- ========================================================

-- Catálogo: foto y ficha botánica que muestra la tienda
ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS imagen_url TEXT,
    ADD COLUMN IF NOT EXISTS descripcion TEXT,
    ADD COLUMN IF NOT EXISTS familia_botanica VARCHAR(100),
    ADD COLUMN IF NOT EXISTS categoria_nombre VARCHAR(100);

UPDATE public.productos SET
    imagen_url = v.img, descripcion = v.descr, familia_botanica = v.fam, categoria_nombre = v.cat
FROM (VALUES
    ('AUR-001', 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600&auto=format&fit=crop&q=80', 'Hojas esculturales con fenestraciones naturales que purifican y transforman cualquier espacio contemporáneo en un santuario botánico.', 'Araceae', 'Planta de Interior'),
    ('AUR-002', 'https://images.unsplash.com/photo-1593482892290-f54927ae1bf6?w=600&auto=format&fit=crop&q=80', 'Líneas arquitectónicas verticales con bordes dorados, campeona certificada en purificación de aire y oxigenación nocturna.', 'Asparagaceae', 'Planta Purificadora'),
    ('AUR-003', 'https://images.unsplash.com/photo-1597055181300-e3633a917c9c?w=600&auto=format&fit=crop&q=80', 'La reina indiscutible del interiorismo botánico. Hojas lustrosas en forma de lira y tronco leñoso estilizado.', 'Moraceae', 'Árbol Ornamental Interior'),
    ('AUR-004', 'https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600&auto=format&fit=crop&q=80', 'Follaje plumoso y elegante que aporta frescura, humedad y un ambiente zen a salas de estar y oficinas corporativas.', 'Arecaceae', 'Planta Tropical'),
    ('MAC-001', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80', 'Cerámica cocida a alta temperatura con textura arenosa mate, líneas suaves y plato de contención hermético.', 'Accesorios & Alfarería', 'Maceta Artesanal'),
    ('SUB-001', 'https://images.unsplash.com/photo-1585336261026-7f83a45c2253?w=600&auto=format&fit=crop&q=80', 'Mezcla balanceada enriquecida con micorrizas, humus de lombriz seleccionado y perlita para oxigenación radicular.', 'Nutrición Botánica', 'Sustratos & Abonos')
) AS v(sku, img, descr, fam, cat)
WHERE productos.sku = v.sku AND productos.imagen_url IS NULL;

-- Clientes: se crean solos al vender o cotizar; guardan su ficha botánica
ALTER TABLE public.clientes
    ALTER COLUMN telefono DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS plantas TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS alerta_estacional TEXT,
    ADD COLUMN IF NOT EXISTS accion_recomendada TEXT,
    ADD COLUMN IF NOT EXISTS urgencia VARCHAR(12) DEFAULT 'ESTACIONAL'
        CHECK (urgencia IN ('ALTA', 'MEDIA', 'ESTACIONAL')),
    ADD CONSTRAINT clientes_num_doc_unico UNIQUE (num_doc);

-- Comprobantes: datos completos para reimprimir el ticket y exportar el SIRE
ALTER TABLE public.comprobantes
    ADD COLUMN IF NOT EXISTS cliente_tipo_doc VARCHAR(1),
    ADD COLUMN IF NOT EXISTS cliente_num_doc VARCHAR(11),
    ADD COLUMN IF NOT EXISTS hora_emision VARCHAR(8),
    ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS codigo_respuesta VARCHAR(10),
    ADD COLUMN IF NOT EXISTS descripcion_respuesta TEXT,
    ADD COLUMN IF NOT EXISTS medio_pago VARCHAR(20);

-- Servicios: datos del cliente y de la detracción en la misma ficha
ALTER TABLE public.servicios_jardineria
    ALTER COLUMN fecha_programada SET DEFAULT now(),
    ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(150),
    ADD COLUMN IF NOT EXISTS cliente_doc VARCHAR(11),
    ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(20),
    ADD COLUMN IF NOT EXISTS aplica_detraccion BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS monto_detraccion NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monto_neto NUMERIC(12,2);

-- Detracciones: datos para el monitor sin depender de un JOIN
ALTER TABLE public.detracciones
    ADD COLUMN IF NOT EXISTS cliente VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ruc_cliente VARCHAR(11),
    ADD COLUMN IF NOT EXISTS monto_factura NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS fecha_emision DATE DEFAULT CURRENT_DATE;

-- Quien factura un servicio (dueño o vendedor) registra su detracción; sólo el dueño la ve y la marca pagada
DROP POLICY IF EXISTS detracciones_dueno ON public.detracciones;
CREATE POLICY detracciones_registrar ON public.detracciones FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
CREATE POLICY detracciones_leer ON public.detracciones FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno}'));
CREATE POLICY detracciones_pagar ON public.detracciones FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno}')) WITH CHECK (public.tiene_rol('{dueno}'));

-- Empresa: parámetros bancarios y régimen tributario
ALTER TABLE public.empresa_config
    ADD COLUMN IF NOT EXISTS cuenta_detracciones_bn VARCHAR(30),
    ADD COLUMN IF NOT EXISTS cuenta_bcp_soles VARCHAR(30),
    ADD COLUMN IF NOT EXISTS tasa_detraccion NUMERIC(5,4) DEFAULT 0.12,
    ADD COLUMN IF NOT EXISTS regimen_tributario VARCHAR(4) DEFAULT 'RMT'
        CHECK (regimen_tributario IN ('NRUS', 'RER', 'RMT', 'RG'));

UPDATE public.empresa_config
   SET cuenta_detracciones_bn = COALESCE(cuenta_detracciones_bn, '00-068-091823'),
       cuenta_bcp_soles = COALESCE(cuenta_bcp_soles, '193-9821456-0-12');

-- Guías de remisión: el documento completo como JSON
CREATE TABLE IF NOT EXISTS public.guias_remision (
    id VARCHAR(20) PRIMARY KEY, -- 'T001-00000015'
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    comprobante_id VARCHAR(20) REFERENCES public.comprobantes(id),
    datos JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.guias_remision ENABLE ROW LEVEL SECURITY;
CREATE POLICY guias_ventas ON public.guias_remision FOR ALL TO authenticated
    USING (public.tiene_rol('{dueno,vendedor}')) WITH CHECK (public.tiene_rol('{dueno,vendedor}'));
