ALTER TABLE public.zonas ADD COLUMN IF NOT EXISTS encargado_nombre TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS zonas_nombre_uniq ON public.zonas(nombre);
CREATE UNIQUE INDEX IF NOT EXISTS tiendas_codigo_uniq ON public.tiendas(codigo);