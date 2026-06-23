import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, Clock, MapPin, ExternalLink } from "lucide-react";
import { formatFecha, negocioLabel, estadoLabel } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/turnos/$id")({
  component: TurnoDetail,
});

function TurnoDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("");

  const q = useQuery({
    queryKey: ["turno", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnos_vacantes")
        .select("*, tienda:tiendas(*, zona:zonas(nombre))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myPost = useQuery({
    queryKey: ["mi-postulacion", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postulaciones")
        .select("id, estado, mensaje")
        .eq("turno_id", id).eq("agente_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const postular = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("postulaciones").insert({
        turno_id: id, agente_id: user!.id, mensaje: mensaje || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Postulación enviada!");
      qc.invalidateQueries({ queryKey: ["mi-postulacion", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!myPost.data) return;
      const { error } = await supabase.from("postulaciones").delete().eq("id", myPost.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Postulación cancelada");
      qc.invalidateQueries({ queryKey: ["mi-postulacion", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!q.data) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/turnos" })}><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
      <p className="text-sm text-muted-foreground">Este turno ya no está disponible.</p>
    </div>
  );

  const t = q.data;
  const tienda = (t as any).tienda;
  const mapsUrl = tienda?.latitud && tienda?.longitud
    ? `https://www.google.com/maps/search/?api=1&query=${tienda.latitud},${tienda.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tienda?.direccion ?? tienda?.nombre ?? "")}`;

  return (
    <div className="space-y-4">
      <Link to="/app/turnos" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{tienda?.nombre}</CardTitle>
              <p className="text-sm text-muted-foreground">{tienda?.zona?.nombre}</p>
            </div>
            <Badge variant={t.estado === "abierto" ? "default" : "secondary"}>{estadoLabel(t.estado)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{formatFecha(t.fecha)}</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Turno <strong>{t.turno}</strong>{t.hora_inicio ? ` · ${t.hora_inicio.slice(0,5)} – ${t.hora_fin?.slice(0,5) ?? ""}` : ""}</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{tienda?.direccion}</div>
          <div className="text-muted-foreground">Negocio: {negocioLabel(t.negocio)}</div>
          {t.notas && <div className="rounded-md bg-muted p-3 text-foreground/90">📝 {t.notas}</div>}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Abrir en Google Maps <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {t.estado === "abierto" && !myPost.data && (
        <Card>
          <CardHeader><CardTitle className="text-base">Postularme</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Mensaje opcional para el GT…" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} />
            <Button className="w-full" disabled={postular.isPending} onClick={() => postular.mutate()}>Enviar postulación</Button>
          </CardContent>
        </Card>
      )}

      {myPost.data && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tu postulación</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={myPost.data.estado === "aprobada" ? "default" : myPost.data.estado === "rechazada" ? "destructive" : "secondary"}>
              {estadoLabel(myPost.data.estado)}
            </Badge>
            {myPost.data.mensaje && <p className="text-sm text-muted-foreground">"{myPost.data.mensaje}"</p>}
            {myPost.data.estado === "pendiente" && (
              <Button variant="outline" size="sm" onClick={() => cancelar.mutate()} disabled={cancelar.isPending}>
                Cancelar postulación
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
