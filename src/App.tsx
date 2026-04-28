import React from "react";
import type { Session } from "@supabase/supabase-js";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { supabase } from "./lib/supabase";
import { getCurrentSession, getUserProfile, signOutSecure } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/env";
import type { AuthState } from "./types";

function App() {
  const [authState, setAuthState] = React.useState<AuthState>({
    initialized: false,
    session: null,
    profile: null,
    profileError: null,
  });

  React.useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured()) {
      setAuthState({
        initialized: true,
        session: null,
        profile: null,
        profileError: null,
      });
      return;
    }

    const hydrateAuthState = async (session: Session | null) => {
      try {
        const profile = session?.user ? await getUserProfile(session.user.id) : null;

        if (!isActive) {
          return;
        }

        setAuthState({
          initialized: true,
          session,
          profile,
          profileError:
            session?.user && !profile
              ? "Tu cuenta existe en Auth, pero no encontramos tu perfil interno."
              : null,
        });
      } catch (error) {
        console.error("Auth hydration error:", error);

        if (!isActive) {
          return;
        }

        setAuthState({
          initialized: true,
          session,
          profile: null,
          profileError: "No pudimos cargar tu perfil.",
        });
      }
    };

    const bootstrap = async () => {
      try {
        const session = await getCurrentSession();
        await hydrateAuthState(session);
      } catch (error) {
        console.error("Initial session error:", error);

        if (!isActive) {
          return;
        }

        setAuthState({
          initialized: true,
          session: null,
          profile: null,
          profileError: null,
        });
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateAuthState(session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOutSecure();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!authState.initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white px-6 py-4 text-sm text-gray-600 shadow-sm">
          Cargando sesión...
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
        <div className="max-w-md rounded-xl border border-amber-200 bg-white px-6 py-5 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-900">Falta configurar Supabase</p>
          <p className="mt-2 text-amber-800/90">
            En la carpeta <code className="rounded bg-amber-100 px-1">frontend</code>, copia{" "}
            <code className="rounded bg-amber-100 px-1">.env.example</code> a{" "}
            <code className="rounded bg-amber-100 px-1">.env</code> y define{" "}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> y{" "}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> con el
            proyecto nuevo (Dashboard → Settings → API). Reinicia <code className="rounded bg-amber-100 px-1">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  if (authState.session) {
    return (
      <Dashboard
        authUser={authState.session.user}
        currentUser={authState.profile}
        profileError={authState.profileError}
        onLogout={handleLogout}
      />
    );
  }

  return <Login />;
}

export default App;
