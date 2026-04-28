import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    [
      "Faltan variables de entorno para migrar usuarios.",
      "Define SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY antes de ejecutar.",
      "Nunca expongas SUPABASE_SERVICE_ROLE_KEY en el frontend.",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllAuthUsersByEmail() {
  const usersByEmail = new Map();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];

    for (const user of users) {
      if (user.email) {
        usersByEmail.set(user.email.trim().toLowerCase(), user);
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function main() {
  const stats = {
    linked: 0,
    created: 0,
    migrated: 0,
    skippedMissingEmail: 0,
    skippedMissingPassword: 0,
  };

  console.log("Cargando usuarios legados desde public.usuarios...");

  const { data: legacyUsers, error } = await supabase
    .from("usuarios")
    .select("id, auth_user_id, email, password, n_usuario, nombre, apellidos, servicio, estamento, cargo")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const authUsersByEmail = await listAllAuthUsersByEmail();

  for (const legacyUser of legacyUsers || []) {
    const normalizedEmail = legacyUser.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      stats.skippedMissingEmail += 1;
      console.warn(`- Omitido ${legacyUser.id}: no tiene email.`);
      continue;
    }

    if (legacyUser.auth_user_id) {
      stats.linked += 1;
      continue;
    }

    if (!legacyUser.password) {
      stats.skippedMissingPassword += 1;
      console.warn(`- Omitido ${normalizedEmail}: no tiene password legado para migrar.`);
      continue;
    }

    let authUser = authUsersByEmail.get(normalizedEmail);

    if (!authUser) {
      const { data: createdUserData, error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: legacyUser.password,
        email_confirm: true,
        user_metadata: {
          n_usuario: legacyUser.n_usuario,
          nombre: legacyUser.nombre,
          apellidos: legacyUser.apellidos,
          servicio: legacyUser.servicio,
          estamento: legacyUser.estamento,
          cargo: legacyUser.cargo,
          legacy_usuario_id: legacyUser.id,
        },
      });

      if (createError) {
        throw createError;
      }

      authUser = createdUserData.user;
      authUsersByEmail.set(normalizedEmail, authUser);
      stats.created += 1;
      console.log(`- Auth creado para ${normalizedEmail}`);
    }

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({
        auth_user_id: authUser.id,
        email: normalizedEmail,
        password: null,
      })
      .eq("id", legacyUser.id);

    if (updateError) {
      throw updateError;
    }

    stats.migrated += 1;
    console.log(`- Vinculado ${normalizedEmail} -> ${authUser.id}`);
  }

  console.log("\nResumen migracion:");
  console.log(`- Filas ya vinculadas: ${stats.linked}`);
  console.log(`- Usuarios Auth creados: ${stats.created}`);
  console.log(`- Filas migradas ahora: ${stats.migrated}`);
  console.log(`- Omitidos sin email: ${stats.skippedMissingEmail}`);
  console.log(`- Omitidos sin password legado: ${stats.skippedMissingPassword}`);
  console.log("\nSi no quedaron usuarios sin auth_user_id, puedes ejecutar 009_finalize_auth_migration.sql.");
}

main().catch((error) => {
  console.error("\nFallo la migracion de usuarios:");
  console.error(error);
  process.exit(1);
});
