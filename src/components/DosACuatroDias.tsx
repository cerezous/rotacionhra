import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, DateRangePicker } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { esFuncionarioDiurno } from "../lib/utils";

const rangePickerClassNames = {
  inputWrapper: "border-0 bg-default-100 shadow-none",
  popoverContent: "rounded-2xl border border-neutral-200 shadow-[0_16px_38px_rgba(15,23,42,0.14)]",
  selectorButton: "text-neutral-400",
};

const MOTIVO_OPTIONS_CUARTO_TURNO = [
  { value: "permiso_capacitacion", label: "Permiso capacitación" },
  { value: "permiso_fallecimiento", label: "Permiso fallecimiento" },
  { value: "licencia_medica", label: "Licencia médica" },
  { value: "feriado_legal", label: "Feriado legal" },
];

const MOTIVO_OPTIONS_DIURNO = [
  { value: "permiso_capacitacion", label: "Permiso capacitación" },
  { value: "permiso_fallecimiento", label: "Permiso fallecimiento" },
  { value: "licencia_medica", label: "Licencia médica" },
];

const formatFechaDisplay = (fecha) => {
  const [year, month, day] = String(fecha || "").slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}-${month}-${year}`;
};

const toCalendarDate = (fecha) => {
  const normalized = String(fecha || "").slice(0, 10);
  return normalized ? parseDate(normalized) : null;
};

const toIsoDate = (value) => {
  if (!value) return "";
  const year = String(value.year).padStart(4, "0");
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getSortedRange = (start, end) => {
  const from = String(start || "").slice(0, 10);
  const to = String(end || start || "").slice(0, 10);
  if (!from && !to) return { start: "", end: "" };
  if (!from) return { start: to, end: to };
  if (!to) return { start: from, end: from };
  return from <= to ? { start: from, end: to } : { start: to, end: from };
};

const getFechasDentroDeRango = (fechas, start, end) => {
  const range = getSortedRange(start, end);
  return (fechas || []).filter((item) => {
    const fecha = String(item?.fecha || "").slice(0, 10);
    return Boolean(fecha && range.start && range.end && fecha >= range.start && fecha <= range.end);
  });
};

const getNombreCompleto = (persona) => [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") || "—";

export default function DosACuatroDias({
  isOpen,
  mode = "create",
  funcionarioNombre,
  solicitanteId,
  /** Si es true, no se ofrece feriado legal (rango corto va por flujo diurno / otras reglas). */
  funcionarioDiurno = false,
  fechas = [],
  turnosDisponibles = [],
  personal = [],
  loading = false,
  deleteLoading = false,
  initialMotivo = "permiso_capacitacion",
  initialExtraAssignments = {},
  initialObservaciones = "",
  onConfirm,
  onDelete,
  onSelectSingleDate,
  onClose,
}) {
  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const primeraFecha = fechas[0]?.fecha || "";
  const ultimaFecha = fechas[fechas.length - 1]?.fecha || primeraFecha;
  const [selectedRange, setSelectedRange] = React.useState(() => getSortedRange(primeraFecha, ultimaFecha));
  const motivoOptions = funcionarioDiurno ? MOTIVO_OPTIONS_DIURNO : MOTIVO_OPTIONS_CUARTO_TURNO;

  const [motivo, setMotivo] = React.useState(initialMotivo || "permiso_capacitacion");
  const [extraAssignments, setExtraAssignments] = React.useState(initialExtraAssignments || {});
  const [observaciones, setObservaciones] = React.useState(initialObservaciones || "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedRange(getSortedRange(primeraFecha, ultimaFecha));
    const raw = initialMotivo || "permiso_capacitacion";
    const allowedValues = new Set((funcionarioDiurno ? MOTIVO_OPTIONS_DIURNO : MOTIVO_OPTIONS_CUARTO_TURNO).map((o) => o.value));
    setMotivo(allowedValues.has(raw) ? raw : "permiso_capacitacion");
    setExtraAssignments(initialExtraAssignments || {});
    setObservaciones(initialObservaciones || "");
    setConfirmDeleteOpen(false);
  }, [funcionarioDiurno, initialExtraAssignments, initialMotivo, initialObservaciones, isOpen, primeraFecha, ultimaFecha]);

  const rangeValue = React.useMemo(() => {
    if (!selectedRange.start || !selectedRange.end) return null;
    return {
      start: toCalendarDate(selectedRange.start),
      end: toCalendarDate(selectedRange.end),
    };
  }, [selectedRange.end, selectedRange.start]);

  const fechasSeleccionadas = React.useMemo(() => {
    return getFechasDentroDeRango(turnosDisponibles, selectedRange.start, selectedRange.end);
  }, [selectedRange.end, selectedRange.start, turnosDisponibles]);

  const syncRange = React.useCallback((nextRange) => {
    setSelectedRange(nextRange);

    const nextFechasSeleccionadas = getFechasDentroDeRango(turnosDisponibles, nextRange.start, nextRange.end);
    if (nextFechasSeleccionadas.length === 1) {
      onSelectSingleDate?.(nextFechasSeleccionadas[0].fecha);
    }
  }, [onSelectSingleDate, turnosDisponibles]);

  const handleRangeChange = React.useCallback((nextValue) => {
    if (!nextValue?.start || !nextValue?.end) return;
    syncRange({
      start: toIsoDate(nextValue.start),
      end: toIsoDate(nextValue.end),
    });
  }, [syncRange]);

  React.useEffect(() => {
    setExtraAssignments((prev) => {
      const next = {};
      for (const item of fechasSeleccionadas) {
        const key = String(item?.fecha || "").slice(0, 10);
        if (key && prev[key]) next[key] = prev[key];
      }
      return next;
    });
  }, [fechasSeleccionadas]);

  const extraOptions = React.useMemo(() => {
    return (personal || [])
      .filter((persona) => persona?.id && String(persona.id) !== String(solicitanteId))
      .filter((persona) => persona?.activo !== false)
      .filter((persona) => !esFuncionarioDiurno(persona))
      .map((persona) => ({
        id: persona.id,
        label: getNombreCompleto(persona),
      }));
  }, [personal, solicitanteId]);

  const handleExtraAssignmentChange = React.useCallback((fecha, cubridorId) => {
    setExtraAssignments((prev) => ({
      ...prev,
      [fecha]: cubridorId,
    }));
  }, []);

  const cantidadTurnos = fechasSeleccionadas.length;
  const isRangeValid = cantidadTurnos >= 2 && cantidadTurnos <= 3;
  const isDeleteAvailable = mode === "edit";
  const isGuardarEnabled = isRangeValid && fechasSeleccionadas.every((item) => Boolean(extraAssignments[String(item?.fecha || "").slice(0, 10)]));

  const extrasPayload = React.useMemo(() => {
    return fechasSeleccionadas.map((item) => ({
      fecha: item.fecha,
      turno: item.turno,
      cubridorId: extraAssignments[String(item.fecha || "").slice(0, 10)] || "",
    }));
  }, [extraAssignments, fechasSeleccionadas]);

  const handleConfirm = React.useCallback(async () => {
    if (!isGuardarEnabled || loading) return;
    await onConfirm?.({
      fechaInicio: selectedRange.start,
      fechaFin: selectedRange.end,
      motivo,
      tipoCobertura: "solo_extras",
      extras: extrasPayload,
      observaciones: observaciones.trim() || null,
    });
  }, [extrasPayload, isGuardarEnabled, loading, motivo, observaciones, onConfirm, selectedRange.end, selectedRange.start]);

  const handleDelete = React.useCallback(async () => {
    if (!isDeleteAvailable || loading || deleteLoading) return;
    setConfirmDeleteOpen(false);
    await onDelete?.();
  }, [deleteLoading, isDeleteAvailable, loading, onDelete]);

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
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  {mode === "edit" ? "Edición 2 a 3 turnos" : "Solicitud 2 a 3 turnos"}
                </p>
                <h2 className="text-[1.25rem] font-semibold leading-tight text-neutral-900 sm:text-[1.4rem]">
                  {mode === "edit" ? `Editar ${funcionarioNombre || "—"}` : `Solicita ${funcionarioNombre || "—"}`}
                </h2>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                className="shrink-0 text-neutral-500"
                onPress={() => onClose?.()}
              >
                <XMarkIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-9 sm:px-6 sm:py-10">
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-700">Rango de fechas</p>
                  </div>

                  <DateRangePicker
                    labelPlacement="outside"
                    value={rangeValue}
                    onChange={handleRangeChange}
                    visibleMonths={2}
                    radius="sm"
                    classNames={rangePickerClassNames}
                  />

                  <p className="text-sm text-neutral-500">
                    {selectedRange.start && selectedRange.end
                      ? `${formatFechaDisplay(selectedRange.start)} al ${formatFechaDisplay(selectedRange.end)}`
                      : "Selecciona fecha de inicio y fecha de fin"}
                  </p>

                  {!isRangeValid ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Este modal solo permite rangos con 2 o 3 turnos D/N seleccionados. Con 4 o más turnos se usa el otro flujo (suplencias y cobertura completa).
                    </div>
                  ) : null}

                  {!funcionarioDiurno && motivo === "feriado_legal" ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                      Feriado legal de 4.º turno: la cobertura es solo con <strong>turnos extra</strong> (no suplencias).
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Motivo
                    </label>
                    <select
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                    >
                      {motivoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-neutral-700">Asignación de extras</p>
                    <div className="space-y-3">
                      {fechasSeleccionadas.map((item) => {
                        const fechaKey = String(item?.fecha || "").slice(0, 10);
                        return (
                          <div key={fechaKey} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-neutral-900">{formatFechaDisplay(item.fecha)}</p>
                              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                                {item.turno || "—"}
                              </span>
                            </div>
                            <select
                              value={extraAssignments[fechaKey] || ""}
                              onChange={(event) => handleExtraAssignmentChange(fechaKey, event.target.value)}
                              className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                            >
                              <option value="">Selecciona quién cubre este extra</option>
                              {extraOptions.map((option) => (
                                <option key={`${fechaKey}-${option.id}`} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Observaciones
                    </label>
                    <textarea
                      value={observaciones}
                      onChange={(event) => setObservaciones(event.target.value)}
                      rows={4}
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-neutral-200 bg-default-100 px-3 py-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 px-5 py-4 sm:px-6">
              <div className="flex gap-3">
                {isDeleteAvailable ? (
                  <Button
                    color="danger"
                    variant="flat"
                    className="min-w-36"
                    isLoading={deleteLoading}
                    isDisabled={loading}
                    onPress={() => setConfirmDeleteOpen(true)}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  color="success"
                  className="w-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  isDisabled={!isGuardarEnabled || loading || deleteLoading}
                  isLoading={loading}
                  onPress={handleConfirm}
                >
                  {mode === "edit" ? "Guardar cambios" : "Confirmar y guardar"}
                </Button>
              </div>
            </div>
          </motion.aside>

          <AnimatePresence>
            {confirmDeleteOpen ? (
              <motion.div
                className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-950/38 px-5 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <motion.div
                  className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="space-y-2">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-red-500">
                      Confirmar eliminación
                    </p>
                    <h3 className="text-lg font-semibold text-neutral-900">
                      ¿Eliminar este grupo?
                    </h3>
                    <p className="text-sm leading-6 text-neutral-500">
                      Esta acción quitará toda la cobertura asociada al rango seleccionado y no se puede deshacer.
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="flat"
                      className="flex-1"
                      isDisabled={deleteLoading}
                      onPress={() => setConfirmDeleteOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      color="danger"
                      className="flex-1"
                      isLoading={deleteLoading}
                      isDisabled={loading}
                      onPress={handleDelete}
                    >
                      Sí, eliminar
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </AnimatePresence>
  );
}