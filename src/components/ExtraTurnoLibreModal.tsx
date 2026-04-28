import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Select, SelectItem } from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function ExtraTurnoLibreModal({
  isOpen,
  funcionarioNombre,
  fecha,
  turnoBase,
  mode = "create",
  initialTurnoExtra = "D",
  loading = false,
  deleteLoading = false,
  onClose,
  onConfirm,
  onDelete,
}) {
  const [turnoExtra, setTurnoExtra] = React.useState("D");
  const selectClassNames = React.useMemo(() => ({ trigger: "border-0 bg-default-100 shadow-none" }), []);

  React.useEffect(() => {
    if (!isOpen) return;
    setTurnoExtra(initialTurnoExtra === "N" ? "N" : "D");
  }, [initialTurnoExtra, isOpen]);

  const fechaPretty = React.useMemo(() => {
    const [y, m, d] = String(fecha || "").slice(0, 10).split("-");
    return y && m && d ? `${d}/${m}/${y}` : "—";
  }, [fecha]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-70">
          <motion.button
            type="button"
            aria-label="Cerrar modal"
            className="absolute inset-0 bg-white/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={() => onClose?.()}
          />
          <motion.aside
            className="absolute right-0 top-0 flex h-screen w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
            initial={{ x: "100%", opacity: 0.96 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-5 sm:px-6">
              <div className="min-w-0 space-y-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-neutral-400">Turno libre</p>
                <h2 className="text-[1.25rem] font-semibold leading-tight text-neutral-900 sm:text-[1.4rem]">
                  Extra {funcionarioNombre || "—"}
                </h2>
              </div>
              <Button isIconOnly size="sm" variant="light" radius="full" className="shrink-0 text-neutral-500" onPress={() => onClose?.()}>
                <XMarkIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-9 sm:px-6 sm:py-10">
              <div className="max-w-md space-y-6">
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3">
                  <p className="text-sm text-neutral-700">Fecha: <strong>{fechaPretty}</strong></p>
                  <p className="mt-1 text-sm text-neutral-700">Turno base del día: <strong>{turnoBase || "—"}</strong></p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3">
                  <p className="mb-2 text-sm font-medium text-neutral-700">Turno extra a asignar</p>
                  <Select
                    selectedKeys={[turnoExtra]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      setTurnoExtra(value === "N" ? "N" : "D");
                    }}
                    variant="flat"
                    radius="sm"
                    classNames={selectClassNames}
                    aria-label="Turno extra"
                  >
                    <SelectItem key="D">Día (08:00-20:00)</SelectItem>
                    <SelectItem key="N">Noche (20:00-08:00)</SelectItem>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 px-5 py-4 sm:px-6">
              <div className="flex gap-3">
                {mode === "edit" ? (
                  <Button
                    color="danger"
                    variant="flat"
                    className="min-w-36"
                    isLoading={deleteLoading}
                    isDisabled={loading}
                    onPress={() => onDelete?.()}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  color="primary"
                  className="flex-1"
                  isLoading={loading}
                  onPress={() => onConfirm?.({ fecha, turnoExtra })}
                >
                  {mode === "edit" ? "Guardar cambios" : "Confirmar y guardar"}
                </Button>
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
