import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { formatFecha, estadoLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/mis-postulaciones")({
  head: () => ({ meta: [{ title: "Mis postulaciones — CoverTurnos" }] }),
  component: MisPostulacionesPage,
});

function MisPostulacionesPage() {
  const { user, roles } = useAuth();

  const q = useQuery({
    queryKey: ["mis-postulaciones", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("postulaciones")
        .select("id, estado, created_at, turno:turnos_vacantes(id, fecha, turno, estado, tienda:tiendas(nombre, zona:zonas(nombre)))")
        .eq("agente_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!roles.includes("agente")) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para agentes.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mis postulaciones</h1>
        <p className="text-sm text-muted-foreground">Historial y estado de tus solicitudes.</p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no te has postulado a ningún turno.
        </CardContent></Card>
      )}

      <div className="grid gap-3">
        {(q.data ?? []).map((p: any) => (
          <Link key={p.id} to="/app/turnos/$id" params={{ id: p.turno?.id }}>
            <Card className="transition hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold">{p.turno?.tienda?.nombre ?? "—"}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {p.turno?.tienda?.zona?.nombre ?? "—"}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> {p.turno?.fecha ? formatFecha(p.turno.fecha) : "—"} · {p.turno?.turno}
                    </div>
                  </div>
                  <Badge variant={p.estado === "aprobada" ? "default" : p.estado === "rechazada" ? "destructive" : "secondary"}>
                    {estadoLabel(p.estado)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
