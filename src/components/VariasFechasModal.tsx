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

const MOTIVO_OPTIONS = [
  { value: "feriado_legal", label: "Feriado legal" },
  { value: "licencia_medica", label: "Licencia médica" },
  { value: "dias_compensatorios", label: "Descanso compensatorio" },
  { value: "prenatal", label: "Prenatal" },
  { value: "postnatal", label: "Post natal" },
];

const TIPO_COBERTURA_OPTIONS = [
  { value: "una_suplencia", label: "1 suplencia" },
  { value: "multiples_suplencias", label: "2 o más suplencias" },
  { value: "solo_extras", label: "Solo extras" },
  { value: "suplencia_y_extras", label: "Suplencia y extras" },
];

let suplenciaSegmentSeed = 0;

const createSuplenciaSegment = (start = "", end = "", suplenciaId = "") => ({
  id: `segment-${suplenciaSegmentSeed += 1}`,
  start,
  end,
  suplenciaId,
});

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

const addDaysToIso = (fecha, days) => {
  const [year, month, day] = String(fecha || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
};

const clampIsoDate = (fecha, min, max) => {
  const value = String(fecha || "").slice(0, 10);
  const minValue = String(min || "").slice(0, 10);
  const maxValue = String(max || "").slice(0, 10);
  if (!value) return minValue || maxValue || "";
  if (minValue && value < minValue) return minValue;
  if (maxValue && value > maxValue) return maxValue;
  return value;
};

const rebalanceSuplenciaSegments = (segments, rangeStart, rangeEnd) => {
  if (!rangeStart || !rangeEnd) return [];

  const nextSegments = [];
  let nextStart = rangeStart;

  for (const segment of segments || []) {
    if (!nextStart || nextStart > rangeEnd) break;
    const clampedEnd = clampIsoDate(segment?.end || nextStart, nextStart, rangeEnd);
    nextSegments.push({
      id: segment?.id || createSuplenciaSegment().id,
      start: nextStart,
      end: clampedEnd,
      suplenciaId: segment?.suplenciaId || "",
    });
    nextStart = addDaysToIso(clampedEnd, 1);
  }

  return nextSegments.length > 0 ? nextSegments : [createSuplenciaSegment(rangeStart, rangeEnd, "")];
};

const buildTurnosPorFecha = (fechas) => {
  const turnos = {};

  for (const item of fechas || []) {
    if (!item?.fecha) continue;
    turnos[item.fecha] = item.turno || "";
  }

  return turnos;
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

const rangesOverlap = (startA, endA, startB, endB) => {
  const rangeA = getSortedRange(startA, endA);
  const rangeB = getSortedRange(startB, endB);
  return Boolean(
    rangeA.start
      && rangeA.end
      && rangeB.start
      && rangeB.end
      && rangeA.start <= rangeB.end
      && rangeA.end >= rangeB.start
  );
};

const getNombreCompleto = (persona) => [persona?.nombre, persona?.apellidos].filter(Boolean).join(" ") || "—";
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isRangoHoraValido = (inicio, fin) =>
  Boolean(TIME_RE.test(String(inicio || "")) && TIME_RE.test(String(fin || "")) && String(inicio) < String(fin));
const createExtraAssignment = (seed: any = {}) => ({
  cubridorId: String(seed?.cubridorId || ""),
  cobertura: seed?.cobertura === "parcial" ? "parcial" : "completo",
  horaInicio: String(seed?.horaInicio || ""),
  horaFin: String(seed?.horaFin || ""),
  cubreResto: seed?.cubreResto === "si" ? "si" : "no",
  segundoCubridorId: String(seed?.segundoCubridorId || ""),
  segundoHoraInicio: String(seed?.segundoHoraInicio || ""),
  segundoHoraFin: String(seed?.segundoHoraFin || ""),
});
const normalizeExtraAssignment = (value: any) => {
  if (!value) return createExtraAssignment();
  if (typeof value === "string") return createExtraAssignment({ cubridorId: value });
  return createExtraAssignment(value);
};

export default function VariasFechasModal({
  isOpen,
  mode = "create",
  source = null,
  funcionarioNombre,
  solicitanteId,
  fechas = [],
  turnosDisponibles = [],
  personal = [],
  asumes = [],
  loading = false,
  deleteLoading = false,
  initialMotivo = "feriado_legal",
  initialTipoCobertura = "una_suplencia",
  initialSuplenciaId = "",
  initialSuplenciaRangeEnd = "",
  initialSuplenciaSegments = [],
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
  const [motivo, setMotivo] = React.useState(initialMotivo || "feriado_legal");
  const [tipoCobertura, setTipoCobertura] = React.useState(initialTipoCobertura || "una_suplencia");
  const [suplenciaId, setSuplenciaId] = React.useState(initialSuplenciaId || "");
  const [suplenciaRangeEnd, setSuplenciaRangeEnd] = React.useState(initialSuplenciaRangeEnd || primeraFecha || "");
  const [suplenciaSegments, setSuplenciaSegments] = React.useState(() => []);
  const [extraAssignments, setExtraAssignments] = React.useState(initialExtraAssignments || {});
  const [observaciones, setObservaciones] = React.useState(initialObservaciones || "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setSelectedRange(getSortedRange(primeraFecha, ultimaFecha));
    const nextMotivo = initialMotivo || "feriado_legal";
    setMotivo(nextMotivo);
    const tipoInicial = initialTipoCobertura || "una_suplencia";
    setTipoCobertura(tipoInicial);
    setSuplenciaId(initialSuplenciaId || "");
    setSuplenciaRangeEnd(initialSuplenciaRangeEnd || primeraFecha || "");
    setSuplenciaSegments(
      tipoInicial === "multiples_suplencias" && initialSuplenciaSegments.length > 0
        ? rebalanceSuplenciaSegments(initialSuplenciaSegments, primeraFecha, ultimaFecha)
        : (primeraFecha && ultimaFecha ? [createSuplenciaSegment(primeraFecha, ultimaFecha, "")] : []),
    );
    setExtraAssignments(initialExtraAssignments || {});
    setObservaciones(initialObservaciones || "");
    setConfirmDeleteOpen(false);
  }, [initialExtraAssignments, initialMotivo, initialObservaciones, initialSuplenciaId, initialSuplenciaRangeEnd, initialSuplenciaSegments, initialTipoCobertura, isOpen, primeraFecha, ultimaFecha]);

  const rangeLabel = selectedRange.start && selectedRange.end
    ? `${formatFechaDisplay(selectedRange.start)} al ${formatFechaDisplay(selectedRange.end)}`
    : "";

  const rangeValue = React.useMemo(() => {
    if (!selectedRange.start || !selectedRange.end) return null;
    return {
      start: toCalendarDate(selectedRange.start),
      end: toCalendarDate(selectedRange.end),
    };
  }, [selectedRange.end, selectedRange.start]);

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

  const fechasSeleccionadas = React.useMemo(() => {
    return getFechasDentroDeRango(turnosDisponibles, selectedRange.start, selectedRange.end);
  }, [selectedRange.end, selectedRange.start, turnosDisponibles]);

  const suplenciaOptions = React.useMemo(() => {
    if (!selectedRange.start || !selectedRange.end) return [];

    return (personal || [])
      .filter((persona) => persona?.id && String(persona.id) !== String(solicitanteId))
      .filter((persona) => persona?.activo !== false)
      .filter((persona) => String(persona?.calidad_juridica || "").toLowerCase() === "suplencia")
      .filter((persona) => !(asumes || []).some((asume) => {
        if (String(persona.id) === String(initialSuplenciaId)) return false;
        if (String(asume?.suplencia_id) !== String(persona.id)) return false;
        return rangesOverlap(selectedRange.start, selectedRange.end, asume?.fecha_inicio, asume?.fecha_fin);
      }))
      .map((persona) => ({
        id: persona.id,
        label: getNombreCompleto(persona),
      }));
  }, [asumes, personal, selectedRange.end, selectedRange.start, solicitanteId]);

  React.useEffect(() => {
    if (!suplenciaId) return;
    const sigueDisponible = suplenciaOptions.some((option) => String(option.id) === String(suplenciaId));
    if (!sigueDisponible) setSuplenciaId("");
  }, [suplenciaId, suplenciaOptions]);

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

  const handleExtraAssignmentChange = React.useCallback((fecha, nextPatch) => {
    setExtraAssignments((prev) => ({
      ...prev,
      [fecha]: createExtraAssignment({ ...normalizeExtraAssignment(prev[fecha]), ...nextPatch }),
    }));
  }, []);

  const isUnaSuplencia = tipoCobertura === "una_suplencia";
  const isMultiplesSuplencias = tipoCobertura === "multiples_suplencias";
  const isSoloExtras = tipoCobertura === "solo_extras";
  const isSuplenciaYExtras = tipoCobertura === "suplencia_y_extras";
  const isDeleteAvailable = mode === "edit" && (source === "solo_extras" || source === "una_suplencia" || source === "multiples_suplencias" || source === "suplencia_y_extras");

  const maxSuplenciaYExtrasEnd = React.useMemo(() => {
    if (!selectedRange.start || !selectedRange.end) return "";
    if (selectedRange.start === selectedRange.end) return "";
    return addDaysToIso(selectedRange.end, -1);
  }, [selectedRange.end, selectedRange.start]);

  React.useEffect(() => {
    if (!isOpen || !isSuplenciaYExtras || !selectedRange.start) return;
    const fallbackEnd = initialSuplenciaRangeEnd || selectedRange.start;
    const maxEnd = maxSuplenciaYExtrasEnd || selectedRange.start;
    setSuplenciaRangeEnd((prev) => clampIsoDate(prev || fallbackEnd, selectedRange.start, maxEnd));
  }, [initialSuplenciaRangeEnd, isOpen, isSuplenciaYExtras, maxSuplenciaYExtrasEnd, selectedRange.start]);

  const suplenciaYExtrasOptions = React.useMemo(() => {
    if (!selectedRange.start || !suplenciaRangeEnd) return [];

    return (personal || [])
      .filter((persona) => persona?.id && String(persona.id) !== String(solicitanteId))
      .filter((persona) => persona?.activo !== false)
      .filter((persona) => String(persona?.calidad_juridica || "").toLowerCase() === "suplencia")
      .filter((persona) => !(asumes || []).some((asume) => {
        if (String(persona.id) === String(initialSuplenciaId)) return false;
        if (String(asume?.suplencia_id) !== String(persona.id)) return false;
        return rangesOverlap(selectedRange.start, suplenciaRangeEnd, asume?.fecha_inicio, asume?.fecha_fin);
      }))
      .map((persona) => ({
        id: persona.id,
        label: getNombreCompleto(persona),
      }));
  }, [asumes, initialSuplenciaId, personal, selectedRange.start, solicitanteId, suplenciaRangeEnd]);

  React.useEffect(() => {
    if (!isSuplenciaYExtras || !suplenciaId) return;
    const sigueDisponible = suplenciaYExtrasOptions.some((option) => String(option.id) === String(suplenciaId));
    if (!sigueDisponible) setSuplenciaId("");
  }, [isSuplenciaYExtras, suplenciaId, suplenciaYExtrasOptions]);

  const fechasExtrasSuplenciaYExtras = React.useMemo(() => {
    if (!isSuplenciaYExtras || !selectedRange.start || !selectedRange.end || !suplenciaRangeEnd) return [];
    const extraStart = addDaysToIso(suplenciaRangeEnd, 1);
    if (!extraStart || extraStart > selectedRange.end) return [];
    return getFechasDentroDeRango(turnosDisponibles, extraStart, selectedRange.end);
  }, [isSuplenciaYExtras, selectedRange.end, selectedRange.start, suplenciaRangeEnd, turnosDisponibles]);

  React.useEffect(() => {
    if (!isSuplenciaYExtras) return;
    setExtraAssignments((prev) => {
      const next = {};
      for (const item of fechasExtrasSuplenciaYExtras) {
        const key = String(item?.fecha || "").slice(0, 10);
        if (key && prev[key]) next[key] = prev[key];
      }
      return next;
    });
  }, [fechasExtrasSuplenciaYExtras, isSuplenciaYExtras]);

  const suplenciaYExtrasRangeValue = React.useMemo(() => {
    if (!selectedRange.start || !suplenciaRangeEnd) return null;
    return {
      start: toCalendarDate(selectedRange.start),
      end: toCalendarDate(suplenciaRangeEnd),
    };
  }, [selectedRange.start, suplenciaRangeEnd]);

  const handleSuplenciaYExtrasRangeChange = React.useCallback((nextValue) => {
    if (!nextValue?.end || !selectedRange.start) return;
    const maxEnd = maxSuplenciaYExtrasEnd || selectedRange.start;
    setSuplenciaRangeEnd(clampIsoDate(toIsoDate(nextValue.end), selectedRange.start, maxEnd));
  }, [maxSuplenciaYExtrasEnd, selectedRange.start]);

  React.useEffect(() => {
    if (!isOpen || !selectedRange.start || !selectedRange.end || !isMultiplesSuplencias) return;

    setSuplenciaSegments((prev) => {
      if (prev.length === 0) return [createSuplenciaSegment(selectedRange.start, selectedRange.end, "")];
      return rebalanceSuplenciaSegments(prev, selectedRange.start, selectedRange.end);
    });
  }, [isMultiplesSuplencias, isOpen, selectedRange.end, selectedRange.start]);

  const getSuplenciaOptionsForSegment = React.useCallback((segmentId, start, end, currentSuplenciaId = "") => {
    if (!start || !end) return [];

    return (personal || [])
      .filter((persona) => persona?.id && String(persona.id) !== String(solicitanteId))
      .filter((persona) => persona?.activo !== false)
      .filter((persona) => String(persona?.calidad_juridica || "").toLowerCase() === "suplencia")
      .filter((persona) => {
        const alreadyUsed = suplenciaSegments.some(
          (segment) => segment.id !== segmentId && String(segment?.suplenciaId || "") === String(persona.id),
        );
        return !alreadyUsed || String(persona.id) === String(currentSuplenciaId);
      })
      .filter((persona) => !(asumes || []).some((asume) => {
        if (String(persona.id) === String(currentSuplenciaId)) return false;
        if (String(asume?.suplencia_id) !== String(persona.id)) return false;
        return rangesOverlap(start, end, asume?.fecha_inicio, asume?.fecha_fin);
      }))
      .map((persona) => ({
        id: persona.id,
        label: getNombreCompleto(persona),
      }));
  }, [asumes, personal, solicitanteId, suplenciaSegments]);

  const hasMultipleCoverageComplete = React.useMemo(() => {
    if (!isMultiplesSuplencias || !selectedRange.start || !selectedRange.end || suplenciaSegments.length === 0) return false;

    let expectedStart = selectedRange.start;
    for (const segment of suplenciaSegments) {
      if (!segment?.suplenciaId || !segment?.start || !segment?.end) return false;
      if (String(segment.start) !== String(expectedStart)) return false;
      if (String(segment.end) < String(segment.start)) return false;
      expectedStart = addDaysToIso(segment.end, 1);
    }

    return String(addDaysToIso(suplenciaSegments[suplenciaSegments.length - 1]?.end, 1) || "") === String(addDaysToIso(selectedRange.end, 1) || "");
  }, [isMultiplesSuplencias, selectedRange.end, selectedRange.start, suplenciaSegments]);

  const uncoveredStart = React.useMemo(() => {
    if (!isMultiplesSuplencias || suplenciaSegments.length === 0) return selectedRange.start;
    const lastSegment = suplenciaSegments[suplenciaSegments.length - 1];
    if (!lastSegment?.end) return selectedRange.start;
    const nextStart = addDaysToIso(lastSegment.end, 1);
    return nextStart && nextStart <= selectedRange.end ? nextStart : "";
  }, [isMultiplesSuplencias, selectedRange.end, selectedRange.start, suplenciaSegments]);

  const handleMultipleSegmentSuplenciaChange = React.useCallback((segmentId, nextSuplenciaId) => {
    setSuplenciaSegments((prev) => prev.map((segment) => (
      segment.id === segmentId
        ? { ...segment, suplenciaId: nextSuplenciaId }
        : segment
    )));
  }, []);

  const handleMultipleSegmentRangeChange = React.useCallback((segmentId, nextValue) => {
    if (!nextValue?.end || !selectedRange.end || !selectedRange.start) return;

    setSuplenciaSegments((prev) => {
      const updated = prev.map((segment) => (
        segment.id === segmentId
          ? { ...segment, end: clampIsoDate(toIsoDate(nextValue.end), segment.start, selectedRange.end) }
          : segment
      ));
      return rebalanceSuplenciaSegments(updated, selectedRange.start, selectedRange.end);
    });
  }, [selectedRange.end, selectedRange.start]);

  const handleAddMultipleSegment = React.useCallback(() => {
    if (!uncoveredStart || !selectedRange.end) return;
    setSuplenciaSegments((prev) => [
      ...prev,
      createSuplenciaSegment(uncoveredStart, selectedRange.end, ""),
    ]);
  }, [selectedRange.end, uncoveredStart]);

  const handleRemoveLastMultipleSegment = React.useCallback(() => {
    setSuplenciaSegments((prev) => {
      if (prev.length <= 1) {
        return selectedRange.start && selectedRange.end
          ? [createSuplenciaSegment(selectedRange.start, selectedRange.end, "")]
          : [];
      }
      return prev.slice(0, -1);
    });
  }, [selectedRange.end, selectedRange.start]);

  const isExtraAssignmentComplete = React.useCallback((raw) => {
    const a = normalizeExtraAssignment(raw);
    if (!a.cubridorId) return false;
    if (a.cobertura !== "parcial") return true;
    if (!isRangoHoraValido(a.horaInicio, a.horaFin)) return false;
    if (a.cubreResto !== "si") return true;
    return Boolean(
      a.segundoCubridorId
      && isRangoHoraValido(a.segundoHoraInicio, a.segundoHoraFin),
    );
  }, []);

  const hasSoloExtrasComplete = React.useMemo(() => (
    fechasSeleccionadas.length > 0
    && fechasSeleccionadas.every((item) => isExtraAssignmentComplete(extraAssignments[String(item?.fecha || "").slice(0, 10)]))
  ), [extraAssignments, fechasSeleccionadas, isExtraAssignmentComplete]);

  const hasSuplenciaYExtrasComplete = React.useMemo(() => (
    Boolean(
      selectedRange.start
      && selectedRange.end
      && suplenciaId
      && suplenciaRangeEnd
      && fechasExtrasSuplenciaYExtras.length > 0
      && fechasExtrasSuplenciaYExtras.every((item) => isExtraAssignmentComplete(extraAssignments[String(item?.fecha || "").slice(0, 10)]))
    )
  ), [extraAssignments, fechasExtrasSuplenciaYExtras, isExtraAssignmentComplete, selectedRange.end, selectedRange.start, suplenciaId, suplenciaRangeEnd]);

  const isGuardarEnabled = Boolean(
    (isUnaSuplencia && selectedRange.start && selectedRange.end && suplenciaId)
    || (isMultiplesSuplencias && hasMultipleCoverageComplete)
    || (isSuplenciaYExtras && hasSuplenciaYExtrasComplete)
    || (isSoloExtras && hasSoloExtrasComplete)
  );

  const extrasPayload = React.useMemo(() => {
    if (isSoloExtras) {
      return fechasSeleccionadas.map((item) => ({
        fecha: item.fecha,
        turno: item.turno,
        assignment: normalizeExtraAssignment(extraAssignments[String(item.fecha || "").slice(0, 10)]),
      }));
    }

    if (isSuplenciaYExtras) {
      return fechasExtrasSuplenciaYExtras.map((item) => ({
        fecha: item.fecha,
        turno: item.turno,
        assignment: normalizeExtraAssignment(extraAssignments[String(item.fecha || "").slice(0, 10)]),
      }));
    }

    return [];
  }, [extraAssignments, fechasExtrasSuplenciaYExtras, fechasSeleccionadas, isSoloExtras, isSuplenciaYExtras]);

  const handleConfirm = React.useCallback(async () => {
    if (!isGuardarEnabled || loading) return;
    await onConfirm?.({
      fechaInicio: selectedRange.start,
      fechaFin: selectedRange.end,
      motivo,
      tipoCobertura,
      suplenciaId,
      suplenciaRangeEnd: isSuplenciaYExtras ? suplenciaRangeEnd : "",
      suplenciaSegments: isMultiplesSuplencias
        ? suplenciaSegments.map((segment) => ({
            suplenciaId: segment.suplenciaId,
            fechaInicio: segment.start,
            fechaFin: segment.end,
          }))
        : [],
      extras: extrasPayload,
      observaciones: observaciones.trim() || null,
    });
  }, [extrasPayload, isGuardarEnabled, isMultiplesSuplencias, loading, motivo, observaciones, onConfirm, selectedRange.end, selectedRange.start, suplenciaId, suplenciaRangeEnd, suplenciaSegments, tipoCobertura]);

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
                  {mode === "edit" ? "Edición múltiple" : "Solicitud múltiple"}
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

                  <p className="text-sm text-neutral-500">{rangeLabel || "Selecciona fecha de inicio y fecha de fin"}</p>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Motivo
                    </label>
                    <select
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                    >
                      {MOTIVO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-neutral-700">Cobertura</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {TIPO_COBERTURA_OPTIONS.map((option) => {
                        const isSelected = tipoCobertura === option.value;

                        return (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                              isSelected
                                ? "border-[#007AFF]/45 bg-[#007AFF]/6"
                                : "border-neutral-200 bg-white hover:border-neutral-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="tipo-cobertura"
                              value={option.value}
                              checked={isSelected}
                              onChange={(event) => setTipoCobertura(event.target.value)}
                              className="h-4 w-4 border-neutral-300 text-[#007AFF] focus:ring-[#007AFF]/30"
                            />
                            <span className="text-sm font-medium text-neutral-800">
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {isUnaSuplencia ? (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-700">
                          Elegir suplencia
                        </label>
                        <select
                          value={suplenciaId}
                          onChange={(event) => setSuplenciaId(event.target.value)}
                          className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                        >
                          <option value="">Selecciona una suplencia</option>
                          {suplenciaOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-neutral-500">
                          Solo se muestran suplencias disponibles, sin otros asumes en este rango.
                        </p>
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
                    </>
                  ) : isMultiplesSuplencias ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-neutral-700">Tramos de suplencias</p>
                          {suplenciaSegments.length > 1 ? (
                            <button
                              type="button"
                              onClick={handleRemoveLastMultipleSegment}
                              className="text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
                            >
                              Quitar último tramo
                            </button>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          {suplenciaSegments.map((segment, index) => {
                            const segmentOptions = getSuplenciaOptionsForSegment(segment.id, segment.start, segment.end, segment.suplenciaId);
                            const segmentValue = segment.start && segment.end
                              ? {
                                  start: toCalendarDate(segment.start),
                                  end: toCalendarDate(segment.end),
                                }
                              : null;

                            return (
                              <div key={segment.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-neutral-900">Suplencia {index + 1}</p>
                                    <p className="text-xs text-neutral-500">
                                      Desde {formatFechaDisplay(segment.start)} hasta {formatFechaDisplay(segment.end)}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                                    Tramo {index + 1}
                                  </span>
                                </div>

                                <div className="space-y-3">
                                  <div className="space-y-2">
                                    <label className="block text-sm font-medium text-neutral-700">
                                      Elegir suplencia
                                    </label>
                                    <select
                                      value={segment.suplenciaId}
                                      onChange={(event) => handleMultipleSegmentSuplenciaChange(segment.id, event.target.value)}
                                      className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                                    >
                                      <option value="">Selecciona una suplencia</option>
                                      {segmentOptions.map((option) => (
                                        <option key={`${segment.id}-${option.id}`} value={option.id}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="block text-sm font-medium text-neutral-700">
                                      Fechas que cubre esta suplencia
                                    </label>
                                    <DateRangePicker
                                      labelPlacement="outside"
                                      value={segmentValue}
                                      onChange={(nextValue) => handleMultipleSegmentRangeChange(segment.id, nextValue)}
                                      visibleMonths={2}
                                      radius="sm"
                                      classNames={rangePickerClassNames}
                                      minValue={toCalendarDate(segment.start)}
                                      maxValue={toCalendarDate(selectedRange.end)}
                                    />
                                    <p className="text-xs text-neutral-500">
                                      El inicio de este tramo queda fijado al primer día pendiente del asume. Solo puedes ajustar hasta dónde cubre.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {uncoveredStart ? (
                          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3">
                            <p className="text-sm text-neutral-600">
                              Falta cubrir desde {formatFechaDisplay(uncoveredStart)} hasta {formatFechaDisplay(selectedRange.end)}.
                            </p>
                            <Button
                              variant="flat"
                              className="mt-3"
                              isDisabled={!suplenciaSegments[suplenciaSegments.length - 1]?.suplenciaId}
                              onPress={handleAddMultipleSegment}
                            >
                              Agregar otra suplencia
                            </Button>
                          </div>
                        ) : hasMultipleCoverageComplete ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Todo el rango quedó cubierto por las suplencias seleccionadas.
                          </div>
                        ) : null}
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
                    </>
                  ) : isSuplenciaYExtras ? (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-700">
                          Elegir suplencia
                        </label>
                        <select
                          value={suplenciaId}
                          onChange={(event) => setSuplenciaId(event.target.value)}
                          className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                        >
                          <option value="">Selecciona una suplencia</option>
                          {suplenciaYExtrasOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-700">
                          Fechas que cubrirá la suplencia
                        </label>
                        <DateRangePicker
                          labelPlacement="outside"
                          value={suplenciaYExtrasRangeValue}
                          onChange={handleSuplenciaYExtrasRangeChange}
                          visibleMonths={2}
                          radius="sm"
                          classNames={rangePickerClassNames}
                          minValue={toCalendarDate(selectedRange.start)}
                          maxValue={toCalendarDate(maxSuplenciaYExtrasEnd || selectedRange.start)}
                          isDisabled={!maxSuplenciaYExtrasEnd}
                        />
                        <p className="text-xs text-neutral-500">
                          La suplencia cubre desde el inicio del asume hasta la fecha final que selecciones. El resto se cubrirá con extras.
                        </p>
                      </div>

                      {fechasExtrasSuplenciaYExtras.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-neutral-700">Asignación de extras para el resto del asume</p>
                          <div className="space-y-3">
                            {fechasExtrasSuplenciaYExtras.map((item) => {
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
                                    value={normalizeExtraAssignment(extraAssignments[fechaKey]).cubridorId}
                                    onChange={(event) => handleExtraAssignmentChange(fechaKey, { cubridorId: event.target.value })}
                                    className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                                  >
                                    <option value="">Selecciona quién cubre este extra</option>
                                    {extraOptions.map((option) => (
                                      <option key={`${fechaKey}-${option.id}`} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="mt-3 grid grid-cols-2 gap-3">
                                    <label className="text-xs text-neutral-600">
                                      Tipo cobertura
                                      <select
                                        value={normalizeExtraAssignment(extraAssignments[fechaKey]).cobertura}
                                        onChange={(event) => handleExtraAssignmentChange(fechaKey, { cobertura: event.target.value })}
                                        className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-default-100 px-2 text-sm text-neutral-800"
                                      >
                                        <option value="completo">Completa</option>
                                        <option value="parcial">Parcial</option>
                                      </select>
                                    </label>
                                  </div>
                                  {normalizeExtraAssignment(extraAssignments[fechaKey]).cobertura === "parcial" ? (
                                    <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <label className="text-xs text-neutral-600">
                                          Desde
                                          <input
                                            type="time"
                                            value={normalizeExtraAssignment(extraAssignments[fechaKey]).horaInicio}
                                            onChange={(event) => handleExtraAssignmentChange(fechaKey, { horaInicio: event.target.value })}
                                            className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                          />
                                        </label>
                                        <label className="text-xs text-neutral-600">
                                          Hasta
                                          <input
                                            type="time"
                                            value={normalizeExtraAssignment(extraAssignments[fechaKey]).horaFin}
                                            onChange={(event) => handleExtraAssignmentChange(fechaKey, { horaFin: event.target.value })}
                                            className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                          />
                                        </label>
                                      </div>
                                      <label className="text-xs text-neutral-600">
                                        ¿Se cubre el resto?
                                        <select
                                          value={normalizeExtraAssignment(extraAssignments[fechaKey]).cubreResto}
                                          onChange={(event) => handleExtraAssignmentChange(fechaKey, { cubreResto: event.target.value })}
                                          className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                        >
                                          <option value="no">No</option>
                                          <option value="si">Sí</option>
                                        </select>
                                      </label>
                                      {normalizeExtraAssignment(extraAssignments[fechaKey]).cubreResto === "si" ? (
                                        <div className="space-y-3">
                                          <select
                                            value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoCubridorId}
                                            onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoCubridorId: event.target.value })}
                                            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                          >
                                            <option value="">Selecciona segundo cubridor</option>
                                            {extraOptions.map((option) => (
                                              <option key={`${fechaKey}-resto-${option.id}`} value={option.id}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                          <div className="grid grid-cols-2 gap-3">
                                            <input
                                              type="time"
                                              value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoHoraInicio}
                                              onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoHoraInicio: event.target.value })}
                                              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                            />
                                            <input
                                              type="time"
                                              value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoHoraFin}
                                              onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoHoraFin: event.target.value })}
                                              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
                          Debe quedar al menos un día fuera del tramo de suplencia para asignarlo como extra.
                        </div>
                      )}

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
                    </>
                  ) : isSoloExtras ? (
                    <>
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
                                  value={normalizeExtraAssignment(extraAssignments[fechaKey]).cubridorId}
                                  onChange={(event) => handleExtraAssignmentChange(fechaKey, { cubridorId: event.target.value })}
                                  className="h-11 w-full rounded-xl border border-neutral-200 bg-default-100 px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
                                >
                                  <option value="">Selecciona quién cubre este extra</option>
                                  {extraOptions.map((option) => (
                                    <option key={`${fechaKey}-${option.id}`} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <label className="text-xs text-neutral-600">
                                    Tipo cobertura
                                    <select
                                      value={normalizeExtraAssignment(extraAssignments[fechaKey]).cobertura}
                                      onChange={(event) => handleExtraAssignmentChange(fechaKey, { cobertura: event.target.value })}
                                      className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-default-100 px-2 text-sm text-neutral-800"
                                    >
                                      <option value="completo">Completa</option>
                                      <option value="parcial">Parcial</option>
                                    </select>
                                  </label>
                                </div>
                                {normalizeExtraAssignment(extraAssignments[fechaKey]).cobertura === "parcial" ? (
                                  <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="text-xs text-neutral-600">
                                        Desde
                                        <input
                                          type="time"
                                          value={normalizeExtraAssignment(extraAssignments[fechaKey]).horaInicio}
                                          onChange={(event) => handleExtraAssignmentChange(fechaKey, { horaInicio: event.target.value })}
                                          className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                        />
                                      </label>
                                      <label className="text-xs text-neutral-600">
                                        Hasta
                                        <input
                                          type="time"
                                          value={normalizeExtraAssignment(extraAssignments[fechaKey]).horaFin}
                                          onChange={(event) => handleExtraAssignmentChange(fechaKey, { horaFin: event.target.value })}
                                          className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                        />
                                      </label>
                                    </div>
                                    <label className="text-xs text-neutral-600">
                                      ¿Se cubre el resto?
                                      <select
                                        value={normalizeExtraAssignment(extraAssignments[fechaKey]).cubreResto}
                                        onChange={(event) => handleExtraAssignmentChange(fechaKey, { cubreResto: event.target.value })}
                                        className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                      >
                                        <option value="no">No</option>
                                        <option value="si">Sí</option>
                                      </select>
                                    </label>
                                    {normalizeExtraAssignment(extraAssignments[fechaKey]).cubreResto === "si" ? (
                                      <div className="space-y-3">
                                        <select
                                          value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoCubridorId}
                                          onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoCubridorId: event.target.value })}
                                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                        >
                                          <option value="">Selecciona segundo cubridor</option>
                                          {extraOptions.map((option) => (
                                            <option key={`${fechaKey}-resto-${option.id}`} value={option.id}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="grid grid-cols-2 gap-3">
                                          <input
                                            type="time"
                                            value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoHoraInicio}
                                            onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoHoraInicio: event.target.value })}
                                            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                          />
                                          <input
                                            type="time"
                                            value={normalizeExtraAssignment(extraAssignments[fechaKey]).segundoHoraFin}
                                            onChange={(event) => handleExtraAssignmentChange(fechaKey, { segundoHoraFin: event.target.value })}
                                            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                                          />
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
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
                    </>
                  ) : (
                    <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
                      Esta opción la implementamos después. Por ahora solo queda habilitado el flujo de 1 suplencia.
                    </p>
                  )}
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