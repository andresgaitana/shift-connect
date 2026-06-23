import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock } from "lucide-react";
import { formatFecha, negocioLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/turnos")({
  head: () => ({ meta: [{ title: "Turnos disponibles — CoverTurnos" }] }),
  component: TurnosListPage,
});

function TurnosListPage() {
  const { profile, roles } = useAuth();
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [zonaFilter, setZonaFilter] = useState<string>("all");
  const [turnoFilter, setTurnoFilter] = useState<string>("all");

  const zonas = useQuery({
    queryKey: ["zonas-grupo"],
    queryFn: async () => (await supabase.from("zonas").select("id, nombre, grupo").order("nombre")).data ?? [],
  });

  const turnos = useQuery({
    queryKey: ["turnos-abiertos", profile?.negocio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turnos_vacantes")
        .select("id, fecha, turno, negocio, hora_inicio, hora_fin, notas, tienda:tiendas(id, nombre, direccion, zona_id, zona:zonas(nombre, grupo))")
        .eq("estado", "abierto")
        .gte("fecha", new Date().toISOString().slice(0, 10))
        .order("fecha", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!roles.includes("agente")) {
    return <p className="text-sm text-muted-foreground">Esta sección es solo para agentes.</p>;
  }
  if (!profile?.negocio) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Selecciona tu negocio en <Link to="/app" className="text-primary underline">Inicio</Link> para ver los turnos disponibles.
        </CardContent>
      </Card>
    );
  }

  const zonasFiltradas = (zonas.data ?? []).filter((z) => regionFilter === "all" || z.grupo === regionFilter);

  const filtered = (turnos.data ?? []).filter((t) => {
    if (regionFilter !== "all" && t.tienda?.zona?.grupo !== regionFilter) return false;
    if (zonaFilter !== "all" && t.tienda?.zona_id !== zonaFilter) return false;
    if (turnoFilter !== "all" && t.turno !== turnoFilter) return false;
    return true;
  });

  const regionLabel = (g: string) => (g === "managua" ? "Managua (MGA)" : g === "foraneas" ? "Foráneas (FOR)" : g);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Turnos disponibles</h1>
        <p className="text-sm text-muted-foreground">{negocioLabel(profile.negocio)} · {filtered.length} disponibles</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v); setZonaFilter("all"); }}>
          <SelectTrigger><SelectValue placeholder="Región" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las regiones</SelectItem>
            <SelectItem value="managua">Managua (MGA)</SelectItem>
            <SelectItem value="foraneas">Foráneas (FOR)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zonaFilter} onValueChange={setZonaFilter}>
          <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las zonas</SelectItem>
            {zonasFiltradas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={turnoFilter} onValueChange={setTurnoFilter}>
          <SelectTrigger><SelectValue placeholder="Turno" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">AM y PM</SelectItem>
            <SelectItem value="AM">Solo AM</SelectItem>
            <SelectItem value="PM">Solo PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {regionFilter !== "all" && (
        <p className="text-xs text-muted-foreground">Mostrando solo {regionLabel(regionFilter)}.</p>
      )}

      {turnos.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!turnos.isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay turnos disponibles con esos filtros.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {filtered.map((t) => (
          <Link key={t.id} to="/app/turnos/$id" params={{ id: t.id }}>
            <Card className="transition hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold">{t.tienda?.nombre}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {t.tienda?.zona?.nombre ?? "—"}
                    </div>
                  </div>
                  <Badge variant={t.turno === "AM" ? "secondary" : "default"} className="shrink-0">{t.turno}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatFecha(t.fecha)}</span>
                  {(t.hora_inicio || t.hora_fin) && (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {t.hora_inicio?.slice(0,5) ?? "—"} – {t.hora_fin?.slice(0,5) ?? "—"}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
