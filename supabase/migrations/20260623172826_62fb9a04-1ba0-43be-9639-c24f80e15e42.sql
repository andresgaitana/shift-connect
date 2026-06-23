
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tienda_id UUID REFERENCES public.tiendas(id) ON DELETE SET NULL;

UPDATE public.profiles p
SET tienda_id = t.id
FROM auth.users u
JOIN public.tiendas t
  ON upper(t.codigo) = 'A' || lpad(substring(u.email from 'jefe\.ampm(\d+)@'), 2, '0')
WHERE p.id = u.id
  AND u.email ~ '^jefe\.ampm\d+@ampm\.com\.ni$';
