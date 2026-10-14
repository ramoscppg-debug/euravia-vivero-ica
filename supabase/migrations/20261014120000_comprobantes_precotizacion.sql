-- ========================================================
-- COMPROBANTES DE LA PRE-COTIZACIÓN (control)
-- La factura o boleta se emite en el portal SUNAT; aquí se anota su número y el enlace (Drive)
-- del PDF para enviárselo al cliente. El cliente también lo descarga desde su enlace de la cotización.
-- ========================================================

ALTER TABLE public.precotizaciones ADD COLUMN IF NOT EXISTS comprobantes JSONB NOT NULL DEFAULT '[]'; -- [{tipo, numero, fecha, url, enviado_at}]

CREATE OR REPLACE FUNCTION public.precotizacion_publica(p_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'numero', c.numero, 'fecha', c.fecha, 'validez_dias', c.validez_dias, 'estado', c.estado,
        'cliente_nombre', c.cliente_nombre, 'cliente_doc', c.cliente_doc, 'cliente_direccion', c.cliente_direccion,
        'con_igv', c.con_igv, 'lineas', c.lineas, 'condiciones', c.condiciones, 'notas', c.notas,
        'op_gravadas', c.op_gravadas, 'op_exoneradas', c.op_exoneradas, 'op_inafectas', c.op_inafectas, 'igv', c.igv, 'total', c.total,
        'pagado', (SELECT coalesce(sum((x->>'monto')::NUMERIC), 0) FROM jsonb_array_elements(c.pagos) x),
        'comprobantes', (SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', x->>'tipo', 'numero', x->>'numero', 'url', x->>'url')), '[]') FROM jsonb_array_elements(c.comprobantes) x),
        'empresa', (SELECT jsonb_build_object('ruc', e.ruc, 'razon_social', e.razon_social, 'nombre_comercial', e.nombre_comercial, 'direccion', e.direccion,
                                              'cuenta_bcp', e.cuenta_bcp_soles)
                      FROM public.empresa_config e LIMIT 1),
        'contacto', (SELECT jsonb_build_object('whatsapp', t.whatsapp, 'email', t.email) FROM public.tienda_config t WHERE t.id = 1)
    )
    FROM public.precotizaciones c
    WHERE c.token = p_token AND c.estado <> 'BORRADOR';
$$;
REVOKE ALL ON FUNCTION public.precotizacion_publica(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.precotizacion_publica(UUID) TO anon, authenticated;
