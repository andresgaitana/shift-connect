
# CoverTurnos — App de cobertura de turnos

## Qué vamos a construir (MVP)

Una app web responsive (se ve perfecto en celular) donde:

- **El GT** inicia sesión, ve las tiendas que le tocan y publica los turnos que necesita cubrir esta semana.
- **El agente (Productos o MBK)** inicia sesión, ve sólo los turnos disponibles para su negocio, filtra por zona/fecha y se postula con un tap.
- **El GT** revisa las postulaciones, aprueba a un agente y el turno queda **cubierto** (los demás postulantes ven que ya se asignó).

## Roles y pantallas

**Agente (Productos / MBK)**
- Lista de turnos disponibles (su negocio), con filtros: zona (Managua / Foráneas + 10 zonas), fecha, turno AM/PM.
- Detalle del turno: tienda, zona, dirección, mapa, fecha, horario, GT a cargo.
- Botón "Postularme" → estado: pendiente / aprobado / rechazado.
- "Mis postulaciones" para ver el historial.

**GT**
- "Mis turnos publicados" (esta semana / próximas).
- Botón "Publicar turno vacante" → formulario: tienda, fecha, AM/PM, negocio (Productos/MBK), notas.
- Carga masiva opcional (varios turnos de golpe) — útil al cerrar el horario semanal.
- Lista de postulantes por turno → Aprobar / Rechazar.

**Admin** (tú u operaciones)
- Gestionar catálogo de tiendas y zonas.
- Asignar roles a usuarios nuevos (gt / agente / admin) y su negocio.

## Modelo de datos (resumen)

- `profiles` — nombre, teléfono, negocio (productos / mbk), zona asignada.
- `user_roles` — rol del usuario (admin / gt / agente) en tabla aparte (seguridad).
- `zonas` — 10 zonas (Managua x4, Foráneas x6).
- `tiendas` — 87 tiendas con zona, dirección, lat/lng para mapa.
- `turnos_vacantes` — tienda, fecha, turno (AM/PM), negocio, estado (abierto / asignado / cancelado), gt_creador.
- `postulaciones` — turno, agente, estado (pendiente / aprobada / rechazada), timestamps.

Reglas de seguridad (RLS): cada agente sólo ve turnos de su negocio; un GT sólo gestiona sus propios turnos; sólo admin edita el catálogo.

## Stack técnico

- React + Tailwind + shadcn/ui (lo que ya tiene el proyecto).
- **Lovable Cloud** para auth (email + contraseña), base de datos PostgreSQL y permisos.
- Mapa: link directo a Google Maps con la dirección/coordenadas (sin costo, sin API keys).
- Mobile-first: la mayoría de agentes usarán el celular.

## Plan de entrega por fases

**Fase 1 — Cimientos** (lo que haré primero)
1. Activar Lovable Cloud.
2. Crear tablas, roles y políticas RLS.
3. Cargar las 10 zonas y un set inicial de tiendas (te pediré un CSV o las cargamos a mano).
4. Login / registro / cierre de sesión + pantalla "esperando aprobación de rol".

**Fase 2 — Flujo GT**
5. Pantalla de publicar turno (individual + masivo por semana).
6. Listado de turnos del GT con sus postulantes.
7. Aprobar / rechazar postulación.

**Fase 3 — Flujo Agente**
8. Listado de turnos disponibles con filtros.
9. Detalle + postulación.
10. "Mis postulaciones".

**Fase 4 — Admin**
11. CRUD de tiendas y zonas.
12. Asignar roles a usuarios.

## Lo que NO incluye este MVP (lo dejamos para v2)

- Notificaciones push o por WhatsApp (en v2 podemos integrar email o WhatsApp Business).
- Pago / bonos por turno cubierto.
- Reportes de rotación y métricas por tienda.
- App nativa (esto es web, se instala en el celular como PWA si quieres).

## Lo que voy a necesitar de ti durante el build

- Listado de las **87 tiendas** con su zona y dirección (CSV o Excel). Si no lo tienes a la mano, arrancamos con 5–10 tiendas de prueba.
- Decidir el **primer usuario admin** (tu correo) para que puedas asignar roles al resto.

¿Le doy luz verde y arranco con la Fase 1?
