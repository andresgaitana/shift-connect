import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({ meta: [{ title: "Admin — CoverTurnos" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { roles } = useAuth();
  if (!roles.includes("admin")) {
    return <p className="text-sm text-muted-foreground">Solo administradores pueden acceder.</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <p className="text-sm text-muted-foreground">Gestiona usuarios, tiendas y zonas.</p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="tiendas">Tiendas</TabsTrigger>
          <TabsTrigger value="zonas">Zonas</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="tiendas" className="mt-4"><TiendasTab /></TabsContent>
        <TabsContent value="zonas" className="mt-4"><ZonasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profs }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("id, nombre_completo, telefono, negocio, zona:zonas(nombre)").order("nombre_completo"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesMap = new Map<string, string[]>();
      (rolesData ?? []).forEach((r: any) => {
        rolesMap.set(r.user_id, [...(rolesMap.get(r.user_id) ?? []), r.role]);
      });
      return (profs ?? []).map((p: any) => ({ ...p, roles: rolesMap.get(p.id) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: AppRole; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (users.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="grid gap-3">
      {(users.data ?? []).map((u: any) => (
        <Card key={u.id}>
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="font-medium">{u.nombre_completo ?? "(Sin nombre)"}</div>
              <div className="text-xs text-muted-foreground">
                {u.telefono ?? "—"} · {u.negocio ?? "sin negocio"} · {u.zona?.nombre ?? "sin zona"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["admin", "gt", "agente"] as AppRole[]).map((r) => {
                const has = u.roles.includes(r);
                return (
                  <Button
                    key={r} size="sm" variant={has ? "default" : "outline"}
                    onClick={() => setRole.mutate({ userId: u.id, role: r, add: !has })}
                  >
                    {has ? "✓ " : "+ "}{r}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TiendasTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const tiendas = useQuery({
    queryKey: ["admin-tiendas"],
    queryFn: async () => (await supabase.from("tiendas").select("*, zona:zonas(nombre, grupo)").order("nombre")).data ?? [],
  });
  const zonas = useQuery({
    queryKey: ["zonas"],
    queryFn: async () => (await supabase.from("zonas").select("id, nombre, grupo").order("nombre")).data ?? [],
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Nueva tienda</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva tienda</DialogTitle></DialogHeader>
            <TiendaForm zonas={zonas.data ?? []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-tiendas"] }); }} />
          </DialogContent>
        </Dialog>
      </div>
      {(tiendas.data ?? []).map((t: any) => (
        <Card key={t.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{t.codigo ? `[${t.codigo}] ` : ""}{t.nombre}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t.zona?.nombre ?? "—"} · {t.direccion ?? "sin dirección"}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant={t.activa ? "default" : "secondary"}>{t.activa ? "Activa" : "Inactiva"}</Badge>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
                const { error } = await supabase.from("tiendas").update({ activa: !t.activa }).eq("id", t.id);
                if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin-tiendas"] });
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TiendaForm({ zonas, onDone }: { zonas: any[]; onDone: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [direccion, setDireccion] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!nombre || !zonaId) throw new Error("Nombre y zona son requeridos");
      const { error } = await supabase.from("tiendas").insert({
        codigo: codigo || null, nombre, zona_id: zonaId, direccion: direccion || null,
        latitud: lat ? Number(lat) : null, longitud: lng ? Number(lng) : null, activa: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tienda creada"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-1"><Label>Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        <div className="space-y-2 col-span-2"><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>Zona</Label>
        <Select value={zonaId} onValueChange={setZonaId}>
          <SelectTrigger><SelectValue placeholder="Selecciona zona" /></SelectTrigger>
          <SelectContent>{zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre} ({z.grupo})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Dirección</Label><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Latitud</Label><Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="12.1364" /></div>
        <div className="space-y-2"><Label>Longitud</Label><Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-86.2514" /></div>
      </div>
      <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>Crear tienda</Button>
    </div>
  );
}

function ZonasTab() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [grupo, setGrupo] = useState<"managua" | "foraneas">("managua");
  const zonas = useQuery({
    queryKey: ["zonas"],
    queryFn: async () => (await supabase.from("zonas").select("*").order("grupo").order("nombre")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!nombre) throw new Error("Nombre requerido");
      const { error } = await supabase.from("zonas").insert({ nombre, grupo });
      if (error) throw error;
    },
    onSuccess: () => { setNombre(""); toast.success("Zona creada"); qc.invalidateQueries({ queryKey: ["zonas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Nueva zona</CardTitle><CardDescription>Agrupa por Managua o Foráneas.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={grupo} onValueChange={(v) => setGrupo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="managua">Managua</SelectItem>
                  <SelectItem value="foraneas">Foráneas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button disabled={add.isPending} onClick={() => add.mutate()}>Agregar zona</Button>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {(zonas.data ?? []).map((z: any) => (
          <Card key={z.id}><CardContent className="p-3 flex items-center justify-between">
            <div className="font-medium">{z.nombre}</div>
            <Badge variant="outline">{z.grupo}</Badge>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
