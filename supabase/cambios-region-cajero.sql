-- ============================================================
-- Cambio: visibilidad del CAJERO por REGIÓN (MGA/FOR), no por negocio.
-- Cajero de Managua ve TODOS los turnos abiertos de Managua (cualquier negocio);
-- cajero de Foráneas ve solo los de Foráneas.
-- Aplicar en el SQL editor de Supabase (cuando el panel esté disponible).
-- Va junto con los cambios de la app (onboarding del cajero + pantalla de turnos).
-- ============================================================

-- 1) Campo de región del cajero (managua | foraneas)
alter table public.profiles add column if not exists region public.zone_group;

-- 2) Backfill: si el cajero ya tenía una zona, su región = grupo de esa zona
update public.profiles p
set region = z.grupo
from public.zonas z
where z.id = p.zona_id and p.region is null;

-- 3) RLS turnos: el AGENTE ve los abiertos de SU REGIÓN
drop policy if exists "turnos: lectura segun rol" on public.turnos_vacantes;
create policy "turnos: lectura segun rol" on public.turnos_vacantes for select to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or gt_creador = auth.uid()
  or agente_asignado = auth.uid()
  or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id))
  or (
    public.has_role(auth.uid(),'agente') and estado = 'abierto'
    and (select z.grupo from public.tiendas t join public.zonas z on z.id = t.zona_id
         where t.id = turnos_vacantes.tienda_id)
        = (select region from public.profiles where id = auth.uid())
  )
);

-- 4) RLS postulaciones: el AGENTE se postula a turnos abiertos de SU REGIÓN
drop policy if exists "post: agente insert" on public.postulaciones;
create policy "post: agente insert" on public.postulaciones for insert to authenticated
with check (
  agente_id = auth.uid()
  and public.has_role(auth.uid(),'agente')
  and exists (
    select 1
    from public.turnos_vacantes t
    join public.tiendas tt on tt.id = t.tienda_id
    join public.zonas zz on zz.id = tt.zona_id
    where t.id = turno_id
      and t.estado = 'abierto'
      and zz.grupo = (select region from public.profiles where id = auth.uid())
  )
);
