/**
 * Variables públicas de Vite (solo VITE_* se exponen al cliente).
 * La anon key está pensada para usarse en el navegador; nunca pongas la service_role aquí.
 */
export function getSupabaseEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}
