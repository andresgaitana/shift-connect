// Edge Function: notify
// Envía notificaciones por correo (SMTP) ante eventos de la base de datos.
// Se invoca desde Database Webhooks de Supabase:
//   - INSERT en turnos_vacantes  -> avisa a los agentes del negocio
//   - INSERT en postulaciones     -> avisa al GT dueño del turno
//   - UPDATE en postulaciones     -> avisa al agente (aprobada / rechazada)
//
// Secretos requeridos (Supabase -> Edge Functions -> Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   WEBHOOK_SECRET   (clave compartida; el webhook la manda en x-webhook-secret)
//   APP_URL          (ej. https://andresgaitana.github.io/shift-connect)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = Deno.env.get("SMTP_HOST")!;
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? SMTP_USER;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://andresgaitana.github.io/shift-connect").replace(/\/$/, "");

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const NEGOCIO_LABEL: Record<string, string> = { productos: "Productos", mbk: "MBK · Serv. Financieros" };

async function sendMail(to: string[], subject: string, html: string) {
  if (!to.length) return;
  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_PORT === 465, // 465 = SSL directo; 587 = STARTTLS (tls:false)
      auth: { username: SMTP_USER, password: SMTP_PASS },
    },
  });
  try {
    // Un solo envío con todos los destinatarios en BCC (privacidad entre agentes).
    await client.send({
      from: SMTP_FROM,
      to: SMTP_FROM,
      bcc: to,
      subject,
      content: "text/html",
      html,
    });
  } finally {
    await client.close();
  }
}

async function emailOf(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

function turnoHtml(t: any, tiendaNombre: string, direccion: string | null) {
  const fecha = t.fecha;
  const horas = t.hora_inicio ? ` · ${String(t.hora_inicio).slice(0, 5)}–${String(t.hora_fin ?? "").slice(0, 5)}` : "";
  return `
    <h2>Nuevo turno disponible</h2>
    <p><strong>${tiendaNombre}</strong></p>
    <ul>
      <li>Fecha: <strong>${fecha}</strong> · Turno <strong>${t.turno}</strong>${horas}</li>
      <li>Negocio: ${NEGOCIO_LABEL[t.negocio] ?? t.negocio}</li>
      ${direccion ? `<li>Dirección: ${direccion}</li>` : ""}
      ${t.notas ? `<li>Notas: ${t.notas}</li>` : ""}
    </ul>
    <p><a href="${APP_URL}/app/turnos/${t.id}">Ver y postularme al turno</a></p>`;
}

async function handleTurnoInsert(t: any) {
  // Datos de la tienda
  const { data: tienda } = await admin
    .from("tiendas").select("nombre, direccion").eq("id", t.tienda_id).maybeSingle();

  // Agentes del mismo negocio
  const [{ data: profs }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("id").eq("negocio", t.negocio),
    admin.from("user_roles").select("user_id").eq("role", "agente"),
  ]);
  const agentes = new Set((roles ?? []).map((r: any) => r.user_id));
  const ids = (profs ?? []).map((p: any) => p.id).filter((id: string) => agentes.has(id));
  if (!ids.length) return { skipped: "sin agentes del negocio" };

  // Correos de esos agentes
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const wanted = new Set(ids);
  const correos = (list?.users ?? []).filter((u) => wanted.has(u.id) && u.email).map((u) => u.email!);
  if (!correos.length) return { skipped: "agentes sin correo" };

  await sendMail(
    correos,
    `Nuevo turno disponible — ${tienda?.nombre ?? "Tienda"} ${t.fecha} ${t.turno}`,
    turnoHtml(t, tienda?.nombre ?? "Tienda", tienda?.direccion ?? null),
  );
  return { notified: correos.length };
}

async function handlePostulacionInsert(p: any) {
  const { data: t } = await admin
    .from("turnos_vacantes").select("id, fecha, turno, gt_creador, tienda_id").eq("id", p.turno_id).maybeSingle();
  if (!t) return { skipped: "turno no encontrado" };
  const [gtEmail, { data: tienda }, { data: agente }] = await Promise.all([
    emailOf(t.gt_creador),
    admin.from("tiendas").select("nombre").eq("id", t.tienda_id).maybeSingle(),
    admin.from("profiles").select("nombre_completo, telefono").eq("id", p.agente_id).maybeSingle(),
  ]);
  if (!gtEmail) return { skipped: "GT sin correo" };
  const html = `
    <h2>Nueva postulación a tu turno</h2>
    <p><strong>${agente?.nombre_completo ?? "Un agente"}</strong>${agente?.telefono ? ` (${agente.telefono})` : ""} se postuló a:</p>
    <ul>
      <li>${tienda?.nombre ?? "Tienda"} — ${t.fecha} · Turno ${t.turno}</li>
      ${p.mensaje ? `<li>Mensaje: "${p.mensaje}"</li>` : ""}
    </ul>
    <p><a href="${APP_URL}/app/gt">Aprobar o rechazar postulantes</a></p>`;
  await sendMail([gtEmail], `Nueva postulación — ${tienda?.nombre ?? "Tienda"} ${t.fecha} ${t.turno}`, html);
  return { notified: 1 };
}

async function handlePostulacionUpdate(p: any, old: any) {
  if (p.estado === old?.estado) return { skipped: "estado sin cambio" };
  if (p.estado !== "aprobada" && p.estado !== "rechazada") return { skipped: "estado no notificable" };
  const agenteEmail = await emailOf(p.agente_id);
  if (!agenteEmail) return { skipped: "agente sin correo" };
  const { data: t } = await admin
    .from("turnos_vacantes").select("fecha, turno, tienda_id").eq("id", p.turno_id).maybeSingle();
  const { data: tienda } = t
    ? await admin.from("tiendas").select("nombre").eq("id", t.tienda_id).maybeSingle()
    : { data: null };
  const aprobada = p.estado === "aprobada";
  const html = `
    <h2>Tu postulación fue ${aprobada ? "APROBADA ✅" : "rechazada"}</h2>
    <p>${tienda?.nombre ?? "Tienda"} — ${t?.fecha ?? ""} · Turno ${t?.turno ?? ""}</p>
    ${!aprobada && p.motivo_rechazo ? `<p>Motivo: ${p.motivo_rechazo}</p>` : ""}
    <p><a href="${APP_URL}/app/mis-postulaciones">Ver mis postulaciones</a></p>`;
  await sendMail([agenteEmail], `Postulación ${aprobada ? "aprobada" : "rechazada"} — ${tienda?.nombre ?? "Tienda"}`, html);
  return { notified: 1 };
}

Deno.serve(async (req) => {
  // Protección simple por clave compartida
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const { type, table, record, old_record } = body ?? {};
  try {
    let result: unknown = { ignored: true };
    if (table === "turnos_vacantes" && type === "INSERT") result = await handleTurnoInsert(record);
    else if (table === "postulaciones" && type === "INSERT") result = await handlePostulacionInsert(record);
    else if (table === "postulaciones" && type === "UPDATE") result = await handlePostulacionUpdate(record, old_record);
    return new Response(JSON.stringify({ ok: true, result }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("notify error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
});
