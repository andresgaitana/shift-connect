export function formatFecha(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("es-NI", { weekday: "long", day: "numeric", month: "long" });
}

export function negocioLabel(n: "productos" | "mbk" | null | undefined) {
  if (n === "productos") return "Productos";
  if (n === "mbk") return "MBK · Serv. Financieros";
  return "—";
}

export function estadoLabel(e: string) {
  return ({ abierto: "Abierto", asignado: "Asignado", cancelado: "Cancelado", pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" } as Record<string, string>)[e] ?? e;
}
