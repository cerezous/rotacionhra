import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, SIDEBAR_WIDTH_COLLAPSED } from "./Sidebar";
import type { Servicio } from "./Sidebar";
import { Card, CardBody } from "@heroui/react";
import Kinesiologia from "./Kinesiologia";
import Enfermeria from "./Enfermeria";
import Tens from "./Tens";
import Auxiliares from "./Auxiliares";
import { supabase } from "../lib/supabase";
import { AppShellProvider, MOBILE_APP_HEADER_PX } from "../context/AppShellContext";

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  React.useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatches(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, [query]);

  return matches;
}

type ViewState = { servicioId: string; servicioCodigo: string; estamento: string };
const TABS_VALIDAS = new Set(["rotacion", "personal", "gestion"]);
const ESTAMENTOS_VALIDOS = new Set(["enfermeria", "kinesiologia", "tens", "auxiliares"]);

const getUrlViewState = (): ViewState & { tab: string } => {
  if (typeof window === "undefined") {
    return { servicioId: "", servicioCodigo: "", estamento: "enfermeria", tab: "rotacion" };
  }
  const params = new URLSearchParams(window.location.search);
  const servicioId = String(params.get("servicio") || "").trim();
  const estamentoRaw = String(params.get("estamento") || "enfermeria").trim().toLowerCase();
  const tabRaw = String(params.get("tab") || "rotacion").trim().toLowerCase();
  return {
    servicioId,
    servicioCodigo: "",
    estamento: ESTAMENTOS_VALIDOS.has(estamentoRaw) ? estamentoRaw : "enfermeria",
    tab: TABS_VALIDAS.has(tabRaw) ? tabRaw : "rotacion",
  };
};

