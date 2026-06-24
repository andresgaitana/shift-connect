-- ============================================================
-- CoverTurnos / shift-connect — ESQUEMA CONSOLIDADO
-- Aplicar UNA sola vez en el proyecto Supabase NUEVO (SQL editor).
-- Equivale al estado final tras las 10 migraciones del repo.
-- ============================================================

-- ===== ENUMS =====
create type public.app_role as enum ('admin','gt','gz','agente');
create type public.business_type as enum ('productos','mbk');
create type public.zone_group as enum ('managua','foraneas');
create type public.turno_slot as enum ('AM','PM');
create type public.shift_status as enum ('abierto','asignado','cancelado');
create type public.application_status as enum ('pendiente','aprobada','rechazada');

-- ===== helper updated_at =====
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== ZONAS =====
create table public.zonas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  grupo public.zone_group not null,
  encargado_nombre text,
  created_at timestamptz not null default now()
);
grant select on public.zonas to authenticated;
grant all on public.zonas to service_role;
alter table public.zonas enable row level security;

-- ===== TIENDAS =====
create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  zona_id uuid not null references public.zonas(id) on delete restrict,
  direccion text not null,
  latitud double precision,
  longitud double precision,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tiendas to authenticated;
grant all on public.tiendas to service_role;
alter table public.tiendas enable row level security;
create trigger trg_tiendas_updated_at before update on public.tiendas
  for each row execute function public.update_updated_at_column();

-- ===== PROFILES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  telefono text,
  negocio public.business_type,
  zona_id uuid references public.zonas(id) on delete set null,
  tienda_id uuid references public.tiendas(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ===== USER ROLES =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- ===== FUNCIONES de seguridad =====
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.tienda_en_mi_zona(_tienda_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tiendas t join public.profiles p on p.id = auth.uid()
    where t.id = _tienda_id and t.zona_id is not null and t.zona_id = p.zona_id
  )
$$;

create or replace function public.claim_admin_if_none()
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); has_any_admin boolean;
begin
  if uid is null then return false; end if;
  select exists(select 1 from public.user_roles where role='admin') into has_any_admin;
  if has_any_admin then return false; end if;
  insert into public.user_roles (user_id, role) values (uid,'admin') on conflict do nothing;
  return true;
end; $$;

-- ===== TURNOS VACANTES =====
create table public.turnos_vacantes (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete restrict,
  fecha date not null,
  turno public.turno_slot not null,
  negocio public.business_type not null,
  hora_inicio time,
  hora_fin time,
  notas text,
  estado public.shift_status not null default 'abierto',
  gt_creador uuid not null references auth.users(id) on delete restrict,
  agente_asignado uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_turnos_estado_fecha on public.turnos_vacantes (estado, fecha);
create index idx_turnos_negocio on public.turnos_vacantes (negocio);
create index idx_turnos_gt on public.turnos_vacantes (gt_creador);
grant select, insert, update, delete on public.turnos_vacantes to authenticated;
grant all on public.turnos_vacantes to service_role;
alter table public.turnos_vacantes enable row level security;
create trigger trg_turnos_updated_at before update on public.turnos_vacantes
  for each row execute function public.update_updated_at_column();

-- ===== POSTULACIONES =====
create table public.postulaciones (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos_vacantes(id) on delete cascade,
  agente_id uuid not null references auth.users(id) on delete cascade,
  estado public.application_status not null default 'pendiente',
  mensaje text,
  motivo_rechazo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(turno_id, agente_id)
);
create index idx_post_turno on public.postulaciones (turno_id);
create index idx_post_agente on public.postulaciones (agente_id);
grant select, insert, update, delete on public.postulaciones to authenticated;
grant all on public.postulaciones to service_role;
alter table public.postulaciones enable row level security;
create trigger trg_post_updated_at before update on public.postulaciones
  for each row execute function public.update_updated_at_column();

-- ===== TRIGGER: aprobar postulación => asignar turno y rechazar el resto =====
create or replace function public.handle_postulacion_aprobada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado='aprobada' and (old.estado is distinct from 'aprobada') then
    update public.turnos_vacantes set estado='asignado', agente_asignado=new.agente_id where id=new.turno_id;
    update public.postulaciones set estado='rechazada'
      where turno_id=new.turno_id and id<>new.id and estado='pendiente';
  end if;
  return new;
end; $$;
create trigger trg_post_aprobada after update on public.postulaciones
  for each row execute function public.handle_postulacion_aprobada();

-- ===== TRIGGER: nuevo usuario => crea profile + rol 'agente' =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre_completo, telefono)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.email),
          new.raw_user_meta_data->>'telefono')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id,'agente')
  on conflict (user_id, role) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS POLICIES =====
