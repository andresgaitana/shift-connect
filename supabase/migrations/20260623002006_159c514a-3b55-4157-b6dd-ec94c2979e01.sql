
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'gt', 'agente');
CREATE TYPE public.business_type AS ENUM ('productos', 'mbk');
CREATE TYPE public.zone_group AS ENUM ('managua', 'foraneas');
CREATE TYPE public.turno_slot AS ENUM ('AM', 'PM');
CREATE TYPE public.shift_status AS ENUM ('abierto', 'asignado', 'cancelado');
CREATE TYPE public.application_status AS ENUM ('pendiente', 'aprobada', 'rechazada');

-- ============= updated_at helper =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============= ZONAS =============
CREATE TABLE public.zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  grupo public.zone_group NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zonas TO authenticated;
GRANT ALL ON public.zonas TO service_role;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zonas read all auth" ON public.zonas FOR SELECT TO authenticated USING (true);

-- ============= TIENDAS =============
CREATE TABLE public.tiendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  zona_id UUID NOT NULL REFERENCES public.zonas(id) ON DELETE RESTRICT,
  direccion TEXT NOT NULL,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tiendas TO authenticated;
GRANT ALL ON public.tiendas TO service_role;
ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiendas read all auth" ON public.tiendas FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_tiendas_updated_at BEFORE UPDATE ON public.tiendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  telefono TEXT,
  negocio public.business_type,
  zona_id UUID REFERENCES public.zonas(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies that depend on has_role
CREATE POLICY "user_roles: own rows readable" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles: admin manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "profiles: read own or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gt'));
CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Admin-only writes to zonas/tiendas
CREATE POLICY "zonas: admin write" ON public.zonas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tiendas: admin write" ON public.tiendas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= TURNOS VACANTES =============
CREATE TABLE public.turnos_vacantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id UUID NOT NULL REFERENCES public.tiendas(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  turno public.turno_slot NOT NULL,
  negocio public.business_type NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  notas TEXT,
  estado public.shift_status NOT NULL DEFAULT 'abierto',
  gt_creador UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  agente_asignado UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_turnos_estado_fecha ON public.turnos_vacantes (estado, fecha);
CREATE INDEX idx_turnos_negocio ON public.turnos_vacantes (negocio);
CREATE INDEX idx_turnos_gt ON public.turnos_vacantes (gt_creador);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turnos_vacantes TO authenticated;
GRANT ALL ON public.turnos_vacantes TO service_role;
ALTER TABLE public.turnos_vacantes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_turnos_updated_at BEFORE UPDATE ON public.turnos_vacantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agentes ven turnos abiertos de su negocio; GT ve los suyos; admin ve todo
CREATE POLICY "turnos: agente ve abiertos de su negocio" ON public.turnos_vacantes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR gt_creador = auth.uid()
    OR agente_asignado = auth.uid()
    OR (
      public.has_role(auth.uid(), 'agente')
      AND estado = 'abierto'
      AND negocio = (SELECT negocio FROM public.profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY "turnos: gt insert propio" ON public.turnos_vacantes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gt') AND gt_creador = auth.uid());
CREATE POLICY "turnos: gt o admin update" ON public.turnos_vacantes
  FOR UPDATE TO authenticated
  USING (gt_creador = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gt_creador = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "turnos: gt o admin delete" ON public.turnos_vacantes
  FOR DELETE TO authenticated
  USING (gt_creador = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============= POSTULACIONES =============
CREATE TABLE public.postulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES public.turnos_vacantes(id) ON DELETE CASCADE,
  agente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado public.application_status NOT NULL DEFAULT 'pendiente',
  mensaje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(turno_id, agente_id)
);
CREATE INDEX idx_post_turno ON public.postulaciones (turno_id);
CREATE INDEX idx_post_agente ON public.postulaciones (agente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.postulaciones TO authenticated;
GRANT ALL ON public.postulaciones TO service_role;
ALTER TABLE public.postulaciones ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_post_updated_at BEFORE UPDATE ON public.postulaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agente ve sus postulaciones; GT ve las de sus turnos; admin todo
CREATE POLICY "post: read scope" ON public.postulaciones
  FOR SELECT TO authenticated
  USING (
    agente_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.turnos_vacantes t WHERE t.id = turno_id AND t.gt_creador = auth.uid())
  );
-- Agente se postula a turnos abiertos de su negocio
CREATE POLICY "post: agente insert" ON public.postulaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    agente_id = auth.uid()
    AND public.has_role(auth.uid(), 'agente')
    AND EXISTS (
      SELECT 1 FROM public.turnos_vacantes t
      WHERE t.id = turno_id
        AND t.estado = 'abierto'
        AND t.negocio = (SELECT negocio FROM public.profiles WHERE id = auth.uid())
    )
  );
-- Agente puede cancelar su postulación pendiente; GT/admin actualizan estado
CREATE POLICY "post: update scope" ON public.postulaciones
  FOR UPDATE TO authenticated
  USING (
    (agente_id = auth.uid() AND estado = 'pendiente')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.turnos_vacantes t WHERE t.id = turno_id AND t.gt_creador = auth.uid())
  )
  WITH CHECK (
    agente_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.turnos_vacantes t WHERE t.id = turno_id AND t.gt_creador = auth.uid())
  );
CREATE POLICY "post: agente delete propia pendiente" ON public.postulaciones
  FOR DELETE TO authenticated
  USING (agente_id = auth.uid() AND estado = 'pendiente');

-- ============= Trigger: al aprobar postulación, asignar turno y rechazar resto =============
CREATE OR REPLACE FUNCTION public.handle_postulacion_aprobada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'aprobada' AND (OLD.estado IS DISTINCT FROM 'aprobada') THEN
    UPDATE public.turnos_vacantes
       SET estado = 'asignado', agente_asignado = NEW.agente_id
     WHERE id = NEW.turno_id;
    UPDATE public.postulaciones
       SET estado = 'rechazada'
     WHERE turno_id = NEW.turno_id
       AND id <> NEW.id
       AND estado = 'pendiente';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_post_aprobada
  AFTER UPDATE ON public.postulaciones
  FOR EACH ROW EXECUTE FUNCTION public.handle_postulacion_aprobada();

-- ============= Trigger: crear profile al registrarse =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre_completo, telefono)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
    NEW.raw_user_meta_data->>'telefono'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= Seed zonas =============
INSERT INTO public.zonas (nombre, grupo) VALUES
  ('Managua I',   'managua'),
  ('Managua II',  'managua'),
  ('Managua III', 'managua'),
  ('Managua IV',  'managua'),
  ('Foránea I',   'foraneas'),
  ('Foránea II',  'foraneas'),
  ('Foránea III', 'foraneas'),
  ('Foránea IV',  'foraneas'),
  ('Foránea V',   'foraneas'),
  ('Foránea VI',  'foraneas');
