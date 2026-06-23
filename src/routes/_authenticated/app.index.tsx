import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Business } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Briefcase, ShieldCheck, Users, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

function HomePage() {
  const { profile, roles, user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(profile?.nombre_completo ?? "");
  const [telefono, setTelefono] = useState(profile?.telefono ?? "");
  const [negocio, setNegocio] = useState<Business | "">(profile?.negocio ?? "");

  const zonas = useQuery({
    queryKey: ["zonas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zonas").select("id, nombre, grupo").order("nombre");
      if (error) throw error;
      return data;
    },
  });
  const [zonaId, setZonaId] = useState<string>(profile?.zona_id ?? "");

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        nombre_completo: nombre || null,
        telefono: telefono || null,
        negocio: negocio || null,
        zona_id: zonaId || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Perfil actualizado"); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimAdmin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_admin_if_none");
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: async (ok) => {
      if (ok) { toast.success("Eres el primer admin"); await refresh(); }
      else toast.info("Ya existe un admin asignado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsOnboarding = !profile?.negocio && !roles.includes("admin") && !roles.includes("gt");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hola{profile?.nombre_completo ? `, ${profile.nombre_completo.split(" ")[0]}` : ""} 👋</h1>
        <p className="text-sm text-muted-foreground">
          {roles.length === 0 ? "Tu cuenta está activa. Completa tu perfil y un administrador te asignará un rol." : "Esto es lo que puedes hacer hoy."}
        </p>
      </div>

      {/* Roles cards */}
      {roles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.includes("agente") && (
            <Link to="/app/turnos">
              <Card className="transition hover:border-primary hover:shadow-sm">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Calendar className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base">Turnos disponibles</CardTitle>
                    <CardDescription>Postúlate a turnos abiertos</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )}
          {roles.includes("gt") && (
            <Link to="/app/gt">
              <Card className="transition hover:border-primary hover:shadow-sm">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Briefcase className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base">Mis turnos publicados</CardTitle>
                    <CardDescription>Publica y aprueba postulantes</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )}
          {roles.includes("admin") && (
            <Link to="/app/admin">
              <Card className="transition hover:border-primary hover:shadow-sm">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base">Administración</CardTitle>
                    <CardDescription>Roles, tiendas y zonas</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Estado de la cuenta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mi cuenta</CardTitle>
          <CardDescription className="flex gap-2 flex-wrap pt-1">
            {roles.length === 0 ? (
              <Badge variant="secondary">Sin rol asignado</Badge>
            ) : roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
            {profile?.negocio && <Badge>{profile.negocio === "productos" ? "Productos" : "MBK"}</Badge>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select value={negocio} onValueChange={(v) => setNegocio(v as Business)}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="productos">Productos</SelectItem>
                  <SelectItem value="mbk">MBK · Servicios Financieros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zona</Label>
              <Select value={zonaId} onValueChange={setZonaId}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {(zonas.data ?? []).map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={saving || saveProfile.isPending} onClick={() => { setSaving(true); saveProfile.mutate(undefined, { onSettled: () => setSaving(false) }); }}>
              Guardar
            </Button>
          </div>
          {needsOnboarding && (
            <p className="text-xs text-muted-foreground">
              💡 Después de guardar, pide a un admin que te asigne el rol de Agente o GT.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Claim admin */}
      {roles.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Primer usuario</CardTitle>
            <CardDescription>Si eres la primera persona en configurar la app, puedes reclamar el rol de administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => claimAdmin.mutate()} disabled={claimAdmin.isPending}>
              Reclamar admin (solo si no hay otro)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
