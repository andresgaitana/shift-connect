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
      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="tiendas">Tiendas</TabsTrigger>
          <TabsTrigger value="zonas">Zonas</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4"><DashboardTab /></TabsContent>
        <TabsContent value="users" className="mt-4 space-y-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="tiendas" className="mt-4"><TiendasTab /></TabsContent>
        <TabsContent value="zonas" className="mt-4"><ZonasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function RankBars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin datos todavía.</p>}
        {rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="flex justify-between text-sm gap-2">
              <span className="truncate">{r.label}</span>
              <span className="font-medium shrink-0">{r.value}</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const q = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [{ data: turnos }, { data: posts }] = await Promise.all([
        supabase.from("turnos_vacantes").select("id, estado, negocio, agente_asignado, tienda:tiendas(nombre, zona:zonas(nombre, grupo))"),
        supabase.from("postulaciones").select("id, estado, agente_id"),
      ]);
      const t = turnos ?? [];
      const agenteIds = [...new Set(t.map((x: any) => x.agente_asignado).filter(Boolean))];
      let nombres: Record<string, string> = {};
      if (agenteIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre_completo").in("id", agenteIds);
        nombres = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.nombre_completo ?? "Agente"]));
      }
      return { turnos: t, posts: posts ?? [], nombres };
    },
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const turnos: any[] = q.data?.turnos ?? [];
  const posts: any[] = q.data?.posts ?? [];
  const nombres: Record<string, string> = q.data?.nombres ?? {};

  const total = turnos.length;
  const cubiertos = turnos.filter((t) => t.estado === "asignado").length;
  const abiertos = turnos.filter((t) => t.estado === "abierto").length;
  const cancelados = turnos.filter((t) => t.estado === "cancelado").length;
  const cobertura = total ? Math.round((cubiertos / total) * 100) : 0;

  const countBy = (arr: any[], key: (x: any) => string | null | undefined) => {
    const m = new Map<string, number>();
    arr.forEach((x) => { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const porTienda = countBy(turnos, (t) => t.tienda?.nombre).slice(0, 8);
  const porZona = countBy(turnos, (t) => t.tienda?.zona?.nombre);
  const porAgente = countBy(turnos.filter((t) => t.agente_asignado), (t) => nombres[t.agente_asignado] ?? "Agente").slice(0, 8);
  const mga = turnos.filter((t) => t.tienda?.zona?.grupo === "managua").length;
  const foraneas = turnos.filter((t) => t.tienda?.zona?.grupo === "foraneas").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Turnos publicados" value={total} />
        <StatCard label="Cubiertos" value={cubiertos} accent="text-green-600" />
        <StatCard label="Sin cubrir (abiertos)" value={abiertos} accent="text-amber-600" />
        <StatCard label="Cancelados" value={cancelados} accent="text-destructive" />
        <StatCard label="% Cobertura" value={`${cobertura}%`} />
        <StatCard label="Postulaciones" value={posts.length} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RankBars title="🏪 Tiendas que más piden turnos" rows={porTienda} />
        <RankBars title="🦸 Agentes que más apoyan" rows={porAgente} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RankBars title="🗺️ Turnos por zona" rows={porZona} />
        <RankBars title="📍 Por región" rows={[{ label: "Managua", value: mga }, { label: "Foráneas", value: foraneas }]} />
      </div>
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
              {(["admin", "gt", "gz", "agente"] as AppRole[]).map((r) => {
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
        codigo: codigo || null, nombre, zona_id: zonaId, direccion: direccion || "",
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
  const [encargado, setEncargado] = useState("");
  const [grupo, setGrupo] = useState<"managua" | "foraneas">("managua");
  const zonas = useQuery({
    queryKey: ["zonas"],
    queryFn: async () => (await supabase.from("zonas").select("*").order("grupo").order("nombre")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!nombre) throw new Error("Nombre requerido");
      const { error } = await supabase.from("zonas").insert({ nombre, grupo, encargado_nombre: encargado || null });
      if (error) throw error;
    },
    onSuccess: () => { setNombre(""); setEncargado(""); toast.success("Zona creada"); qc.invalidateQueries({ queryKey: ["zonas"] }); },
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
          <div className="space-y-2"><Label>Encargado (GZ)</Label><Input value={encargado} onChange={(e) => setEncargado(e.target.value)} placeholder="Nombre del Gerente de Zona" /></div>
          <Button disabled={add.isPending} onClick={() => add.mutate()}>Agregar zona</Button>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {(zonas.data ?? []).map((z: any) => (
          <Card key={z.id}><CardContent className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{z.nombre}</div>
              {z.encargado_nombre && <div className="text-xs text-muted-foreground truncate">GZ: {z.encargado_nombre}</div>}
            </div>
            <Badge variant="outline">{z.grupo}</Badge>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
