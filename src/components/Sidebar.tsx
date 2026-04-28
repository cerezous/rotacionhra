import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SFIcon } from "@bradleyhodges/sfsymbols-react";
import {
  sfFigureStrengthtrainingTraditional,
  sfStethoscope,
  sfSyringe,
  sfPerson2Fill,
  sfRectanglePortraitAndArrowRight,
} from "@bradleyhodges/sfsymbols";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "./sidebarConstants";

const ESTAMENTOS = [
  { id: "enfermeria", label: "Enfermería", icon: sfStethoscope },
  { id: "kinesiologia", label: "Kinesiología", icon: sfFigureStrengthtrainingTraditional },
  { id: "tens", label: "TENS", icon: sfSyringe },
  { id: "auxiliares", label: "Auxiliares", icon: sfPerson2Fill },
] as const;

const SERVICIO_LABEL_MAP: Record<string, string> = {
  uti: "UTI",
  uci: "UCI",
};

const getServicioLabel = (codigo: string): string => {
  const normalized = codigo.toLowerCase();
  if (SERVICIO_LABEL_MAP[normalized]) return SERVICIO_LABEL_MAP[normalized];
  // Toma la parte antes del primer guión bajo, ej: "uci_hra" → "UCI"
  return normalized.split("_")[0].toUpperCase();
};

const LEAVE_DELAY_MS = 140;

export type Servicio = { id: string; codigo: string; nombre: string };
export type ActiveView = { servicioId: string; estamento: string };

type SidebarProps = {
  servicios: Servicio[];
  activeView: ActiveView;
  onNavigate?: (servicioId: string, servicioCodigo: string, estamento: string) => void;
  isMd: boolean;
  onWidthChange: (widthPx: number) => void;
  onRequestClose?: () => void;
};

export function Sidebar({
  servicios,
  activeView,
  onNavigate,
  isMd,
  onWidthChange,
  onRequestClose,
}: SidebarProps) {
  const [hovered, setHovered] = React.useState(false);
  const [openServicioId, setOpenServicioId] = React.useState<string | null>(
    () => activeView?.servicioId ?? null,
  );
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const compact = isMd ? !hovered : false;

  React.useEffect(() => {
    onWidthChange(compact ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED);
  }, [compact, onWidthChange]);

  // Mantiene abierto el submenú del servicio activo
  React.useEffect(() => {
    if (activeView?.servicioId) setOpenServicioId(activeView.servicioId);
  }, [activeView?.servicioId]);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  React.useEffect(() => () => clearLeaveTimer(), []);
  React.useEffect(() => { if (isMd) setHovered(false); }, [isMd]);

  const handlePointerEnter = () => { clearLeaveTimer(); setHovered(true); };
  const handlePointerLeave = () => {
    if (!isMd) return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setHovered(false), LEAVE_DELAY_MS);
  };

  const handleServiceClick = (servicio: Servicio) => {
    if (compact) {
      // En modo compacto, navega directo al estamento activo (o enfermería por defecto)
      const estamento = activeView.servicioId === servicio.id ? activeView.estamento : "enfermeria";
      onNavigate?.(servicio.id, servicio.codigo, estamento);
      onRequestClose?.();
      return;
    }
    setOpenServicioId((prev) => (prev === servicio.id ? null : servicio.id));
  };

  const handleEstamentoClick = (servicio: Servicio, estamento: string) => {
    onNavigate?.(servicio.id, servicio.codigo, estamento);
    onRequestClose?.();
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: compact ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ type: "spring", stiffness: 460, damping: 40 }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-neutral-200 bg-white shadow-[1px_0_0_rgba(0,0,0,0.04)]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-4">
        <AnimatePresence mode="wait">
          {!compact ? (
            <motion.h2
              key="title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-neutral-900"
            >
              Rotaciones
            </motion.h2>
          ) : (
            <span className="sr-only">Rotaciones</span>
          )}
        </AnimatePresence>
        {compact && <span className="flex-1" aria-hidden />}
      </div>

      {/* Navegación */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2">
        {servicios.map((servicio) => {
          const isOpen = openServicioId === servicio.id;
          const isServiceActive = activeView.servicioId === servicio.id;
          const initials = getServicioLabel(servicio.codigo);

          return (
            <div key={servicio.id}>
              {/* Fila de servicio */}
              <button
                type="button"
                onClick={() => handleServiceClick(servicio)}
                title={compact ? servicio.nombre : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                  isServiceActive
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {/* Badge con código del servicio */}
                <span
                  className={`flex shrink-0 items-center justify-center rounded-md text-[9px] font-bold tracking-wide transition-all duration-200 ${
                    isServiceActive ? "bg-neutral-950 text-white" : "bg-neutral-200 text-neutral-700"
                  }`}
                  style={{ height: 22, width: compact ? 34 : isServiceActive ? 34 : 22 }}
                  aria-hidden
                >
                  {initials}
                </span>

                <AnimatePresence initial={false}>
                  {!compact && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.18 }}
                      className="min-w-0 flex-1 truncate text-[13px]"
                    >
                      {servicio.nombre}
                    </motion.span>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {!compact && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="shrink-0"
                    >
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Submenú de estamentos */}
              <AnimatePresence initial={false}>
                {isOpen && !compact && (
                  <motion.div
                    key="submenu"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="ml-[18px] flex flex-col gap-0.5 border-l border-neutral-200 py-0.5 pl-2.5">
                      {ESTAMENTOS.map(({ id, label, icon }) => {
                        const isActive = isServiceActive && activeView.estamento === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleEstamentoClick(servicio, id)}
                            className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12.5px] font-medium transition-colors duration-150 ${
                              isActive
                                ? "text-white"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                            }`}
                          >
                            {isActive && (
                              <motion.span
                                layoutId={`sidebar-estamento-pill-${servicio.id}`}
                                className="absolute inset-0 rounded-lg bg-neutral-950"
                                transition={{ type: "spring", stiffness: 440, damping: 34 }}
                              />
                            )}
                            <span className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5">
                              <SFIcon
                                icon={icon}
                                size={15}
                                className={`shrink-0 ${
                                  isActive
                                    ? "text-white"
                                    : "text-neutral-400 group-hover:text-neutral-600"
                                }`}
                                aria-hidden
                              />
                              <span className="truncate">{label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {servicios.length === 0 && !compact && (
          <p className="px-3 py-2 text-[11px] text-neutral-400">Sin servicios asignados</p>
        )}
      </nav>

      {/* Cerrar sesión */}
      <div className="border-t border-neutral-200 p-2">
        <button
          type="button"
          onClick={() => {
            onNavigate?.("__logout__", "", "");
            onRequestClose?.();
          }}
          title={compact ? "Cerrar sesión" : undefined}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-500 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <SFIcon
            icon={sfRectanglePortraitAndArrowRight}
            size={compact ? 22 : 20}
            className="shrink-0 text-neutral-500 group-hover:text-neutral-900"
            aria-hidden
          />
          <AnimatePresence initial={false}>
            {!compact && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="truncate"
              >
                Cerrar sesión
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

export { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from "./sidebarConstants";