-- zonas
create policy "zonas read all auth" on public.zonas for select to authenticated using (true);
create policy "zonas: admin write" on public.zonas for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- tiendas
create policy "tiendas read all auth" on public.tiendas for select to authenticated using (true);
create policy "tiendas: admin write" on public.tiendas for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- user_roles
create policy "user_roles: own rows readable" on public.user_roles for select to authenticated
  using (auth.uid()=user_id or public.has_role(auth.uid(),'admin'));
create policy "user_roles: admin manage" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- profiles
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (auth.uid()=id or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gt'));
create policy "profiles: insert own" on public.profiles for insert to authenticated with check (auth.uid()=id);
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (auth.uid()=id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid()=id or public.has_role(auth.uid(),'admin'));
-- turnos_vacantes
create policy "turnos: lectura segun rol" on public.turnos_vacantes for select to authenticated
  using (
    public.has_role(auth.uid(),'admin') or gt_creador=auth.uid() or agente_asignado=auth.uid()
    or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id))
    or (public.has_role(auth.uid(),'agente') and estado='abierto'
        and negocio=(select negocio from public.profiles where id=auth.uid()))
  );
create policy "turnos: gt o gz insert" on public.turnos_vacantes for insert to authenticated
  with check (
    gt_creador=auth.uid() and (
      (public.has_role(auth.uid(),'gt') and tienda_id=(select tienda_id from public.profiles where id=auth.uid()))
      or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id))
      or public.has_role(auth.uid(),'admin')
    )
  );
create policy "turnos: gt gz o admin update" on public.turnos_vacantes for update to authenticated
  using (gt_creador=auth.uid() or public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id)))
  with check (gt_creador=auth.uid() or public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id)));
create policy "turnos: gt gz o admin delete" on public.turnos_vacantes for delete to authenticated
  using (gt_creador=auth.uid() or public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'gz') and public.tienda_en_mi_zona(tienda_id)));
-- postulaciones
create policy "post: read scope" on public.postulaciones for select to authenticated
  using (agente_id=auth.uid() or public.has_role(auth.uid(),'admin')
    or exists(select 1 from public.turnos_vacantes t where t.id=turno_id and t.gt_creador=auth.uid()));
create policy "post: agente insert" on public.postulaciones for insert to authenticated
  with check (agente_id=auth.uid() and public.has_role(auth.uid(),'agente')
    and exists(select 1 from public.turnos_vacantes t where t.id=turno_id and t.estado='abierto'
      and t.negocio=(select negocio from public.profiles where id=auth.uid())));
create policy "post: update scope" on public.postulaciones for update to authenticated
  using ((agente_id=auth.uid() and estado='pendiente') or public.has_role(auth.uid(),'admin')
    or exists(select 1 from public.turnos_vacantes t where t.id=turno_id and t.gt_creador=auth.uid()))
  with check (agente_id=auth.uid() or public.has_role(auth.uid(),'admin')
    or exists(select 1 from public.turnos_vacantes t where t.id=turno_id and t.gt_creador=auth.uid()));
create policy "post: agente delete propia pendiente" on public.postulaciones for delete to authenticated
  using (agente_id=auth.uid() and estado='pendiente');

-- ===== REVOKES de EXECUTE (igual que las migraciones) =====
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.tienda_en_mi_zona(uuid) from public, anon;
revoke execute on function public.claim_admin_if_none() from public, anon;
grant  execute on function public.claim_admin_if_none() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_postulacion_aprobada() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;

-- ===== SEED: 10 zonas con su Gerente de Zona =====
insert into public.zonas (nombre, grupo, encargado_nombre) values
  ('MGA Centro',  'managua', 'Cristina Maldonado'),
  ('MGA Norte',   'managua', 'Erica Zamora'),
  ('MGA Sur',     'managua', 'Carlos Sandoval'),
  ('MGA Noreste', 'managua', 'Engels Castellón'),
  ('FOR Sur 1',     'foraneas', 'Daniel Centeno'),
  ('FOR Sur 2',     'foraneas', 'Cristhian Guzmán'),
  ('FOR Norte',     'foraneas', 'Tania Ruiz'),
  ('FOR Occidente', 'foraneas', 'Marcos Muñoz Zárate'),
  ('FOR Centro 1',  'foraneas', 'Yuri Reyes'),
  ('FOR Centro 2',  'foraneas', 'Julio Gutiérrez');
