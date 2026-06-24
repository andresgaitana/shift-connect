import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Business } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, Check, X, Trash2 } from "lucide-react";
import { formatFecha, estadoLabel, negocioLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/gt")({
  head: () => ({ meta: [{ title: "Mis turnos — CoverTurnos" }] }),
  component: GTPage,
});

function GTPage() {
  const { user, roles, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const isGz = roles.includes("gz");
  const isGt = roles.includes("gt");

  const tiendas = useQuery({
    queryKey: ["tiendas-publicar", isAdmin ? "all" : isGz ? `zona:${profile?.zona_id}` : profile?.tienda_id ?? null],
    enabled: isAdmin || (isGz && !!profile?.zona_id) || (isGt && !!profile?.tienda_id),
    queryFn: async () => {
      let q = supabase.from("tiendas").select("id, codigo, nombre, zona:zonas(nombre)").eq("activa", true).order("codigo");
      if (!isAdmin) {
        if (isGz && profile?.zona_id) q = q.eq("zona_id", profile.zona_id);
        else if (profile?.tienda_id) q = q.eq("id", profile.tienda_id);
      }
      return (await q).data ?? [];
    },
  });

  const turnos = useQuery({
    queryKey: ["mis-turnos-gt", user?.id, isGz ? profile?.zona_id : null],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("turnos_vacantes")
        .select("*, tienda:tiendas!inner(nombre, zona_id, zona:zonas(nombre)), postulaciones(id, estado, mensaje, agente_id, agente:profiles!postulaciones_agente_id_fkey(nombre_completo, telefono))")
        .order("fecha", { ascending: true });
      if (isGz && profile?.zona_id && !isAdmin) {
        q = q.eq("tienda.zona_id", profile.zona_id);
      } else if (!isAdmin) {
        q = q.eq("gt_creador", user!.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isGt && !isAdmin && !isGz) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para Gerentes de Tienda o de Zona.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis turnos publicados</h1>
          <p className="text-sm text-muted-foreground">Publica vacantes y gestiona postulantes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Publicar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Publicar turno vacante</DialogTitle></DialogHeader>
            <PublicarForm tiendas={tiendas.data ?? []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["mis-turnos-gt"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {turnos.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!turnos.isLoading && (turnos.data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no has publicado turnos. Toca "Publicar" para crear el primero.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {(turnos.data ?? []).map((t: any) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t.tienda?.nombre}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatFecha(t.fecha)} · {t.turno}</span>
                    <Badge variant="outline">{negocioLabel(t.negocio)}</Badge>
                  </CardDescription>
                </div>
                <Badge variant={t.estado === "abierto" ? "default" : "secondary"}>{estadoLabel(t.estado)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {t.postulaciones?.length ?? 0} postulante(s)
              </div>
              {(t.postulaciones ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.agente?.nombre_completo ?? "Agente"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.agente?.telefono ?? ""} {p.mensaje ? `· "${p.mensaje}"` : ""}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={p.estado === "aprobada" ? "default" : p.estado === "rechazada" ? "destructive" : "secondary"} className="text-[10px]">
                      {estadoLabel(p.estado)}
                    </Badge>
                    {p.estado === "pendiente" && t.estado === "abierto" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                          const { error } = await supabase.from("postulaciones").update({ estado: "aprobada" }).eq("id", p.id);
                          if (error) toast.error(error.message); else { toast.success("Aprobado"); qc.invalidateQueries({ queryKey: ["mis-turnos-gt"] }); }
                        }}><Check className="h-4 w-4 text-primary" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                          const motivo = window.prompt("Motivo de rechazo (obligatorio):", "");
                          if (!motivo || !motivo.trim()) { toast.error("Debes indicar un motivo"); return; }
                          const { error } = await supabase.from("postulaciones").update({ estado: "rechazada", motivo_rechazo: motivo.trim() }).eq("id", p.id);
                          if (error) toast.error(error.message); else { toast.success("Rechazado"); qc.invalidateQueries({ queryKey: ["mis-turnos-gt"] }); }
                        }}><X className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}

                  </div>
                </div>
              ))}
              {t.estado === "abierto" && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                  if (!confirm("¿Cancelar este turno?")) return;
                  const { error } = await supabase.from("turnos_vacantes").update({ estado: "cancelado" }).eq("id", t.id);
                  if (error) toast.error(error.message); else { toast.success("Turno cancelado"); qc.invalidateQueries({ queryKey: ["mis-turnos-gt"] }); }
                }}>
                  <Trash2 className="h-4 w-4" /> Cancelar turno
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PublicarForm({ tiendas, onDone }: { tiendas: any[]; onDone: () => void }) {
  const { user } = useAuth();
  const [tiendaId, setTiendaId] = useState(tiendas.length === 1 ? tiendas[0].id : "");
  const [fecha, setFecha] = useState("");
  const [turno, setTurno] = useState<"AM" | "PM">("AM");
  const [negocio, setNegocio] = useState<Business>("productos");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [notas, setNotas] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      if (!tiendaId || !fecha) throw new Error("Selecciona tienda y fecha");
      const { error } = await supabase.from("turnos_vacantes").insert({
        tienda_id: tiendaId, fecha, turno, negocio,
        hora_inicio: horaInicio || null, hora_fin: horaFin || null,
        notas: notas || null, gt_creador: user!.id, estado: "abierto",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Turno publicado"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Tienda</Label>
        <Select value={tiendaId} onValueChange={setTiendaId} disabled={tiendas.length === 1}>
          <SelectTrigger><SelectValue placeholder="Selecciona tienda" /></SelectTrigger>
          <SelectContent>
            {tiendas.map((t) => <SelectItem key={t.id} value={t.id}>{t.codigo} · {t.nombre} — {t.zona?.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Turno</Label>
          <Select value={turno} onValueChange={(v) => setTurno(v as "AM" | "PM")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Negocio</Label>
        <Select value={negocio} onValueChange={(v) => setNegocio(v as Business)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="productos">Productos</SelectItem>
            <SelectItem value="mbk">MBK · Servicios Financieros</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Hora inicio (opcional)</Label>
          <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Hora fin (opcional)</Label>
          <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notas (opcional)</Label>
        <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <Button className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>Publicar turno</Button>
    </div>
  );
}