export default function Dashboard({ authUser, currentUser, profileError, onLogout }) {
  const [view, setView] = React.useState<ViewState & { tab: string }>(() => getUrlViewState());
  const [servicios, setServicios] = React.useState<Servicio[]>([]);
  const [sidebarWidth, setSidebarWidth] = React.useState(SIDEBAR_WIDTH_COLLAPSED);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const isMd = useMediaQuery("(min-width: 768px)");
  const skipNextHistoryPushRef = React.useRef(false);

  const displayName = currentUser
    ? `${currentUser.nombre} ${currentUser.apellidos}`.trim()
    : authUser?.email || "Usuario autenticado";

  const handleSidebarWidth = React.useCallback((w: number) => {
    setSidebarWidth(w);
  }, []);

  // Cargar servicios del hospital del usuario actual
  React.useEffect(() => {
    if (!currentUser?.hospital_id) return;
    supabase
      .from("servicios")
      .select("id, codigo, nombre")
      .eq("hospital_id", currentUser.hospital_id)
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const list = (data as Servicio[]) || [];
        setServicios(list);
        if (!list.length) return;
        setView((prev) => {
          const selected = list.find((item) => item.id === prev.servicioId) || list[0];
          return {
            ...prev,
            servicioId: selected.id,
            servicioCodigo: selected.codigo,
            estamento: ESTAMENTOS_VALIDOS.has(prev.estamento) ? prev.estamento : "enfermeria",
            tab: TABS_VALIDAS.has(prev.tab) ? prev.tab : "rotacion",
          };
        });
      });
  }, [currentUser?.hospital_id]);

  const handleNavigate = (servicioId: string, servicioCodigo: string, estamento: string) => {
    if (servicioId === "__logout__") {
      void onLogout?.();
      return;
    }
    setView({
      servicioId,
      servicioCodigo,
      estamento: ESTAMENTOS_VALIDOS.has(estamento) ? estamento : "enfermeria",
      tab: "rotacion",
    });
  };

  const handleTabChange = React.useCallback((tab: string) => {
    setView((prev) => ({ ...prev, tab: TABS_VALIDAS.has(tab) ? tab : "rotacion" }));
  }, []);

  const renderContent = () => {
    if (!view.servicioId) return null;
    const hospitalId = currentUser?.hospital_id ?? "";
    switch (view.estamento) {
      case "kinesiologia":
        return <Kinesiologia servicio={view.servicioCodigo} servicioId={view.servicioId} hospitalId={hospitalId} activeTab={view.tab} onTabChange={handleTabChange} />;
      case "enfermeria":
        return <Enfermeria servicio={view.servicioCodigo} servicioId={view.servicioId} hospitalId={hospitalId} activeTab={view.tab} onTabChange={handleTabChange} />;
      case "tens":
        return <Tens servicio={view.servicioCodigo} servicioId={view.servicioId} hospitalId={hospitalId} activeTab={view.tab} onTabChange={handleTabChange} />;
      case "auxiliares":
        return <Auxiliares servicio={view.servicioCodigo} servicioId={view.servicioId} hospitalId={hospitalId} activeTab={view.tab} onTabChange={handleTabChange} />;
      default:
        return null;
    }
  };

  const hasSubmenu = !!view.servicioId;

  React.useEffect(() => {
    if (isMd) setMobileMenuOpen(false);
  }, [isMd]);

  React.useEffect(() => {
    if (!servicios.length || !view.servicioId) return;
    const svc = servicios.find((item) => item.id === view.servicioId);
    if (!svc || svc.codigo === view.servicioCodigo) return;
    setView((prev) => ({ ...prev, servicioCodigo: svc.codigo }));
  }, [servicios, view.servicioCodigo, view.servicioId]);

  React.useEffect(() => {
    if (!view.servicioId) return;
    if (skipNextHistoryPushRef.current) {
      skipNextHistoryPushRef.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("servicio", view.servicioId);
    params.set("estamento", view.estamento);
    params.set("tab", view.tab);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    if (nextUrl === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState(null, "", nextUrl);
  }, [view.estamento, view.servicioId, view.tab]);

  React.useEffect(() => {
    const onPopState = () => {
      const next = getUrlViewState();
      skipNextHistoryPushRef.current = true;
      setView((prev) => ({
        ...prev,
        servicioId: next.servicioId || prev.servicioId,
        servicioCodigo: prev.servicioCodigo,
        estamento: next.estamento,
        tab: next.tab,
      }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const shellValue = React.useMemo(
    () => ({
      sidebarWidth,
      isMd,
      mobileHeaderHeight: isMd ? 0 : MOBILE_APP_HEADER_PX,
      authUser: authUser ?? null,
      currentUser: currentUser ?? null,
    }),
    [sidebarWidth, isMd, authUser, currentUser],
  );

  return (
    <AppShellProvider value={shellValue}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <AnimatePresence>
          {mobileMenuOpen && !isMd && (
            <motion.button
              type="button"
              aria-label="Cerrar menú"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/25 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        <div
          className={`fixed left-0 top-0 z-40 h-full md:translate-x-0 ${
            isMd || mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-out`}
        >
          <Sidebar
            servicios={servicios}
            activeView={view}
            onNavigate={handleNavigate}
            isMd={isMd}
            onWidthChange={handleSidebarWidth}
            onRequestClose={() => setMobileMenuOpen(false)}
          />
        </div>

        <motion.main
          className={`flex min-h-0 flex-1 flex-col bg-white ${hasSubmenu ? "overflow-hidden" : ""}`}
          initial={false}
          animate={{ marginLeft: isMd ? sidebarWidth : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        >
          <header
            className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden"
            style={{ minHeight: MOBILE_APP_HEADER_PX }}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-neutral-950 px-3 text-sm font-medium text-white"
              aria-label="Abrir menú"
            >
              Menú
            </button>
            <span className="truncate text-sm font-medium text-neutral-800">{displayName}</span>
          </header>

          <div
            className={`flex flex-1 flex-col ${hasSubmenu ? "min-h-0 overflow-hidden pt-4 md:pt-6 pb-4 md:pb-6" : "min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-6"}`}
          >
            {profileError && (
              <div className={hasSubmenu ? "px-4 md:px-6" : ""}>
                <Card className="mb-4 border border-amber-200 bg-amber-50 shadow-sm md:mb-6">
                  <CardBody>
                    <h3 className="mb-1 font-semibold text-amber-900">Perfil incompleto</h3>
                    <p className="text-sm text-amber-800">
                      {profileError} Puedes entrar, pero conviene vincular este usuario en la tabla `usuarios`.
                    </p>
                  </CardBody>
                </Card>
              </div>
            )}
            <div className={hasSubmenu ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}>{renderContent()}</div>
          </div>
        </motion.main>
      </div>
    </AppShellProvider>
  );
}
