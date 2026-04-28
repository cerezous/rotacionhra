import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/outline";
import CalendarioTurnosPicker from "./CalendarioTurnosPicker";
import { esFuncionarioDiurno } from "../lib/utils";
import { JORNADA_DIURNO_FIN, JORNADA_DIURNO_HORAS_UTILES, JORNADA_DIURNO_INICIO } from "../lib/jornadaDiurno";
import { JORNADA_CUARTO_TURNO_HORAS } from "../lib/jornadaCuartoTurno";
const inputClassNames = {
  inputWrapper: "border-0 bg-default-100 shadow-none",
};

const selectClassNames = {
  trigger: "border-0 bg-default-100 shadow-none",
};

const MOTIVO_OPTIONS = [
  { key: "cambio", label: "Cambio" },
  { key: "inversion", label: "Inversión" },
  { key: "permiso_administrativo", label: "Permiso administrativo" },
];

const MOTIVOS_FUNCIONARIO_DIURNO = [
  { key: "feriado_legal", label: "Feriado legal" },
  { key: "licencia_medica", label: "Licencia médica" },
  { key: "dias_compensatorios", label: "Descanso compensatorio" },
  { key: "prenatal", label: "Prenatal" },
  { key: "postnatal", label: "Post natal" },
  { key: "permiso_capacitacion", label: "Permiso capacitación" },
  { key: "permiso_administrativo", label: "Permiso administrativo" },
];

const stripMarcadorDiurno = (text) =>
  String(text || "")
    .replace(/\s*·\s*Diurno:\s*jornada completa/gi, "")
    .replace(/\s*·\s*Diurno:\s*[\d.]+\s*h/gi, "")
    .replace(/^Diurno:\s*jornada completa\s*·?\s*/gi, "")
    .replace(/^Diurno:\s*[\d.]+\s*h\s*·?\s*/gi, "")
    .replace(/\s*·\s*Turno12h:\s*jornada completa/gi, "")
    .replace(/\s*·\s*Turno12h:\s*[\d.]+\s*h/gi, "")
    .replace(/\s*·\s*Turno12h:\s*[0-2]\d:[0-5]\d\s*-\s*[0-2]\d:[0-5]\d/gi, "")
    .replace(/^Turno12h:\s*jornada completa\s*·?\s*/gi, "")
    .replace(/^Turno12h:\s*[\d.]+\s*h\s*·?\s*/gi, "")
    .replace(/^Turno12h:\s*[0-2]\d:[0-5]\d\s*-\s*[0-2]\d:[0-5]\d\s*·?\s*/gi, "")
    .trim();

const MOTIVOS_NO_DISPONIBLES = new Set(["feriado_legal", "licencia_medica"]);

const OFFSET_POR_TURNO = { A: 0, B: 2, C: 3, D: 1 };
const CICLO = ["D", "N", "S", "L"];

const fechaEnRango = (fecha, inicio, fin) => {
  const target = String(fecha || "").slice(0, 10);
  const desde = String(inicio || "").slice(0, 10);
  const hasta = String(fin || inicio || "").slice(0, 10);
  return Boolean(target && desde && hasta && target >= desde && target <= hasta);
};

