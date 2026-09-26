-- ========================================================
-- CRM PROFESIONAL: notas por cliente y tareas / recordatorios
-- ========================================================

CREATE TABLE IF NOT EXISTS public.cliente_notas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL CHECK (length(trim(texto)) > 0),
    autor VARCHAR(100) NOT NULL,
    autor_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cliente_notas_cliente_idx ON public.cliente_notas (cliente_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tareas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id INT REFERENCES public.clientes(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
    vence DATE NOT NULL,
    asignado_a VARCHAR(100),
    hecha BOOLEAN NOT NULL DEFAULT FALSE,
    hecha_at TIMESTAMPTZ,
    creado_por VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tareas_pendientes_idx ON public.tareas (hecha, vence);

ALTER TABLE public.cliente_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- Todo el personal ve y anota (el jardinero registra sus visitas); sólo el dueño borra
CREATE POLICY notas_leer ON public.cliente_notas FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY notas_crear ON public.cliente_notas FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY notas_dueno_borra ON public.cliente_notas FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));

CREATE POLICY tareas_leer ON public.tareas FOR SELECT TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY tareas_crear ON public.tareas FOR INSERT TO authenticated
    WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY tareas_actualizar ON public.tareas FOR UPDATE TO authenticated
    USING (public.tiene_rol('{dueno,vendedor,jardinero}')) WITH CHECK (public.tiene_rol('{dueno,vendedor,jardinero}'));
CREATE POLICY tareas_dueno_borra ON public.tareas FOR DELETE TO authenticated
    USING (public.tiene_rol('{dueno}'));
