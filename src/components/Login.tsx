import React from "react";
import { Button, Card, CardBody, Chip, Form, Input } from "@heroui/react";
import {
  ArrowRightIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase";
import { getLoginErrorMessage } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/env";

export default function Login() {
  const [password, setPassword] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setLoginError(null);
    setLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        setLoginError("Falta configurar Supabase en .env (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).");
        setLoading(false);
        return;
      }

      const rawEmail = fd.get("email");
      const emailValue = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
      const rawPass = fd.get("password");
      const passwordValue = typeof rawPass === "string" ? rawPass : "";

      if (!emailValue || !passwordValue) {
        setLoginError("Correo o contraseña incorrectos.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });

      if (error) {
        console.error("Login error:", error);
        setLoginError(getLoginErrorMessage(error));
        setLoading(false);
        return;
      }

      setPassword("");
    } catch (err) {
      console.error("Login exception:", err);
      setLoginError("No fue posible iniciar sesión. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClassNames = {
    base: "w-full",
    inputWrapper:
      "min-h-13 rounded-2xl border border-[var(--login-border)] bg-white/90 px-2 shadow-none transition-all duration-200 group-data-[focus=true]:border-[var(--login-accent)] group-data-[focus=true]:bg-white group-data-[hover=true]:border-[var(--login-accent-soft)]",
    label: "text-[var(--login-muted)] font-medium",
    input: "text-sm text-slate-900 placeholder:text-slate-400",
    innerWrapper: "gap-2",
  };

  return (
    <div className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-8rem] top-[-7rem] h-64 w-64 rounded-full bg-[var(--login-accent-soft)] blur-3xl" />
        <div className="absolute bottom-[-9rem] right-[-6rem] h-72 w-72 rounded-full bg-[var(--login-accent-strong)]/25 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>

      <Card className="relative w-full max-w-5xl overflow-hidden border border-white/60 bg-white/75 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <CardBody className="grid gap-0 p-0 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative flex flex-col justify-between gap-8 bg-[linear-gradient(160deg,var(--login-panel)_0%,var(--login-panel-strong)_100%)] px-6 py-8 text-slate-50 sm:px-8 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%),linear-gradient(180deg,transparent,rgba(15,23,42,0.18))]" />
            <div className="relative space-y-5">
              <Chip
                className="border border-white/20 bg-white/12 text-white backdrop-blur-sm"
                radius="full"
                startContent={<ShieldCheckIcon className="ml-2 h-4 w-4" />}
                variant="flat"
              >
                Acceso seguro
              </Chip>

              <div className="space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-100/80">
                  Unidad de Rotaciones
                </p>
                <h1 className="max-w-md text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Inicia sesión y retoma la gestión del equipo clínico.
                </h1>
                <p className="max-w-lg text-sm leading-6 text-slate-100/80 sm:text-base">
                  Revisa turnos, movimientos y datos del personal desde una sola vista pensada para
                  el trabajo diario de la unidad.
                </p>
              </div>
            </div>

            <div className="relative grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/14 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">
                  Disponibilidad
                </p>
                <p className="mt-2 text-lg font-semibold text-white">UTI centralizada</p>
                <p className="mt-1 text-sm text-slate-100/75">
                  Accede a enfermería, TENS y auxiliares en un mismo lugar.
                </p>
              </div>
              <div className="rounded-3xl border border-white/14 bg-slate-950/20 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Resguardo</p>
                <p className="mt-2 text-lg font-semibold text-white">Credenciales protegidas</p>
                <p className="mt-1 text-sm text-slate-100/75">
                  El acceso está validado mediante autenticación segura.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center bg-white/88 px-6 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--login-accent)]">
                  Bienvenido
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Inicio de sesión
                </h2>
                <p className="text-sm leading-6 text-[var(--login-muted)]">
                  Ingresa con tu correo institucional para continuar.
                </p>
              </div>

              {loginError && (
                <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {loginError}
                </div>
              )}

              <Form className="w-full space-y-5" onSubmit={onSubmit}>
                <div className="flex w-full flex-col gap-4">
                  <Input
                    isRequired
                    size="lg"
                    variant="flat"
                    radius="lg"
                    classNames={inputClassNames}
                    label="Correo electrónico"
                    labelPlacement="outside"
                    name="email"
                    autoComplete="username"
                    placeholder="nombre@hospital.cl"
                    type="email"
                    value={email}
                    startContent={<EnvelopeIcon className="h-5 w-5 text-slate-400" />}
                    onValueChange={(val) => {
                      setEmail(val);
                      if (loginError) setLoginError(null);
                    }}
                  />

                  <Input
                    isRequired
                    size="lg"
                    variant="flat"
                    radius="lg"
                    classNames={inputClassNames}
                    label="Contraseña"
                    labelPlacement="outside"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    startContent={<LockClosedIcon className="h-5 w-5 text-slate-400" />}
                    endContent={
                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="text-slate-400 transition hover:text-slate-600"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    }
                    onValueChange={(val) => {
                      setPassword(val);
                      if (loginError) setLoginError(null);
                    }}
                  />

                  <Button
                    className="mt-2 h-13 w-full rounded-2xl bg-[var(--login-accent)] text-sm font-semibold text-white shadow-[0_18px_35px_rgba(14,116,144,0.24)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--login-accent-strong)]"
                    size="lg"
                    color="primary"
                    radius="lg"
                    type="submit"
                    isLoading={loading}
                    endContent={!loading ? <ArrowRightIcon className="h-4 w-4" /> : null}
                  >
                    Entrar
                  </Button>

                  <p className="text-center text-xs leading-5 text-[var(--login-muted)]">
                    Uso exclusivo para personal autorizado.
                  </p>
                </div>
              </Form>

            </div>
          </section>
        </CardBody>
      </Card>
    </div>
  );
}
