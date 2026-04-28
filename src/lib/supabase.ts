import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

/**
 * Cliente browser con sesión persistente, refresh automático y flujo PKCE (recomendado en SPA).
 * @see https://supabase.com/docs/guides/auth/sessions/pkce-flow
 */
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    "[Rotaciones] Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en frontend/.env (copia desde .env.example)"
  );
}
