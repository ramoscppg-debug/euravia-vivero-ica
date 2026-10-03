-- ========================================================
-- CÓDIGO UNSPSC DE LA EXISTENCIA (PLE 13.1, campos 8 y 9)
-- Obligatorio desde el 1.1.2021 para la entrada y salida de mercaderías y productos terminados:
-- código al tercer nivel del catálogo UNSPSC (Tabla 13: 1 = Naciones Unidas). Lo define el dueño o su contador.
-- ========================================================
ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS codigo_unspsc VARCHAR(8) CHECK (codigo_unspsc IS NULL OR codigo_unspsc ~ '^[0-9]{8}$');
