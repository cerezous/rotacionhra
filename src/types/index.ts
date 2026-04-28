import type { Session } from "@supabase/supabase-js";

export type {
  PersonalRow,
  AsumeRow,
  CambioRow,
  TablaPagoRow,
  EstadoGestionFila,
} from "./database";

/** Fila de `public.usuarios` vinculada a Auth */
export interface UsuarioProfile {
  id: string;
  auth_user_id: string;
  hospital_id: string | null;
  servicio_id: string | null;
  n_usuario: string | null;
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  cargo: string | null;
  /** Rol de aplicación: `super_admin`, `jefe_servicio`, `coordinador_kine`, `supervisor_enfermeria` */
  rol: string | null;
  activo: boolean | null;
}

export interface AuthState {
  initialized: boolean;
  session: Session | null;
  profile: UsuarioProfile | null;
  profileError: string | null;
}