const formatFechaDisplay = (fecha) => {
  const [year, month, day] = String(fecha || "").slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}-${month}-${year}`;
};

const getTurnoDelDia = (fecha, turnoBase) => {
  const raw = String(turnoBase || "").toUpperCase();
  const turno = raw.match(/[ABCD]/)?.[0] ?? raw.slice(0, 1);
  const offset = OFFSET_POR_TURNO[turno];
  if (offset === undefined) return null;

  const [year, month, day] = String(fecha).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const currentDate = new Date(year, month - 1, day);
  const aprilFirst = new Date(year, 3, 1);
  const diffDays = Math.floor((currentDate.getTime() - aprilFirst.getTime()) / (24 * 60 * 60 * 1000));
  const cycleIndex = ((diffDays + offset) % 4 + 4) % 4;
  return CICLO[cycleIndex] || null;
};

const getTurnoEfectivoDelDia = (personaId, fecha, personal, asumes) => {
  const persona = (personal || []).find((item) => String(item?.id) === String(personaId));
  if (!persona) return null;

  const calidad = String(persona?.calidad_juridica || "").toLowerCase();
  if (calidad === "suplencia") {
    const asume = (asumes || []).find(
      (item) => String(item?.suplencia_id) === String(personaId) && fechaEnRango(fecha, item?.fecha_inicio, item?.fecha_fin),
    );
    if (!asume) return null;
    const titular = (personal || []).find((item) => String(item?.id) === String(asume?.titular_id));
    const titularCalidad = String(titular?.calidad_juridica || "").toLowerCase();
    if (titularCalidad !== "titular" && titularCalidad !== "contrata") return null;
    return getTurnoDelDia(fecha, titular?.turno);
  }

  return getTurnoDelDia(fecha, persona?.turno);
};

const getTurnoContrario = (turno) => {
  const normalized = String(turno || "").toUpperCase();
  if (normalized === "D") return "N";
  if (normalized === "N") return "D";
  return null;
};
const normalizeTurnoDNLS = (turno) => {
  const normalized = String(turno || "").toUpperCase();
  return normalized === "D" || normalized === "N" || normalized === "S" || normalized === "L"
    ? normalized
    : null;
};

const getHorarioTurnoCompleto = (turno) => {
  const normalized = String(turno || "").toUpperCase();
  if (normalized === "D") return { inicio: "08:00", fin: "20:00" };
  if (normalized === "N") return { inicio: "20:00", fin: "08:00" };
  return null;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isRangoHoraValido = (inicio, fin) =>
  Boolean(TIME_RE.test(String(inicio || "")) && TIME_RE.test(String(fin || "")) && String(inicio) < String(fin));
const toMinutes = (hhmm) => {
  if (!TIME_RE.test(String(hhmm || ""))) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const shiftOffsetFromTime = (turno, hhmm) => {
  const minutes = toMinutes(hhmm);
  if (minutes == null) return null;
  if (turno === "N") return minutes >= 20 * 60 ? minutes - 20 * 60 : minutes + 4 * 60;
  if (turno === "D") return minutes >= 8 * 60 ? minutes - 8 * 60 : minutes + 16 * 60;
  return null;
};
const offsetToShiftTime = (turno, offset) => {
  const norm = Math.max(0, Math.min(12 * 60, Number(offset) || 0));
  let absolute = 0;
  if (turno === "N") absolute = norm < 4 * 60 ? 20 * 60 + norm : norm - 4 * 60;
  else absolute = 8 * 60 + norm;
  absolute = ((absolute % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(absolute / 60);
  const mm = absolute % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const getMissingRangesForShift = (turno, coverages) => {
  if (turno !== "D" && turno !== "N") return [];
  const segments = (coverages || [])
    .map((seg) => ({
      start: shiftOffsetFromTime(turno, seg.horaInicio),
      end: shiftOffsetFromTime(turno, seg.horaFin),
    }))
    .filter((seg) => seg.start != null && seg.end != null && seg.end > seg.start && seg.start >= 0 && seg.end <= 12 * 60)
    .sort((a, b) => a.start - b.start);
  if (segments.length === 0) return [{ start: 0, end: 12 * 60 }];
  const merged = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (!last || seg.start > last.end) merged.push({ ...seg });
    else if (seg.end > last.end) last.end = seg.end;
  }
  const missing = [];
  let cursor = 0;
  for (const seg of merged) {
    if (seg.start > cursor) missing.push({ start: cursor, end: seg.start });
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < 12 * 60) missing.push({ start: cursor, end: 12 * 60 });
  return missing;
};
const isRangoDentroTurno = (turno, inicio, fin) => {
  const start = shiftOffsetFromTime(turno, inicio);
  const end = shiftOffsetFromTime(turno, fin);
  return start != null && end != null && end > start && start >= 0 && end <= 12 * 60;
};
const isRangoHoraValidoEnTurno = (turno, inicio, fin) => {
  if (turno === "D" || turno === "N") return isRangoDentroTurno(turno, inicio, fin);
  return isRangoHoraValido(inicio, fin);
};

const buildMonthTurnos = (baseFecha, cubridorId, personal, asumes) => {
  if (!baseFecha || !cubridorId) return {};
  const [year, month] = String(baseFecha).slice(0, 10).split("-").map(Number);
  if (!year || !month) return {};

  const daysInMonth = new Date(year, month, 0).getDate();
  const turnos = {};

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    turnos[dateKey] = getTurnoEfectivoDelDia(cubridorId, dateKey, personal, asumes) || "";
  }

  return turnos;
};

export default function UnaFechaModal({
  isOpen,
  funcionarioNombre,
  cubridorNombre = "",
  defaultFecha,
  solicitanteId,
  personal = [],
  asumes = [],
  loading = false,
  deleteLoading = false,
  allowPermisoAdministrativo = true,
  /** Edición de PA 4.º turno guardado solo como fila en `salidas` (sin radios de cobertura). */
  paSoloSalidaCuartoTurno = false,
  funcionarioDiurno = false,
  defaultFechaFin = "",
  mode = "create",
  clickedRole = "solicitante",
  initialMotivo = "cambio",
  initialCubridorId = "",
  initialFechaDevuelve = "",
  initialCoberturasExtras = [],
  turnoSolicitadoInicial = "",
  initialObservaciones = "",
  onConfirm,
  onDelete,
  onClose,
}) {
  const [fecha, setFecha] = React.useState(defaultFecha || "");
  const [fechaFin, setFechaFin] = React.useState(defaultFechaFin || "");
  const [motivo, setMotivo] = React.useState("cambio");
  const [cubridorId, setCubridorId] = React.useState("");
  const [fechaDevuelve, setFechaDevuelve] = React.useState("");
  const [observaciones, setObservaciones] = React.useState("");
  const [alcanceDiurno, setAlcanceDiurno] = React.useState("completo");
  const [horasParcial, setHorasParcial] = React.useState("");
  const [horaInicioParcialTurno, setHoraInicioParcialTurno] = React.useState("");
  const [horaFinParcialTurno, setHoraFinParcialTurno] = React.useState("");
  /** 4.º turno + PA: si el permiso se cubre con extra o queda solo como ausencia. */
  const [cubreConExtra, setCubreConExtra] = React.useState("");
  const [horaInicioExtra, setHoraInicioExtra] = React.useState("");
  const [horaFinExtra, setHoraFinExtra] = React.useState("");
  const [turnoExtraLibre, setTurnoExtraLibre] = React.useState("D");
  const [syncCoberturaParcialConPermiso, setSyncCoberturaParcialConPermiso] = React.useState(true);
  const [coberturasAdicionales, setCoberturasAdicionales] = React.useState([]);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFecha(defaultFecha || "");
      setFechaFin(defaultFechaFin || defaultFecha || "");
      const turnoInicialLibre = normalizeTurnoDNLS(turnoSolicitadoInicial) === "S" || normalizeTurnoDNLS(turnoSolicitadoInicial) === "L";
      setMotivo(
        funcionarioDiurno
          ? initialMotivo || "feriado_legal"
          : turnoInicialLibre
            ? "permiso_administrativo"
            : initialMotivo || "cambio",
      );
      setCubridorId(initialCubridorId || "");
      setFechaDevuelve(initialFechaDevuelve || "");
      const coberturasIniciales = Array.isArray(initialCoberturasExtras) ? initialCoberturasExtras : [];
      const primera = coberturasIniciales[0] || {};
      setHoraInicioExtra(String(primera.horaInicio || ""));
      setHoraFinExtra(String(primera.horaFin || ""));
      setTurnoExtraLibre("D");
      setSyncCoberturaParcialConPermiso(true);
      setCoberturasAdicionales(
        coberturasIniciales.slice(1).map((item) => ({
          cubridorId: String(item?.cubridorId || ""),
          horaInicio: String(item?.horaInicio || ""),
          horaFin: String(item?.horaFin || ""),
        })),
      );
      if (funcionarioDiurno) {
        setHoraInicioParcialTurno("");
        setHoraFinParcialTurno("");
        const obsLimpia = stripMarcadorDiurno(initialObservaciones);
        setObservaciones(obsLimpia);
        const obsRaw = String(initialObservaciones || "");
        if (/Diurno:\s*[\d.]+\s*h/i.test(obsRaw)) {
          const m = obsRaw.match(/Diurno:\s*([\d.]+)\s*h/i);
          setAlcanceDiurno("parcial");
          setHorasParcial(m ? String(m[1]) : "");
        } else {
          setAlcanceDiurno("completo");
          setHorasParcial("");
        }
      } else {
        const esPa = initialMotivo === "permiso_administrativo";
        setObservaciones(esPa ? stripMarcadorDiurno(initialObservaciones) : initialObservaciones || "");
        if (esPa) {
          const obsRaw = String(initialObservaciones || "");
          const mParcialRango = obsRaw.match(/Turno12h:\s*([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)/i);
          const mParcialHoras = obsRaw.match(/Turno12h:\s*([\d.]+)\s*h/i) || obsRaw.match(/Diurno:\s*([\d.]+)\s*h/i);
          if (mParcialRango || mParcialHoras) {
            setAlcanceDiurno("parcial");
            setHorasParcial(mParcialHoras ? String(mParcialHoras[1] || "") : "");
            setHoraInicioParcialTurno(mParcialRango ? String(mParcialRango[1] || "") : "");
            setHoraFinParcialTurno(mParcialRango ? String(mParcialRango[2] || "") : "");
          } else {
            setAlcanceDiurno("completo");
            setHorasParcial("");
            setHoraInicioParcialTurno("");
            setHoraFinParcialTurno("");
          }
        } else {
          setAlcanceDiurno("completo");
          setHorasParcial("");
          setHoraInicioParcialTurno("");
          setHoraFinParcialTurno("");
        }
        setCubreConExtra(esPa ? (initialCubridorId ? "si" : mode === "edit" ? "no" : "") : "");
      }
      setCalendarOpen(false);
      setConfirmDeleteOpen(false);
    }
  }, [defaultFecha, defaultFechaFin, funcionarioDiurno, initialCoberturasExtras, initialCubridorId, initialFechaDevuelve, initialMotivo, initialObservaciones, isOpen, mode, turnoSolicitadoInicial]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno) return;
    if (motivo !== "permiso_administrativo") setCubreConExtra("");
  }, [isOpen, funcionarioDiurno, motivo]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno) return;
    if (motivo === "permiso_administrativo" && cubreConExtra === "no") setCubridorId("");
  }, [cubreConExtra, funcionarioDiurno, isOpen, motivo]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno || motivo !== "permiso_administrativo") return;
    if (alcanceDiurno === "completo" && cubreConExtra === "parcial") setCubreConExtra("si");
  }, [alcanceDiurno, cubreConExtra, funcionarioDiurno, isOpen, motivo]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno || motivo !== "permiso_administrativo") return;
    if (alcanceDiurno === "parcial" && cubreConExtra === "si") setCubreConExtra("parcial");
  }, [alcanceDiurno, cubreConExtra, funcionarioDiurno, isOpen, motivo]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno || motivo !== "permiso_administrativo") return;
    const turnoActual =
      normalizeTurnoDNLS(getTurnoEfectivoDelDia(solicitanteId, fecha, personal, asumes))
      || normalizeTurnoDNLS(turnoSolicitadoInicial);
    const esTurnoLibre = turnoActual === "S" || turnoActual === "L";
    if (!esTurnoLibre) return;
    setCubreConExtra("si");
    setCubridorId(String(solicitanteId || ""));
    setFechaDevuelve(fecha || "");
  }, [asumes, fecha, funcionarioDiurno, isOpen, motivo, personal, solicitanteId, turnoSolicitadoInicial]);

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno) return;
    const turnoActual =
      normalizeTurnoDNLS(getTurnoEfectivoDelDia(solicitanteId, fecha, personal, asumes))
      || normalizeTurnoDNLS(turnoSolicitadoInicial);
    const esExtraAutonomo = motivo === "permiso_administrativo" && (turnoActual === "S" || turnoActual === "L");
    if (!esExtraAutonomo) return;
    if (motivo !== "permiso_administrativo") setMotivo("permiso_administrativo");
  }, [asumes, fecha, funcionarioDiurno, isOpen, motivo, personal, solicitanteId, turnoSolicitadoInicial]);

  React.useEffect(() => {
    if (!isOpen || !paSoloSalidaCuartoTurno) return;
    setCubreConExtra("no");
  }, [isOpen, paSoloSalidaCuartoTurno]);

  React.useEffect(() => {
    setFechaDevuelve(motivo === "inversion" || motivo === "permiso_administrativo" ? (fecha || "") : "");
    setCalendarOpen(false);
  }, [cubridorId, fecha, motivo]);

  React.useEffect(() => {
    if (motivo === "inversion" || motivo === "permiso_administrativo") {
      setFechaDevuelve(fecha || "");
      setCalendarOpen(false);
    }
  }, [fecha, motivo]);

  React.useEffect(() => {
    if (allowPermisoAdministrativo) return;
    if (motivo === "permiso_administrativo") setMotivo("cambio");
  }, [allowPermisoAdministrativo, motivo]);

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

  const turnoSolicitante = React.useMemo(() => {
    return getTurnoEfectivoDelDia(solicitanteId, fecha, personal, asumes);
  }, [asumes, fecha, personal, solicitanteId]);
  const turnoSolicitanteNormalizado =
    normalizeTurnoDNLS(turnoSolicitante) || normalizeTurnoDNLS(turnoSolicitadoInicial);

  const turnoContrarioSolicitante = React.useMemo(() => {
    return getTurnoContrario(turnoSolicitante);
  }, [turnoSolicitante]);

  const isPermisoAdministrativo = motivo === "permiso_administrativo";

  const esPaCapDiurno =
    funcionarioDiurno && (motivo === "permiso_administrativo" || motivo === "permiso_capacitacion");

  const esTurnoLibreSeleccionado = turnoSolicitanteNormalizado === "S" || turnoSolicitanteNormalizado === "L";
  const esPaAdministrativoCuartoTurno = !funcionarioDiurno && isPermisoAdministrativo;
  const esExtraAutonomoTurnoLibre = !funcionarioDiurno && esTurnoLibreSeleccionado;
  const cubreConExtraActivo = cubreConExtra === "si" || cubreConExtra === "parcial";
  const turnoReferenciaExtra = esExtraAutonomoTurnoLibre ? turnoExtraLibre : turnoSolicitanteNormalizado;

  const muestraAlcancePa = esPaCapDiurno || esPaAdministrativoCuartoTurno || esExtraAutonomoTurnoLibre;

  const maxHorasPaParcial = esPaAdministrativoCuartoTurno ? JORNADA_CUARTO_TURNO_HORAS : JORNADA_DIURNO_HORAS_UTILES;
  const coberturasExtras = React.useMemo(() => {
    const first = [{ cubridorId, horaInicio: horaInicioExtra, horaFin: horaFinExtra }];
    return [...first, ...(coberturasAdicionales || [])].filter(
      (item) => item && (item.cubridorId || item.horaInicio || item.horaFin),
    );
  }, [coberturasAdicionales, cubridorId, horaFinExtra, horaInicioExtra]);
  const missingRangesTurnoCompleto = React.useMemo(
    () => getMissingRangesForShift(turnoReferenciaExtra, coberturasExtras),
    [coberturasExtras, turnoReferenciaExtra],
  );

  React.useEffect(() => {
    if (!isOpen || funcionarioDiurno) return;
    if (!isPermisoAdministrativo || cubreConExtra !== "si" || alcanceDiurno !== "completo") return;
    const horario = getHorarioTurnoCompleto(turnoReferenciaExtra);
    if (!horario) return;
    setHoraInicioExtra((prev) => prev || horario.inicio);
    setHoraFinExtra((prev) => prev || horario.fin);
  }, [alcanceDiurno, cubreConExtra, funcionarioDiurno, isOpen, isPermisoAdministrativo, turnoReferenciaExtra]);

  React.useEffect(() => {
    if (!isOpen || !isPermisoAdministrativo) return;
    if (alcanceDiurno !== "parcial" || cubreConExtra !== "parcial") return;
    if (!syncCoberturaParcialConPermiso) return;
    setHoraInicioExtra(horaInicioParcialTurno || "");
    setHoraFinExtra(horaFinParcialTurno || "");
  }, [
    alcanceDiurno,
    cubreConExtra,
    horaFinParcialTurno,
    horaInicioParcialTurno,
    isOpen,
    isPermisoAdministrativo,
    syncCoberturaParcialConPermiso,
  ]);

  const cubridorOptions = React.useMemo(() => {
    if (!fecha) return [];

    return (personal || [])
      .filter((persona) => persona?.id && String(persona.id) !== String(solicitanteId))
      .filter((persona) => persona?.activo !== false)
      .filter((persona) => {
        if (!isPermisoAdministrativo) return true;
        return !esFuncionarioDiurno(persona);
      })
      .filter((persona) => {
        const ausencia = (asumes || []).find(
          (asume) =>
            String(asume?.titular_id) === String(persona.id) &&
            fechaEnRango(fecha, asume?.fecha_inicio, asume?.fecha_fin) &&
            MOTIVOS_NO_DISPONIBLES.has(String(asume?.motivo || "").toLowerCase()),
        );
        if (ausencia) return false;

        const calidad = String(persona?.calidad_juridica || "").toLowerCase();
        if (calidad !== "suplencia") return true;

        return (asumes || []).some((asume) => {
          if (String(asume?.suplencia_id) !== String(persona.id)) return false;
          if (!fechaEnRango(fecha, asume?.fecha_inicio, asume?.fecha_fin)) return false;
          const titular = (personal || []).find((item) => String(item?.id) === String(asume?.titular_id));
          const titularCalidad = String(titular?.calidad_juridica || "").toLowerCase();
          return titularCalidad === "titular" || titularCalidad === "contrata";
        });
      })
      .filter((persona) => {
        if (motivo !== "inversion") return true;
        if (!turnoContrarioSolicitante) return false;
        return getTurnoEfectivoDelDia(persona.id, fecha, personal, asumes) === turnoContrarioSolicitante;
      })
      .map((persona) => {
        const nombre = [persona.nombre, persona.apellidos].filter(Boolean).join(" ") || "—";
        const turnoDia = getTurnoEfectivoDelDia(persona.id, fecha, personal, asumes);
        return {
          id: persona.id,
          label: motivo === "inversion" && turnoDia ? `${nombre} · ${turnoDia}` : nombre,
        };
      });
  }, [asumes, fecha, isPermisoAdministrativo, motivo, personal, solicitanteId, turnoContrarioSolicitante]);

  React.useEffect(() => {
    if (!cubridorId) return;
    const sigueDisponible = cubridorOptions.some((option) => String(option.id) === String(cubridorId));
    if (!sigueDisponible) setCubridorId("");
  }, [cubridorId, cubridorOptions]);

  const turnosCubridor = React.useMemo(() => {
    return buildMonthTurnos(fecha, cubridorId, personal, asumes);
  }, [asumes, cubridorId, fecha, personal]);

  const fechaDevuelveEfectiva = motivo === "inversion" || motivo === "permiso_administrativo" ? fecha : fechaDevuelve;

  const motivoOptions = React.useMemo(() => {
    if (funcionarioDiurno) return MOTIVOS_FUNCIONARIO_DIURNO;
    if (esExtraAutonomoTurnoLibre) return MOTIVO_OPTIONS.filter((option) => option.key === "permiso_administrativo");
    return allowPermisoAdministrativo
      ? MOTIVO_OPTIONS
      : MOTIVO_OPTIONS.filter((option) => option.key !== "permiso_administrativo");
  }, [allowPermisoAdministrativo, esExtraAutonomoTurnoLibre, funcionarioDiurno]);

  const headerEyebrow = mode === "edit"
    ? clickedRole === "cubridor"
      ? "Edición desde quien cubre"
      : "Edición desde quien solicita"
    : "Nueva solicitud";

  const headerTitle = funcionarioDiurno
    ? mode === "edit"
      ? `Ausencia diurna · ${funcionarioNombre || "—"}`
      : `Ausencia diurna · ${funcionarioNombre || "—"}`
    : mode === "edit"
      ? clickedRole === "cubridor"
        ? `Cubre ${cubridorNombre || "—"}`
        : `Solicita ${funcionarioNombre || "—"}`
      : `Solicitud ${funcionarioNombre || "—"}`;

  const isFormComplete = React.useMemo(() => {
    if (funcionarioDiurno) {
      const fi = String(fecha || "").slice(0, 10);
      const ff = String(fechaFin || fecha || "").slice(0, 10);
      const rangoOk = Boolean(fi && ff && ff >= fi);
      if (!rangoOk || !motivo) return false;
      if (!esPaCapDiurno) return true;
      if (alcanceDiurno === "completo") return true;
      const h = Number(horasParcial);
      return alcanceDiurno === "parcial" && Number.isFinite(h) && h > 0 && h <= JORNADA_DIURNO_HORAS_UTILES;
    }
    if (!fecha || !motivo) return false;
    if (motivo === "permiso_administrativo") {
      const turnoBaseExtra = esExtraAutonomoTurnoLibre ? turnoExtraLibre : turnoSolicitanteNormalizado;
      const hOk =
        alcanceDiurno === "completo"
        || (alcanceDiurno === "parcial"
          && isRangoDentroTurno(turnoBaseExtra, horaInicioParcialTurno, horaFinParcialTurno));
      if (!hOk) return false;
      if (paSoloSalidaCuartoTurno) return true;
      if (cubreConExtra !== "si" && cubreConExtra !== "no" && cubreConExtra !== "parcial") return false;
      if (cubreConExtra === "no") return true;
      if (alcanceDiurno === "parcial" && !isRangoHoraValidoEnTurno(turnoBaseExtra, horaInicioExtra, horaFinExtra)) return false;
      if (alcanceDiurno === "completo") {
        const valid = coberturasExtras.every((item) => Boolean(item.cubridorId) && isRangoHoraValidoEnTurno(turnoBaseExtra, item.horaInicio, item.horaFin));
        if (!valid) return false;
        if (!esExtraAutonomoTurnoLibre && missingRangesTurnoCompleto.length > 0) return false;
      }
      return esExtraAutonomoTurnoLibre ? Boolean(turnoExtraLibre) : Boolean(cubridorId && fechaDevuelveEfectiva);
    }
    return Boolean(cubridorId && fechaDevuelveEfectiva);
  }, [
    alcanceDiurno,
    cubreConExtra,
    cubreConExtraActivo,
    cubridorId,
    esPaCapDiurno,
    fecha,
    fechaDevuelveEfectiva,
    fechaFin,
    funcionarioDiurno,
    horasParcial,
    horaFinExtra,
    horaInicioExtra,
    horaFinParcialTurno,
    horaInicioParcialTurno,
    maxHorasPaParcial,
    motivo,
    esExtraAutonomoTurnoLibre,
    coberturasExtras,
    missingRangesTurnoCompleto.length,
    paSoloSalidaCuartoTurno,
    turnoExtraLibre,
    turnoSolicitanteNormalizado,
  ]);

  const handleConfirm = async () => {
    if (!isFormComplete || loading) return;
    const includeHorasExtra =
      isPermisoAdministrativo
      && cubreConExtraActivo
      && Boolean(horaInicioExtra && horaFinExtra);
    await onConfirm?.({
      fecha,
      fechaFin: funcionarioDiurno ? String(fechaFin || fecha || "").slice(0, 10) : undefined,
      motivo,
      cubridorId:
        esExtraAutonomoTurnoLibre
          ? String(solicitanteId || "")
          : funcionarioDiurno || (isPermisoAdministrativo && (paSoloSalidaCuartoTurno || !cubreConExtraActivo)) ? "" : cubridorId,
      fechaDevuelve: fechaDevuelveEfectiva,
      observaciones: observaciones.trim() || null,
      alcanceDiurno: muestraAlcancePa ? alcanceDiurno : undefined,
      horasParcial: muestraAlcancePa && alcanceDiurno === "parcial" ? horasParcial : undefined,
      horaInicioParcialTurno:
        esPaAdministrativoCuartoTurno && alcanceDiurno === "parcial"
          ? horaInicioParcialTurno
          : undefined,
      horaFinParcialTurno:
        esPaAdministrativoCuartoTurno && alcanceDiurno === "parcial"
          ? horaFinParcialTurno
          : undefined,
      cubreConExtra: isPermisoAdministrativo ? (paSoloSalidaCuartoTurno ? false : cubreConExtraActivo) : undefined,
      horaInicioExtra:
        includeHorasExtra
          ? horaInicioExtra
          : undefined,
      horaFinExtra:
        includeHorasExtra
          ? horaFinExtra
          : undefined,
      coberturasExtras:
        isPermisoAdministrativo && cubreConExtraActivo && alcanceDiurno === "completo"
          ? coberturasExtras
          : undefined,
      extraAutonomo: isPermisoAdministrativo ? esExtraAutonomoTurnoLibre : undefined,
      turnoExtraLibre: isPermisoAdministrativo && esExtraAutonomoTurnoLibre ? turnoExtraLibre : undefined,
    });
  };

  const handleDelete = async () => {
    if (loading || deleteLoading) return;
    setConfirmDeleteOpen(false);
    await onDelete?.();
  };

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
                  {headerEyebrow}
                </p>
                <h2 className="text-[1.25rem] font-semibold leading-tight text-neutral-900 sm:text-[1.4rem]">
                  {headerTitle}
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
              <div className="max-w-md space-y-12">
                {funcionarioDiurno ? (
                  <p className="text-xs leading-relaxed text-neutral-600">
                    Ausencia sin cobertura de reemplazo. No aplica cambio de turno ni inversión. Jornada laboral referencial{" "}
                    <strong>
                      {JORNADA_DIURNO_INICIO} a {JORNADA_DIURNO_FIN}
                    </strong>{" "}
                    ({JORNADA_DIURNO_HORAS_UTILES} h). El permiso administrativo y el de capacitación se registran de la misma
                    forma: día completo dentro de esa franja o cantidad de horas parciales (máx. {JORNADA_DIURNO_HORAS_UTILES}{" "}
                    h).
                  </p>
                ) : null}

                <div className="space-y-5">
                  <Input
                    type="date"
                    label={funcionarioDiurno ? "Fecha inicio" : "Fecha"}
                    labelPlacement="outside"
                    value={fecha}
                    onValueChange={setFecha}
                    variant="flat"
                    radius="sm"
                    classNames={inputClassNames}
                  />
                </div>

                {funcionarioDiurno ? (
                  <div className="space-y-5">
                    <Input
                      type="date"
                      label="Fecha término (inclusive)"
                      labelPlacement="outside"
                      value={fechaFin}
                      onValueChange={setFechaFin}
                      variant="flat"
                      radius="sm"
                      classNames={inputClassNames}
                    />
                  </div>
                ) : null}

                <div className="space-y-5">
                  <Select
                    label="Motivo"
                    labelPlacement="outside"
                    selectedKeys={[motivo]}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      const next = typeof value === "string" ? value : funcionarioDiurno ? "feriado_legal" : "cambio";
                      setMotivo(next);
                    }}
                    variant="flat"
                    radius="sm"
                    classNames={selectClassNames}
                    isDisabled={esExtraAutonomoTurnoLibre || (!funcionarioDiurno && mode === "edit" && initialMotivo === "permiso_administrativo")}
                  >
                    {motivoOptions.map((option) => (
                      <SelectItem key={option.key}>{option.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                {muestraAlcancePa ? (
                  <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3">
                    <p className="text-xs font-medium text-neutral-700">
                      {esPaCapDiurno
                        ? "Alcance del permiso (administrativo o capacitación, misma lógica)"
                        : `Alcance del permiso administrativo (jornada de turno de ${JORNADA_CUARTO_TURNO_HORAS} h en ciclo D/N/S/L; máx. ${JORNADA_CUARTO_TURNO_HORAS} h si es parcial).`}
                    </p>
                    <RadioGroup
                      value={alcanceDiurno}
                      onValueChange={(v) => {
                        setAlcanceDiurno(v);
                        if (v === "completo") {
                          setHorasParcial("");
                          setHoraInicioParcialTurno("");
                          setHoraFinParcialTurno("");
                        }
                      }}
                      classNames={{ wrapper: "gap-3" }}
                    >
                      <Radio value="completo">{esPaAdministrativoCuartoTurno ? "Turno completo" : "Día completo"}</Radio>
                      <Radio value="parcial">{esPaAdministrativoCuartoTurno ? "Parte del turno (horas)" : "Parte del día (horas)"}</Radio>
                    </RadioGroup>
                    {alcanceDiurno === "parcial" ? (
                      esPaAdministrativoCuartoTurno ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="time"
                            label="Inicio dentro del turno"
                            labelPlacement="outside"
                            value={horaInicioParcialTurno}
                            onValueChange={setHoraInicioParcialTurno}
                            variant="flat"
                            radius="sm"
                            classNames={inputClassNames}
                            description={`Turno ${turnoReferenciaExtra === "N" ? "20:00-08:00" : "08:00-20:00"}`}
                            isInvalid={Boolean((horaInicioParcialTurno || horaFinParcialTurno) && !isRangoDentroTurno(turnoReferenciaExtra, horaInicioParcialTurno, horaFinParcialTurno))}
                          />
                          <Input
                            type="time"
                            label="Fin dentro del turno"
                            labelPlacement="outside"
                            value={horaFinParcialTurno}
                            onValueChange={setHoraFinParcialTurno}
                            variant="flat"
                            radius="sm"
                            classNames={inputClassNames}
                            description={`Máx. ${maxHorasPaParcial} h dentro del turno`}
                            isInvalid={Boolean((horaInicioParcialTurno || horaFinParcialTurno) && !isRangoDentroTurno(turnoReferenciaExtra, horaInicioParcialTurno, horaFinParcialTurno))}
                            errorMessage={!isRangoDentroTurno(turnoReferenciaExtra, horaInicioParcialTurno, horaFinParcialTurno) ? "El rango debe estar dentro del turno D/N." : undefined}
                          />
                        </div>
                      ) : (
                        <Input
                          type="number"
                          label="Horas dentro de la jornada"
                          labelPlacement="outside"
                          placeholder="Ej. 4"
                          min={0.5}
                          max={maxHorasPaParcial}
                          step={0.5}
                          value={horasParcial}
                          onValueChange={setHorasParcial}
                          variant="flat"
                          radius="sm"
                          classNames={inputClassNames}
                          description={`Horas del permiso respecto de la jornada ${JORNADA_DIURNO_INICIO}–${JORNADA_DIURNO_FIN} (máx. ${maxHorasPaParcial} h).`}
                        />
                      )
                    ) : null}
                  </div>
                ) : null}

                {esPaAdministrativoCuartoTurno && !paSoloSalidaCuartoTurno && !esExtraAutonomoTurnoLibre ? (
                  <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3">
                    <p className="text-xs font-medium text-neutral-700">¿Se cubre con turno extra?</p>
                    <RadioGroup
                      value={cubreConExtra}
                      onValueChange={(value) => {
                        setCubreConExtra(value);
                        if (value === "parcial" && alcanceDiurno === "parcial") {
                          setSyncCoberturaParcialConPermiso(true);
                          setHoraInicioExtra(horaInicioParcialTurno || "");
                          setHoraFinExtra(horaFinParcialTurno || "");
                        }
                      }}
                      classNames={{ wrapper: "gap-3" }}
                    >
                      {alcanceDiurno !== "parcial" ? <Radio value="si">Sí, alguien cubre con extra</Radio> : null}
                      {alcanceDiurno === "parcial" ? (
                        <Radio value="parcial">Cobertura parcial con extra (el titular completa antes o después)</Radio>
                      ) : null}
                      <Radio value="no">No, sin cobertura (solo ausencia)</Radio>
                    </RadioGroup>
                  </div>
                ) : null}

                {esExtraAutonomoTurnoLibre ? (
                  <div className="space-y-3 rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-3">
                    <p className="text-xs font-medium text-neutral-700">Registrar turno extra en día {turnoSolicitante}</p>
                    <Select
                      label="Turno extra a realizar"
                      labelPlacement="outside"
                      selectedKeys={turnoExtraLibre ? [turnoExtraLibre] : []}
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0];
                        setTurnoExtraLibre(value === "N" ? "N" : "D");
                      }}
                      variant="flat"
                      radius="sm"
                      classNames={selectClassNames}
                    >
                      <SelectItem key="D">Día (08:00-20:00)</SelectItem>
                      <SelectItem key="N">Noche (20:00-08:00)</SelectItem>
                    </Select>
                  </div>
                ) : null}

                {!funcionarioDiurno ? (
                  <>
                    {(!isPermisoAdministrativo || cubreConExtraActivo) && !esExtraAutonomoTurnoLibre ? (
                      <div className="space-y-5">
                        <Select
                          label={isPermisoAdministrativo ? "Quién cubre con extra" : "Cubridor"}
                          labelPlacement="outside"
                          placeholder={cubridorOptions.length > 0 ? "Selecciona un funcionario" : motivo === "inversion" ? "No hay cubridores con turno contrario" : isPermisoAdministrativo ? "No hay personal 4to turno disponible" : "No hay cubridores disponibles"}
                          selectedKeys={cubridorId ? [cubridorId] : []}
                          onSelectionChange={(keys) => {
                            const value = Array.from(keys)[0];
                            setCubridorId(typeof value === "string" ? value : "");
                          }}
                          variant="flat"
                          radius="sm"
                          classNames={selectClassNames}
                          isDisabled={cubridorOptions.length === 0}
                        >
                          {cubridorOptions.map((option) => (
                            <SelectItem key={option.id}>{option.label}</SelectItem>
                          ))}
                        </Select>
                      </div>
                    ) : null}

                    {(cubridorId && (!isPermisoAdministrativo || cubreConExtraActivo)) || esExtraAutonomoTurnoLibre ? (
                      <div className="space-y-5">
                        <Popover
                          isOpen={motivo === "cambio" ? calendarOpen : false}
                          onOpenChange={setCalendarOpen}
                          placement="bottom-start"
                          offset={10}
                        >
                          <PopoverTrigger>
                            <div>
                              <Input
                                type="text"
                                label={isPermisoAdministrativo ? "Fecha del extra" : "Fecha que devuelve"}
                                labelPlacement="outside"
                                value={formatFechaDisplay(fechaDevuelveEfectiva)}
                                isReadOnly
                                variant="flat"
                                radius="sm"
                                classNames={inputClassNames}
                                placeholder={motivo === "inversion" ? "En inversión se usa la misma fecha" : isPermisoAdministrativo ? "El extra se asigna en la misma fecha" : "Pulsa para seleccionar una fecha"}
                                endContent={<CalendarDaysIcon className="h-4 w-4 text-neutral-400" />}
                              />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto min-w-0 rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
                            <CalendarioTurnosPicker
                              value={fechaDevuelve}
                              onChange={(nextFecha) => {
                                setFechaDevuelve(nextFecha);
                                setCalendarOpen(false);
                              }}
                              turnosPorFecha={turnosCubridor}
                              helperText="Selecciona un día con turno del cubridor"
                              compact
                            />
                          </PopoverContent>
                        </Popover>

                        {motivo === "inversion" ? (
                          <p className="-mt-2 text-xs text-neutral-500">
                            Para una inversión, el cubridor debe tener el turno contrario ese mismo día y la fecha de devolución es la misma.
                          </p>
                        ) : null}

                        {isPermisoAdministrativo ? (
                          <div className="-mt-2 space-y-2">
                            <p className="text-xs text-neutral-500">
                              En permiso administrativo, la persona seleccionada cubre con extra en la misma fecha y con el turno del solicitante.
                            </p>
                            {alcanceDiurno === "completo" ? (
                              <div className="space-y-2">
                                <p className="text-xs text-neutral-600">
                                  Se propone horario completo por defecto según turno ({turnoReferenciaExtra === "N" ? "20:00 - 08:00" : "08:00 - 20:00"}). Puedes ajustarlo manualmente.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    type="time"
                                    label="Cubre desde"
                                    labelPlacement="outside"
                                    value={horaInicioExtra}
                                    onValueChange={(value) => {
                                      setSyncCoberturaParcialConPermiso(false);
                                      setHoraInicioExtra(value);
                                    }}
                                    variant="flat"
                                    radius="sm"
                                    classNames={inputClassNames}
                                  />
                                  <Input
                                    type="time"
                                    label="Cubre hasta"
                                    labelPlacement="outside"
                                    value={horaFinExtra}
                                    onValueChange={(value) => {
                                      setSyncCoberturaParcialConPermiso(false);
                                      setHoraFinExtra(value);
                                    }}
                                    variant="flat"
                                    radius="sm"
                                    classNames={inputClassNames}
                                  />
                                </div>
                                {missingRangesTurnoCompleto.length > 0 ? (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    Falta cobertura en:{" "}
                                    {missingRangesTurnoCompleto.map((r, i) => (
                                      <span key={`${r.start}-${r.end}`}>
                                        {i > 0 ? ", " : ""}
                                        {offsetToShiftTime(turnoReferenciaExtra, r.start)} - {offsetToShiftTime(turnoReferenciaExtra, r.end)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-emerald-700">Turno completo cubierto.</p>
                                )}
                                <div className="space-y-3">
                                  {coberturasAdicionales.map((item, idx) => (
                                    <div key={`cobertura-adicional-${idx}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                      <p className="mb-2 text-xs font-medium text-neutral-700">Cobertura adicional {idx + 1}</p>
                                      <Select
                                        label="Cubridor"
                                        labelPlacement="outside"
                                        selectedKeys={item.cubridorId ? [item.cubridorId] : []}
                                        onSelectionChange={(keys) => {
                                          const value = Array.from(keys)[0];
                                          setCoberturasAdicionales((prev) => prev.map((it, i) => (
                                            i === idx ? { ...it, cubridorId: typeof value === "string" ? value : "" } : it
                                          )));
                                        }}
                                        variant="flat"
                                        radius="sm"
                                        classNames={selectClassNames}
                                      >
                                        {cubridorOptions.map((option) => (
                                          <SelectItem key={option.id}>{option.label}</SelectItem>
                                        ))}
                                      </Select>
                                      <div className="mt-2 grid grid-cols-2 gap-3">
                                        <Input
                                          type="time"
                                          label="Desde"
                                          labelPlacement="outside"
                                          value={item.horaInicio}
                                          onValueChange={(value) => setCoberturasAdicionales((prev) => prev.map((it, i) => (
                                            i === idx ? { ...it, horaInicio: value } : it
                                          )))}
                                          variant="flat"
                                          radius="sm"
                                          classNames={inputClassNames}
                                        />
                                        <Input
                                          type="time"
                                          label="Hasta"
                                          labelPlacement="outside"
                                          value={item.horaFin}
                                          onValueChange={(value) => setCoberturasAdicionales((prev) => prev.map((it, i) => (
                                            i === idx ? { ...it, horaFin: value } : it
                                          )))}
                                          variant="flat"
                                          radius="sm"
                                          classNames={inputClassNames}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                  {missingRangesTurnoCompleto.length > 0 ? (
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      onPress={() => {
                                        const miss = missingRangesTurnoCompleto[0];
                                        if (!miss) return;
                                        setCoberturasAdicionales((prev) => [
                                          ...prev,
                                          {
                                            cubridorId: "",
                                            horaInicio: offsetToShiftTime(turnoReferenciaExtra, miss.start),
                                            horaFin: offsetToShiftTime(turnoReferenciaExtra, miss.end),
                                          },
                                        ]);
                                      }}
                                    >
                                      Agregar cobertura faltante
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            {alcanceDiurno === "parcial" ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    type="time"
                                    label="Cubre desde"
                                    labelPlacement="outside"
                                    value={horaInicioExtra}
                                    onValueChange={setHoraInicioExtra}
                                    variant="flat"
                                    radius="sm"
                                    classNames={inputClassNames}
                                  />
                                  <Input
                                    type="time"
                                    label="Cubre hasta"
                                    labelPlacement="outside"
                                    value={horaFinExtra}
                                    onValueChange={setHoraFinExtra}
                                    variant="flat"
                                    radius="sm"
                                    classNames={inputClassNames}
                                    isInvalid={Boolean((horaInicioExtra || horaFinExtra) && !isRangoHoraValidoEnTurno(turnoReferenciaExtra, horaInicioExtra, horaFinExtra))}
                                    errorMessage={!isRangoHoraValidoEnTurno(turnoReferenciaExtra, horaInicioExtra, horaFinExtra) ? "Rango horario inválido" : undefined}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <Textarea
                          label="Observaciones"
                          labelPlacement="outside"
                          placeholder="Agrega un detalle para la solicitud"
                          value={observaciones}
                          onValueChange={setObservaciones}
                          variant="flat"
                          minRows={4}
                          classNames={{
                            inputWrapper: "border-0 bg-default-100 shadow-none",
                          }}
                        />
                      </div>
                    ) : null}

                    {(esPaAdministrativoCuartoTurno && cubreConExtra === "no") || paSoloSalidaCuartoTurno ? (
                      <div className="space-y-5">
                        <Textarea
                          label="Observaciones"
                          labelPlacement="outside"
                          placeholder="Detalle opcional del permiso sin cobertura de extra"
                          value={observaciones}
                          onValueChange={setObservaciones}
                          variant="flat"
                          minRows={4}
                          classNames={{
                            inputWrapper: "border-0 bg-default-100 shadow-none",
                          }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-5">
                    <Textarea
                      label="Observaciones"
                      labelPlacement="outside"
                      placeholder="Detalle opcional (además de jornada completa o horas parciales)"
                      value={observaciones}
                      onValueChange={setObservaciones}
                      variant="flat"
                      minRows={4}
                      classNames={{
                        inputWrapper: "border-0 bg-default-100 shadow-none",
                      }}
                    />
                  </div>
                )}
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
                    onPress={() => setConfirmDeleteOpen(true)}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  color="success"
                  className="w-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  isDisabled={!isFormComplete || loading || deleteLoading}
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
                      ¿Eliminar este movimiento?
                    </h3>
                    <p className="text-sm leading-6 text-neutral-500">
                      Esta acción quitará la modificación del calendario y no se puede deshacer.
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