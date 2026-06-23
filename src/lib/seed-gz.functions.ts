import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface GZSeed {
  nombre: string;
  email: string;
  telefono: string;
  zona_nombre: string;
}

const GZ_LIST: GZSeed[] = [
  { nombre: "Cristina Maldonado",     email: "cristina.maldonado@ampm.com.ni", telefono: "8910-5373", zona_nombre: "MGA Centro"    },
  { nombre: "Erica Zamora",           email: "erica.zamora@ampm.com.ni",       telefono: "5777-1443", zona_nombre: "MGA Norte"     },
  { nombre: "Carlos Sandoval",        email: "carlos.sandoval@ampm.com.ni",    telefono: "8747-1821", zona_nombre: "MGA Sur"       },
  { nombre: "Engels Castellón",       email: "engels.castellon@ampm.com.ni",   telefono: "8745-2000", zona_nombre: "MGA Noreste"   },
  { nombre: "Daniel Centeno",         email: "daniel.centeno@ampm.com.ni",     telefono: "5776-3587", zona_nombre: "FOR Sur 1"     },
  { nombre: "Cristhian Guzmán",       email: "cristhian.guzman@ampm.com.ni",   telefono: "8827-8139", zona_nombre: "FOR Sur 2"     },
  { nombre: "Tania Ruiz",             email: "tania.ruiz@ampm.com.ni",         telefono: "5788-0999", zona_nombre: "FOR Norte"     },
  { nombre: "Marcos Muñoz Zárate",    email: "marcos.munoz@ampm.com.ni",       telefono: "5788-0980", zona_nombre: "FOR Occidente" },
  { nombre: "Yuri Reyes",             email: "yuri.reyes@ampm.com.ni",         telefono: "5788-0977", zona_nombre: "FOR Centro 1"  },
  { nombre: "Julio Gutiérrez",        email: "julio.gutierrez@ampm.com.ni",    telefono: "8651-4577", zona_nombre: "FOR Centro 2"  },
];

const TEMP_PASSWORD = "CoverTurnos2026!";

export const seedGerentesZona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Authorize: caller must be admin
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: solo administradores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load zonas
    const { data: zonas, error: zErr } = await supabaseAdmin
      .from("zonas")
      .select("id, nombre");
    if (zErr) throw new Error(zErr.message);
    const zonaMap = new Map((zonas ?? []).map((z) => [z.nombre, z.id]));

    const results: Array<{ email: string; status: string; detail?: string }> = [];

    for (const gz of GZ_LIST) {
      try {
        const zonaId = zonaMap.get(gz.zona_nombre);
        if (!zonaId) {
          results.push({ email: gz.email, status: "error", detail: `Zona no encontrada: ${gz.zona_nombre}` });
          continue;
        }

        // Find existing auth user by email
        let userIdToUse: string | null = null;
        const { data: existing, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (lookupErr) throw new Error(lookupErr.message);
        const found = existing.users.find((u) => u.email?.toLowerCase() === gz.email.toLowerCase());

        if (found) {
          userIdToUse = found.id;
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: gz.email,
            password: TEMP_PASSWORD,
            email_confirm: true,
            user_metadata: { nombre_completo: gz.nombre, telefono: gz.telefono },
          });
          if (createErr) throw new Error(createErr.message);
          userIdToUse = created.user!.id;
        }

        // Upsert profile (trigger creates it on insert; ensure fields)
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userIdToUse,
            nombre_completo: gz.nombre,
            telefono: gz.telefono,
            zona_id: zonaId,
            activo: true,
          }, { onConflict: "id" });
        if (profErr) throw new Error(profErr.message);

        // Assign gz role
        const { error: roleInsErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userIdToUse, role: "gz" });
        if (roleInsErr && !roleInsErr.message.toLowerCase().includes("duplicate")) {
          throw new Error(roleInsErr.message);
        }

        results.push({ email: gz.email, status: found ? "updated" : "created" });
      } catch (e) {
        results.push({ email: gz.email, status: "error", detail: (e as Error).message });
      }
    }

    return { results, tempPassword: TEMP_PASSWORD };
  });
