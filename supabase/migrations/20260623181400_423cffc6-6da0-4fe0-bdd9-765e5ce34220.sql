
-- Helper: ¿la tienda pertenece a la zona del usuario?
CREATE OR REPLACE FUNCTION public.tienda_en_mi_zona(_tienda_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tiendas t
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE t.id = _tienda_id
      AND t.zona_id IS NOT NULL
      AND t.zona_id = p.zona_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.tienda_en_mi_zona(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_en_mi_zona(uuid) TO authenticated;

-- INSERT: permitir a GZ además del GT
DROP POLICY IF EXISTS "turnos: gt insert propio" ON public.turnos_vacantes;
CREATE POLICY "turnos: gt o gz insert"
  ON public.turnos_vacantes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    gt_creador = auth.uid()
    AND (
      (has_role(auth.uid(), 'gt') AND tienda_id = (SELECT tienda_id FROM public.profiles WHERE id = auth.uid()))
      OR (has_role(auth.uid(), 'gz') AND public.tienda_en_mi_zona(tienda_id))
      OR has_role(auth.uid(), 'admin')
    )
  );

-- UPDATE / DELETE: GZ puede modificar turnos de tiendas de su zona
DROP POLICY IF EXISTS "turnos: gt o admin update" ON public.turnos_vacantes;
CREATE POLICY "turnos: gt gz o admin update"
  ON public.turnos_vacantes
  FOR UPDATE
  TO authenticated
  USING (
    gt_creador = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'gz') AND public.tienda_en_mi_zona(tienda_id))
  )
  WITH CHECK (
    gt_creador = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'gz') AND public.tienda_en_mi_zona(tienda_id))
  );

DROP POLICY IF EXISTS "turnos: gt o admin delete" ON public.turnos_vacantes;
CREATE POLICY "turnos: gt gz o admin delete"
  ON public.turnos_vacantes
  FOR DELETE
  TO authenticated
  USING (
    gt_creador = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'gz') AND public.tienda_en_mi_zona(tienda_id))
  );

-- SELECT: GZ puede ver todos los turnos de tiendas de su zona
DROP POLICY IF EXISTS "turnos: agente ve abiertos de su negocio" ON public.turnos_vacantes;
CREATE POLICY "turnos: lectura segun rol"
  ON public.turnos_vacantes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR gt_creador = auth.uid()
    OR agente_asignado = auth.uid()
    OR (has_role(auth.uid(), 'gz') AND public.tienda_en_mi_zona(tienda_id))
    OR (
      has_role(auth.uid(), 'agente')
      AND estado = 'abierto'
      AND negocio = (SELECT negocio FROM public.profiles WHERE id = auth.uid())
    )
  );
