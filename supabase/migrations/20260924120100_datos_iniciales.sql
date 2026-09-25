-- ========================================================
-- DATOS INICIALES: zonas, catálogo base y configuración fiscal
-- El stock inicial entra por el Kardex ('Ajuste Inventario'), igual que en la app.
-- ========================================================

INSERT INTO public.almacenes_zonas (id, nombre, descripcion, tipo_almacenamiento) VALUES
    ('ZONA-A', 'Zona A', 'Plantas pequeñas e invernadero', 'Invernadero'),
    ('ZONA-B', 'Zona B', 'Plantas medianas de interior', 'Sombra tropical'),
    ('ZONA-C', 'Zona C', 'Plantas grandes y pabellón central', 'Pabellón'),
    ('ZONA-D', 'Zona D', 'Macetas y accesorios', 'Boutique'),
    ('ZONA-E', 'Zona E', 'Insumos: sustratos y fertilizantes', 'Almacén seco')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos
    (sku, nombre, nombre_cientifico, categoria, zona_id, ubicacion_estante, costo_unitario, precio_venta,
     stock_actual, stock_minimo, cuidado_luz, cuidado_riego, es_planta_viva)
VALUES
    ('AUR-001', 'Monstera Deliciosa', 'Monstera deliciosa Liebm.', 'interior', 'ZONA-B', 'Zona Tropical B-03', 35.00, 85.00, 0, 6, 'Luz Indirecta Brillante', 'Riego semanal moderado', TRUE),
    ('AUR-002', 'Sansevieria Laurentii', 'Dracaena trifasciata', 'interior', 'ZONA-B', 'Zona Purificadora B-01', 18.00, 48.00, 0, 8, 'Tolera baja a alta luz', 'Cada 15 a 20 días', TRUE),
    ('AUR-003', 'Ficus Lyrata Pandurata', 'Ficus lyrata', 'interior', 'ZONA-C', 'Pabellón Central C-02', 50.00, 120.00, 0, 4, 'Luz filtrada abundante', '2 veces por semana', TRUE),
    ('AUR-004', 'Palmera Areca Palma de Salón', 'Dypsis lutescens', 'interior', 'ZONA-A', 'Invernadero A-04', 40.00, 95.00, 0, 5, 'Luz brillante tamizada', '3 veces por semana', TRUE),
    ('MAC-001', 'Maceta Cerámica Arena Mate 28cm', 'Artesanía en Terracota', 'macetas', 'ZONA-D', 'Boutique Macetas D-01', 22.00, 55.00, 0, 10, 'Interior y terraza cubierta', 'Incluye plato de drenaje', FALSE),
    ('SUB-001', 'Sustrato Premium Orgánico 10L', 'Humus + Perlita + Fibra de Coco', 'sustratos', 'ZONA-E', 'Almacén Insumos E-02', 11.00, 28.00, 0, 15, 'Conservar en lugar fresco', 'Aireado y drenante', FALSE)
ON CONFLICT (sku) DO NOTHING;

-- Inventario de apertura (el trigger del Kardex fija stock_actual)
INSERT INTO public.kardex_movimientos
    (producto_sku, tipo_movimiento, cantidad_entrada, cantidad_salida, saldo_resultante, costo_unitario, documento_referencia, usuario_responsable)
SELECT v.sku, 'Ajuste Inventario', v.qty, 0, 0, p.costo_unitario, 'INV-INICIAL', 'Almacén Aurevia'
FROM (VALUES ('AUR-001', 28), ('AUR-002', 35), ('AUR-003', 14), ('AUR-004', 19), ('MAC-001', 24), ('SUB-001', 45)) AS v(sku, qty)
JOIN public.productos p ON p.sku = v.sku
WHERE NOT EXISTS (SELECT 1 FROM public.kardex_movimientos k WHERE k.documento_referencia = 'INV-INICIAL' AND k.producto_sku = v.sku);

INSERT INTO public.empresa_config
    (id, ruc, razon_social, nombre_comercial, direccion, ubigeo, sunat_ambiente, serie_boleta, serie_factura, serie_gre)
VALUES
    ('20609876541', '20609876541', 'AUREVIA BOTANICAL S.A.C.', 'AUREVIA - Plantas, Jardines & Vida Natural',
     'Av. Primavera 1280, Chacarilla', '150140', 'BETA', 'B001', 'F001', 'T001')
ON CONFLICT (id) DO NOTHING;
