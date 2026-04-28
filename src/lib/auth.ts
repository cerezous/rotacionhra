import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UsuarioProfile } from "../types";

/**
 * Cierra sesión en este dispositivo y revoca el refresh token en el servidor (scope global).
 */
export async function signOutSecure() {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    throw error;
  }
}

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

export async function getUserProfile(authUserId: string): Promise<UsuarioProfile | null> {
  if (!authUserId) {
    return null;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, auth_user_id, hospital_id, servicio_id, n_usuario, nombre, apellidos, email, cargo, rol, activo")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UsuarioProfile | null;
}

export function getLoginErrorMessage(error: AuthError | Error | null | undefined) {
  if (!error) {
    return "No fue posible iniciar sesión.";
  }

  const message = error.message?.toLowerCase() || "";

  if (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed") ||
    message.includes("invalid_credentials")
  ) {
    return "Correo o contraseña incorrectos.";
  }

  return "No fue posible iniciar sesión. Inténtalo nuevamente.";
}
