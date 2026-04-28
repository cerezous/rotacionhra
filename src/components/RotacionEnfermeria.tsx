import React from "react";
import { addToast, Button, Popover, PopoverTrigger, PopoverContent, Tooltip } from "@heroui/react";
import { CalendarDaysIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabase";
import { esFuncionarioDiurno } from "../lib/utils";
import { esFinDeSemanaOFeriado } from "../lib/calendarioChile";
import { JORNADA_DIURNO_FIN, JORNADA_DIURNO_HORAS_UTILES, JORNADA_DIURNO_INICIO } from "../lib/jornadaDiurno";
import { JORNADA_CUARTO_TURNO_HORAS } from "../lib/jornadaCuartoTurno";
import { parseObservacionesTurnoExtra } from "../lib/turnoExtraObs";
import { useAppShell } from "../context/AppShellContext";
import { useMovimientosSync } from "../context/MovimientosSyncContext";
import UnaFechaModal from "./UnaFechaModal";
import DosACuatroDias from "./DosACuatroDias";
import VariasFechasModal from "./VariasFechasModal";
import MovimientosRotacion from "./MovimientosRotacion";
import TablaRotacionFuncionarioDiurno from "./TablaRotacionFuncionarioDiurno";
import ExtraTurnoLibreModal from "./ExtraTurnoLibreModal";

const MESES = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const getFechaActual = () => {
  const d = new Date();
  return { mes: String(d.getMonth() + 1), ano: String(d.getFullYear()) };
};

const getAnos = () => {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => y - 1 + i);
};

const getDiasEnMes = (mes, ano) => new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate();

const OFFSET_POR_TURNO = { A: 0, B: 2, C: 3, D: 1 };
const CICLO = ["D", "N", "S", "L"];
const TURNO_COBERTURA = { A: "N", B: "N", C: "D", D: "D" };
const TURNOS_VALIDOS_CAMBIO = new Set(["D", "N", "S", "L"]);

const getTurnoDelDia = (dia, mes, ano, turno) => {
  const raw = (turno || "").toString().toUpperCase();
  const t = raw.match(/[ABCD]/)?.[0] ?? raw.slice(0, 1);
  const offset = OFFSET_POR_TURNO[t];
  if (offset === undefined) return "—";
  const fecha = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
  const abr1 = new Date(parseInt(ano, 10), 3, 1);
  const diffMs = fecha.getTime() - abr1.getTime();
  const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const idx = ((diffDias + offset) % 4 + 4) % 4;
  return CICLO[idx];
};

const COLOR_POR_TURNO = {
  A: "bg-orange-100",
  B: "bg-blue-100",
  C: "bg-green-100",
  D: "bg-pink-100",
};

const COLOR_SUPLENCIA = "bg-sky-100";

const COLOR_POR_MOTIVO = {
  licencia_medica: "bg-green-300",
  feriado_legal: "bg-yellow-300",
  dias_compensatorios: "bg-yellow-300",
  permiso_capacitacion: "bg-amber-300",
  permiso_fallecimiento: "bg-rose-300",
  prenatal: "bg-violet-300",
  postnatal: "bg-purple-300",
};

const MOTIVOS_DOS_A_CUATRO_DIAS = new Set([
  "permiso_capacitacion",
  "permiso_fallecimiento",
  "licencia_medica",
  "feriado_legal",
]);

const diaEnRangoAsume = (dia, mes, ano, fechaInicio, fechaFin) => {
  const y = parseInt(ano, 10);
  const m = parseInt(mes, 10);
  const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const ini = String(fechaInicio || "").slice(0, 10);
  const fin = String(fechaFin || "").slice(0, 10);
  return ini && fin && dStr >= ini && dStr <= fin;
};

const rangosSeSolapan = (inicioA, finA, inicioB, finB) => {
  const desdeA = String(inicioA || "").slice(0, 10);
  const hastaA = String(finA || inicioA || "").slice(0, 10);
  const desdeB = String(inicioB || "").slice(0, 10);
  const hastaB = String(finB || inicioB || "").slice(0, 10);
  return Boolean(desdeA && hastaA && desdeB && hastaB && desdeA <= hastaB && hastaA >= desdeB);
};

/** Salida del funcionario sin asume asociado (ausencia diurna típica: no hay cobertura). */
const getSalidaDiurnoSoloAusencia = (rowId, d, mes, ano, salidas, asumes) => {
  for (const salida of salidas || []) {
    if (String(salida.solicitante_id) !== String(rowId)) continue;
    if (!diaEnRangoAsume(d, mes, ano, salida.fecha_inicio, salida.fecha_fin)) continue;
    const tieneAsume = (asumes || []).some((a) => String(a.salida_id) === String(salida.id));
    if (!tieneAsume) return salida;
  }
  return null;
};

/** Texto corto para tooltips del calendario (rango de asume / ausencia). */
const formatFechaCortaCal = (s) => {
  if (!s) return "—";
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const esRangoHoraValido = (inicio, fin) =>
  Boolean(TIME_RE.test(String(inicio || "")) && TIME_RE.test(String(fin || "")) && String(inicio) < String(fin));
const toMinutesHora = (hhmm) => {
  if (!TIME_RE.test(String(hhmm || ""))) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const shiftOffsetDesdeHora = (turno, hhmm) => {
  const minutes = toMinutesHora(hhmm);
  if (minutes == null) return null;
  if (turno === "N") return minutes >= 20 * 60 ? minutes - 20 * 60 : minutes + 4 * 60;
  if (turno === "D") return minutes >= 8 * 60 ? minutes - 8 * 60 : minutes + 16 * 60;
  return null;
};
const esRangoDentroTurno = (turno, inicio, fin) => {
  const start = shiftOffsetDesdeHora(turno, inicio);
  const end = shiftOffsetDesdeHora(turno, fin);
  return start != null && end != null && end > start && start >= 0 && end <= 12 * 60;
};

const formatFechaSeleccion = (dia, mes, ano) => {
  const fecha = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
};

const formatFechaInput = (dia, mes, ano) => {
  return `${ano}-${String(parseInt(mes, 10)).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
};

const sumarDiasISO = (fecha, dias) => {
  const [year, month, day] = String(fecha || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const nextDate = new Date(Date.UTC(year, month - 1, day + dias));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
};

const turnosIguales = (fechaA, fechaB) => String(fechaA || "").slice(0, 10) === String(fechaB || "").slice(0, 10);

const normalizeCambioTurno = (turno) => {
  const normalized = String(turno || "").trim().toUpperCase();
  return TURNOS_VALIDOS_CAMBIO.has(normalized) ? normalized : null;
};

const getTurnosSeleccionadosEnRango = (rowId, startDay, endDay, mes, ano, personal, asumes) => {
  const turnos = [];

  for (let day = startDay; day <= endDay; day += 1) {
    const fecha = formatFechaInput(day, mes, ano);
    const turno = normalizeCambioTurno(getTurnoCalendarioEnFecha(rowId, fecha, personal, asumes));
    if (turno === "D" || turno === "N") {
      turnos.push({ fecha, turno });
    }
  }

  return turnos;
};

const getTurnosDisponiblesDelMes = (rowId, mes, ano, personal, asumes) => {
  return getTurnosSeleccionadosEnRango(
    rowId,
    1,
    getDiasEnMes(mes, ano),
    mes,
    ano,
    personal,
    asumes,
  );
};

const notifySuccess = (title, description) => {
  addToast({
    title,
    description,
    color: "success",
  });
};

const notifyError = (title, description) => {
  addToast({
    title,
    description,
    color: "danger",
  });
};

const getTurnoContrario = (turno) => {
  if (turno === "D") return "N";
  if (turno === "N") return "D";
  return null;
};

const mapCambioToCalendarShape = (row) => ({
  ...row,
  quien_solicita_id: row.solicitante_id,
  quien_cubre_id: row.cubridor_id,
  quien_solicita: row.solicitante ?? null,
  quien_cubre: row.cubridor ?? null,
  fecha_cambio: row.turno_que_cambia?.fecha ?? null,
  fecha_que_cubre_trabajara: row.turno_que_devuelve?.fecha ?? null,
  turno_cambio: normalizeCambioTurno(row.turno_que_cambia?.turno),
  turno_devuelve: normalizeCambioTurno(row.turno_que_devuelve?.turno),
  motivo: row.motivo === "cambio" ? "cambio_turno" : "inversion",
});

const mapPermisoToCalendarShape = (row) => ({
  ...row,
  quien_solicita_id: row.solicitante_id,
  quien_solicita: row.solicitante ?? null,
  fecha_permiso: row.turno_que_solicita?.fecha ?? null,
  turno_permiso: normalizeCambioTurno(row.turno_que_solicita?.turno),
});

const mapExtraToCalendarShape = (row) => ({
  ...row,
  quien_cubre_id: row.cubridor_extra_id,
  quien_cubre: row.cubridor_extra ?? null,
  fecha_extra_dia: row.fecha_extra?.fecha ?? null,
  turno_extra: normalizeCambioTurno(row.fecha_extra?.turno),
});

const isExtraAutonomoTurnoLibre = (permiso, extra) => {
  const motivo = String(permiso?.motivo || "").toLowerCase();
  const turnoBase = String(permiso?.turno_permiso || permiso?.turno_que_solicita?.turno || "").toUpperCase();
  const mismoFuncionario = String(permiso?.quien_solicita_id || permiso?.solicitante_id || "") === String(extra?.quien_cubre_id || extra?.cubridor_extra_id || "");
  return (motivo === "extra" || motivo === "permiso_administrativo") && (turnoBase === "S" || turnoBase === "L") && mismoFuncionario;
};

const getTurnoEfectivoPorPersonaYFecha = (personaId, dia, mes, ano, personal, asumes, visited = new Set()) => {
  const personaKey = String(personaId || "");
  if (!personaKey || visited.has(personaKey)) return null;

  const persona = personal.find((item) => String(item.id) === personaKey);
  if (!persona) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(personaKey);

  const calidadJuridica = String(persona.calidad_juridica || "").toLowerCase();
  if (calidadJuridica === "suplencia") {
    const asume = (asumes || []).find(
      (item) => String(item.suplencia_id) === personaKey && diaEnRangoAsume(dia, mes, ano, item.fecha_inicio, item.fecha_fin),
    );
    if (!asume) return null;
    return getTurnoEfectivoPorPersonaYFecha(asume.titular_id, dia, mes, ano, personal, asumes, nextVisited);
  }

  return getTurnoDelDia(dia, mes, ano, persona.turno);
};

const getTurnoCalendarioEnFecha = (personaId, fechaIso, personal, asumes) => {
  const [ano, mes, dia] = String(fechaIso || "").slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return getTurnoEfectivoPorPersonaYFecha(personaId, dia, mes, ano, personal, asumes);
};

const MOTIVO_ASUME_CORTO = {
  feriado_legal: "Feriado legal",
  licencia_medica: "Licencia médica",
  dias_compensatorios: "Días compensatorios",
  permiso_capacitacion: "Permiso capacitación",
  permiso_fallecimiento: "Permiso fallecimiento",
  prenatal: "Prenatal",
  postnatal: "Postnatal",
};

const diaCoincideConCambio = (dia, mes, ano, fechaCambio) => {
  if (!fechaCambio) return false;
  const [y, m, d] = String(fechaCambio).slice(0, 10).split("-").map(Number);
  return d === dia && m === parseInt(mes, 10) && y === parseInt(ano, 10);
};

const diaEnRangoCambio = (dia, mes, ano, fechaDesde, fechaHasta) => {
  if (!fechaDesde) return false;
  const dStr = `${parseInt(ano, 10)}-${String(parseInt(mes, 10)).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const desde = String(fechaDesde || "").slice(0, 10);
  const hasta = String(fechaHasta || fechaDesde || "").slice(0, 10);
  return desde && hasta && dStr >= desde && dStr <= hasta;
};

const asumeAbarcaMes = (a, mes, ano) => {
  if (!mes || !ano || !a.fecha_inicio || !a.fecha_fin) return false;
  const m = parseInt(mes, 10);
  const y = parseInt(ano, 10);
  const primerDia = new Date(y, m - 1, 1);
  const ultimoDia = new Date(y, m, 0);
  const inicio = new Date(a.fecha_inicio + "T12:00:00");
  const fin = new Date(a.fecha_fin + "T12:00:00");
  return inicio <= ultimoDia && fin >= primerDia;
};

/** Turno efectivo que trabaja una persona en esa fecha. Para suplencias con asume, usa el ciclo completo del titular que cubre. */
const getTurnoEfectivoDelDia = (personaId, dia, mes, ano, personal, asumes) => {
  return getTurnoEfectivoPorPersonaYFecha(personaId, dia, mes, ano, personal, asumes);
};

/** Personal para la tabla 4to turno: titulares/contrata y todas las suplencias no diurnas.
 * Las suplencias aparecen al final; si no tienen asume en un día, la celda se muestra en "—" con color suplencia. */
const personalParaTabla = (personal, _asumes, _mes, _ano) => {
  return personal;
};

const COLOR_PA = "bg-red-400";
/** Turno extra: quien cubre — día / noche */
const COLOR_TURNO_EXTRA_D = "bg-rose-500";
const COLOR_TURNO_EXTRA_N = "bg-violet-600";

const CELDA_CORTA_AUSENCIA = {
  feriado_legal: "FL",
  licencia_medica: "LM",
  dias_compensatorios: "DC",
  permiso_capacitacion: "PC",
  permiso_administrativo: "PA",
  permiso_fallecimiento: "PF",
  prenatal: "PRE",
  postnatal: "POS",
};
const CELDA_CORTA_PERMISO_EXTRA = {
  ...CELDA_CORTA_AUSENCIA,
  permiso_administrativo: "PA",
  solo_extras: "TE",
};

const COLOR_CAPACITACION = "bg-amber-800";
const COLOR_CAMBIO_TURNO = "bg-sky-400";
const COLOR_INVERSION = "bg-indigo-400";
const COLOR_CUMPLEANOS = "bg-fuchsia-500";
const COLOR_CONSILIACION = "bg-teal-500";

const getColorFila = (row) => {
  const calidadJuridica = (row.calidad_juridica || "").toLowerCase();
  if (calidadJuridica === "suplencia") return COLOR_SUPLENCIA;
  const turno = (row.turno || "A").toUpperCase();
  return COLOR_POR_TURNO[turno] || "bg-gray-100";
};

const ordenarPersonal = (data) => {
  return [...(data || [])].sort((a, b) => {
    const aSuplencia = (a.calidad_juridica || "").toLowerCase() === "suplencia";
    const bSuplencia = (b.calidad_juridica || "").toLowerCase() === "suplencia";
    if (aSuplencia && !bSuplencia) return 1;
    if (!aSuplencia && bSuplencia) return -1;
    const ordTurno = (a.turno || "").localeCompare(b.turno || "");
    if (ordTurno !== 0) return ordTurno;
    const jefeA = ((a.jefe_turno || "").toLowerCase() === "sí" || (a.jefe_turno || "").toLowerCase() === "si") ? 1 : 0;
    const jefeB = ((b.jefe_turno || "").toLowerCase() === "sí" || (b.jefe_turno || "").toLowerCase() === "si") ? 1 : 0;
    if (jefeB - jefeA !== 0) return jefeB - jefeA;
    const subA = ((a.subrogante || "").toLowerCase() === "sí" || (a.subrogante || "").toLowerCase() === "si") ? 1 : 0;
    const subB = ((b.subrogante || "").toLowerCase() === "sí" || (b.subrogante || "").toLowerCase() === "si") ? 1 : 0;
    return subB - subA;
  });
};

export default function RotacionEnfermeria({ titulo = "Rotación Enfermería", servicioId = "", estamento = "enfermeria" }) {
  const { currentUser } = useAppShell();
  const { syncVersion, notifyMovimientosUpdated } = useMovimientosSync();
  const [mes, setMes] = React.useState(() => getFechaActual().mes);
  const [ano, setAno] = React.useState(() => getFechaActual().ano);
  const anos = React.useMemo(() => getAnos(), []);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [leyendaAbierta, setLeyendaAbierta] = React.useState(false);
  const [personal, setPersonal] = React.useState([]);
  const [salidas, setSalidas] = React.useState([]);
  const [asumes, setAsumes] = React.useState([]);
  const [cambios, setCambios] = React.useState([]);
  const [permisos, setPermisos] = React.useState([]);
  const [extras, setExtras] = React.useState([]);
  const [solicitudModal, setSolicitudModal] = React.useState(null);
  const [extraTurnoLibreModal, setExtraTurnoLibreModal] = React.useState(null);
  const [variasFechasModal, setVariasFechasModal] = React.useState(null);
  const [selectionResetKey, setSelectionResetKey] = React.useState(0);
  const [savingSolicitud, setSavingSolicitud] = React.useState(false);
  const [savingExtraTurnoLibre, setSavingExtraTurnoLibre] = React.useState(false);
  const [deletingExtraTurnoLibre, setDeletingExtraTurnoLibre] = React.useState(false);
  const [deletingSolicitud, setDeletingSolicitud] = React.useState(false);
  const hadOpenModalRef = React.useRef(false);

  const anyModalOpen = Boolean(solicitudModal || extraTurnoLibreModal || variasFechasModal);

  React.useEffect(() => {
    if (!anyModalOpen && hadOpenModalRef.current) {
      setSelectionResetKey((prev) => prev + 1);
    }
    hadOpenModalRef.current = anyModalOpen;
  }, [anyModalOpen]);

  const fetchAsumes = React.useCallback(async () => {
    const { data } = await supabase
      .from("asumes")
      .select("*")
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setAsumes(data || []);
  }, [servicioId, estamento]);

  const fetchSalidas = React.useCallback(async () => {
    const { data } = await supabase
      .from("salidas")
      .select("*")
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setSalidas(data || []);
  }, [servicioId, estamento]);

  const fetchCambios = React.useCallback(async () => {
    const { data } = await supabase
      .from("cambios")
      .select(`
        *,
        solicitante:personal!solicitante_id(id, nombre, apellidos, turno),
        cubridor:personal!cubridor_id(id, nombre, apellidos, turno)
      `)
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setCambios(((data || [])).map(mapCambioToCalendarShape));
  }, [servicioId, estamento]);

  const fetchPermisos = React.useCallback(async () => {
    const { data } = await supabase
      .from("permisos")
      .select(`
        *,
        solicitante:personal!solicitante_id(id, nombre, apellidos, turno)
      `)
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setPermisos(((data || [])).map(mapPermisoToCalendarShape));
  }, [servicioId, estamento]);

  const fetchExtras = React.useCallback(async () => {
    const { data } = await supabase
      .from("extras")
      .select(`
        *,
        cubridor_extra:personal!cubridor_extra_id(id, nombre, apellidos, turno)
      `)
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setExtras(((data || [])).map(mapExtraToCalendarShape));
  }, [servicioId, estamento]);

  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? mes;
  const diasDelMes = React.useMemo(() => getDiasEnMes(mes, ano), [mes, ano]);
  const handleAplicar = () => setPopoverOpen(false);

  const fetchPersonal = React.useCallback(async () => {
    const { data } = await supabase
      .from("personal")
      .select("*")
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento);
    setPersonal(ordenarPersonal(data || []));
  }, [servicioId, estamento]);

  React.useEffect(() => {
    fetchPersonal();
    fetchSalidas();
    fetchAsumes();
    fetchCambios();
    fetchPermisos();
    fetchExtras();
  }, [fetchPersonal, fetchSalidas, fetchAsumes, fetchCambios, fetchExtras, fetchPermisos, syncVersion]);

  const getNombreCell = (row) => {
    const nombre = [row.nombre, row.apellidos].filter(Boolean).join(" ") || "—";
    const jefe = (row.jefe_turno || "").toLowerCase() === "sí" || (row.jefe_turno || "").toLowerCase() === "si";
    const sub = (row.subrogante || "").toLowerCase() === "sí" || (row.subrogante || "").toLowerCase() === "si";
    const sufijo = jefe ? " (JT)" : sub ? " (S)" : "";
    const texto = `${nombre}${sufijo}`;
    return jefe || sub ? <span className="font-semibold">{texto}</span> : texto;
  };

  const refreshMovimientos = React.useCallback(async () => {
    await Promise.all([fetchCambios(), fetchPermisos(), fetchExtras()]);
    notifyMovimientosUpdated();
  }, [fetchCambios, fetchExtras, fetchPermisos, notifyMovimientosUpdated]);

  const handleOpenSolicitud = React.useCallback((selection) => {
    if (!selection) return;
    const fechaSeleccionada = formatFechaInput(selection.startDay, mes, ano);
    const turnoSeleccionado = normalizeCambioTurno(
      getTurnoCalendarioEnFecha(selection.rowId, fechaSeleccionada, personal, asumes),
    );

    if (!selection.modoDiurno && selection.startDay === selection.endDay && (turnoSeleccionado === "S" || turnoSeleccionado === "L")) {
      const permisoExtraDia = getPermisoExtraDelDia(selection.rowId, selection.startDay, mes, ano, permisos, extras);
      const esExtraAutonomoExistente = Boolean(permisoExtraDia && isExtraAutonomoTurnoLibre(permisoExtraDia.permiso, permisoExtraDia.extra));
      setExtraTurnoLibreModal({
        mode: esExtraAutonomoExistente ? "edit" : "create",
        permisoId: esExtraAutonomoExistente ? permisoExtraDia.permiso.id : null,
        extraId: esExtraAutonomoExistente ? permisoExtraDia.extra.id : null,
        initialTurnoExtra: esExtraAutonomoExistente ? (permisoExtraDia.extra.turno_extra || "D") : "D",
        solicitanteId: selection.rowId,
        funcionarioNombre: selection.rowLabel,
        fecha: fechaSeleccionada,
        turnoBase: turnoSeleccionado,
      });
      return;
    }
    const fechaFinSeleccion = formatFechaInput(selection.endDay, mes, ano);

    if (selection.modoDiurno) {
      if (selection.startDay === selection.endDay) {
        const salidaSolo = getSalidaDiurnoSoloAusencia(selection.rowId, selection.startDay, mes, ano, salidas, asumes);
        if (salidaSolo) {
          setSolicitudModal({
            mode: "edit",
            source: "diurno_salida",
            salidaId: salidaSolo.id,
            solicitanteId: selection.rowId,
            funcionarioNombre: selection.rowLabel,
            fecha: String(salidaSolo.fecha_inicio || "").slice(0, 10),
            fechaFin: String(salidaSolo.fecha_fin || "").slice(0, 10),
            initialMotivo: salidaSolo.motivo,
            observaciones: salidaSolo.observaciones || "",
            modoDiurno: true,
          });
          return;
        }
      }
      setSolicitudModal({
        mode: "create",
        source: "diurno_salida",
        solicitanteId: selection.rowId,
        funcionarioNombre: selection.rowLabel,
        fecha: fechaSeleccionada,
        fechaFin: fechaFinSeleccion,
        initialMotivo: "feriado_legal",
        observaciones: "",
        modoDiurno: true,
      });
      return;
    }

    const movimientoCambio = getCambioTurnoDelDia(selection.rowId, selection.startDay, mes, ano, cambios);
    if (movimientoCambio) {
      const nombreSolicitante = movimientoCambio.quien_solicita
        ? [movimientoCambio.quien_solicita.nombre, movimientoCambio.quien_solicita.apellidos].filter(Boolean).join(" ")
        : selection.rowLabel;
      const nombreCubridor = movimientoCambio.quien_cubre
        ? [movimientoCambio.quien_cubre.nombre, movimientoCambio.quien_cubre.apellidos].filter(Boolean).join(" ")
        : "—";
      const clickedRole = String(selection.rowId) === String(movimientoCambio.quien_solicita_id) ? "solicitante" : "cubridor";
      setSolicitudModal({
        mode: "edit",
        source: "cambio",
        movementId: movimientoCambio.id,
        clickedRole,
        solicitanteId: movimientoCambio.quien_solicita_id,
        funcionarioNombre: nombreSolicitante || "—",
        cubridorNombre: nombreCubridor,
        fecha: movimientoCambio.fecha_cambio,
        fechaDevuelve: movimientoCambio.fecha_que_cubre_trabajara || movimientoCambio.fecha_cambio,
        cubridorId: movimientoCambio.quien_cubre_id,
        motivo: movimientoCambio.motivo === "inversion" ? "inversion" : "cambio",
        observaciones: movimientoCambio.observaciones || "",
        modoDiurno: selection.modoDiurno,
        turnoSolicitado: movimientoCambio.turno_cambio,
      });
      return;
    }

    const suplenciaYExtras = getSuplenciaYExtrasDelDia(selection.rowId, selection.startDay, mes, ano, asumes, salidas, permisos, extras);
    if (suplenciaYExtras) {
      const nombreSolicitante = suplenciaYExtras.salida.quien_solicita
        ? [suplenciaYExtras.salida.quien_solicita.nombre, suplenciaYExtras.salida.quien_solicita.apellidos].filter(Boolean).join(" ")
        : selection.rowLabel;
      const fechasExtras = suplenciaYExtras.extras.map((item) => ({
        fecha: item.fecha_extra_dia,
        turno: item.turno_extra,
      }));
      const initialExtraAssignments = buildExtraAssignmentsFromRows(suplenciaYExtras.extras);
      const fechaInicio = String(suplenciaYExtras.salida.fecha_inicio || suplenciaYExtras.asume.fecha_inicio || "").slice(0, 10);
      const fechaFin = String(suplenciaYExtras.salida.fecha_fin || fechaInicio).slice(0, 10);
      const turnosDisponibles = getTurnosDisponiblesDelMes(suplenciaYExtras.salida.solicitante_id, mes, ano, personal, asumes);
      const fechasRango = turnosDisponibles.filter((item) => {
        const fecha = String(item?.fecha || "").slice(0, 10);
        return Boolean(fecha && fecha >= fechaInicio && fecha <= fechaFin);
      });

      setVariasFechasModal({
        mode: "edit",
        source: "suplencia_y_extras",
        movementId: suplenciaYExtras.asume.id,
        extraGroupId: suplenciaYExtras.permiso.id,
        salidaId: suplenciaYExtras.salida.id,
        solicitanteId: suplenciaYExtras.salida.solicitante_id,
        funcionarioNombre: nombreSolicitante || "—",
        fechas: fechasRango,
        turnosDisponibles,
        totalTurnos: fechasRango.length,
        modoDiurno: selection.modoDiurno,
        initialMotivo: suplenciaYExtras.salida.motivo || suplenciaYExtras.asume.motivo,
        initialTipoCobertura: "suplencia_y_extras",
        initialSuplenciaId: suplenciaYExtras.asume.suplencia_id,
        initialSuplenciaRangeEnd: String(suplenciaYExtras.asume.fecha_fin || "").slice(0, 10),
        initialExtraAssignments,
        initialObservaciones: suplenciaYExtras.salida.observaciones || suplenciaYExtras.asume.observaciones || suplenciaYExtras.permiso.observaciones || "",
      });
      return;
    }

    const soloExtrasSalida = getSoloExtrasSalidaDelDia(selection.rowId, selection.startDay, mes, ano, salidas, asumes, permisos, extras);
    if (soloExtrasSalida) {
      const nombreSolicitante = soloExtrasSalida.salida.quien_solicita
        ? [soloExtrasSalida.salida.quien_solicita.nombre, soloExtrasSalida.salida.quien_solicita.apellidos].filter(Boolean).join(" ")
        : selection.rowLabel;
      const initialExtraAssignments = buildExtraAssignmentsFromRows(soloExtrasSalida.extras);
      const fechaInicio = String(soloExtrasSalida.salida.fecha_inicio || "").slice(0, 10);
      const fechaFin = String(soloExtrasSalida.salida.fecha_fin || fechaInicio).slice(0, 10);
      const turnosDisponibles = getTurnosDisponiblesDelMes(soloExtrasSalida.salida.solicitante_id, mes, ano, personal, asumes);
      const fechasRango = turnosDisponibles.filter((item) => {
        const fecha = String(item?.fecha || "").slice(0, 10);
        return Boolean(fecha && fecha >= fechaInicio && fecha <= fechaFin);
      });
      const uiVariant = fechasRango.length >= 2
        && fechasRango.length <= 3
        && MOTIVOS_DOS_A_CUATRO_DIAS.has(String(soloExtrasSalida.salida.motivo || soloExtrasSalida.permiso.motivo || "").trim())
        ? "dos_a_cuatro_dias"
        : "varias_fechas";

      setVariasFechasModal({
        uiVariant,
        mode: "edit",
        source: "solo_extras",
        movementId: soloExtrasSalida.permiso.id,
        salidaId: soloExtrasSalida.salida.id,
        solicitanteId: soloExtrasSalida.salida.solicitante_id,
        funcionarioNombre: nombreSolicitante || "—",
        fechas: fechasRango,
        turnosDisponibles,
        totalTurnos: fechasRango.length,
        modoDiurno: selection.modoDiurno,
        initialMotivo: soloExtrasSalida.salida.motivo || soloExtrasSalida.permiso.motivo,
        initialTipoCobertura: "solo_extras",
        initialExtraAssignments,
        initialObservaciones: soloExtrasSalida.salida.observaciones || soloExtrasSalida.permiso.observaciones || "",
      });
      return;
    }

    const permisoExtra = getPermisoExtraDelDia(selection.rowId, selection.startDay, mes, ano, permisos, extras);
    if (permisoExtra) {
      const nombreSolicitante = permisoExtra.permiso.quien_solicita
        ? [permisoExtra.permiso.quien_solicita.nombre, permisoExtra.permiso.quien_solicita.apellidos].filter(Boolean).join(" ")
        : selection.rowLabel;
        const clickedAsSolicitante = String(selection.rowId) === String(permisoExtra.permiso.quien_solicita_id);

      if (permisoExtra.permiso.motivo !== "permiso_administrativo" && clickedAsSolicitante) {
        const extrasRelacionados = [...(permisoExtra.extras || [])].sort((left, right) => String(left.fecha_extra_dia || "9999-12-31").localeCompare(String(right.fecha_extra_dia || "9999-12-31")));
        const fechasExtras = extrasRelacionados.map((item) => ({
          fecha: item.fecha_extra_dia,
          turno: item.turno_extra,
        }));
        const initialExtraAssignments = buildExtraAssignmentsFromRows(extrasRelacionados);
        const salidaRelacionada = (salidas || []).find(
          (salida) =>
            String(salida.solicitante_id) === String(permisoExtra.permiso.quien_solicita_id)
            && String(salida.fecha_inicio || "").slice(0, 10) <= String(fechasExtras[0]?.fecha || fechaSeleccionada).slice(0, 10)
            && String(salida.fecha_fin || "").slice(0, 10) >= String(fechasExtras[fechasExtras.length - 1]?.fecha || fechaSeleccionada).slice(0, 10),
        );
        const fechaInicio = String(salidaRelacionada?.fecha_inicio || fechasExtras[0]?.fecha || fechaSeleccionada).slice(0, 10);
        const fechaFin = String(salidaRelacionada?.fecha_fin || fechasExtras[fechasExtras.length - 1]?.fecha || fechaInicio).slice(0, 10);
        const turnosDisponibles = getTurnosDisponiblesDelMes(permisoExtra.permiso.quien_solicita_id, mes, ano, personal, asumes);
        const fechasRango = turnosDisponibles.filter((item) => {
          const fecha = String(item?.fecha || "").slice(0, 10);
          return Boolean(fecha && fecha >= fechaInicio && fecha <= fechaFin);
        });

        const uiVariant = fechasRango.length >= 2
          && fechasRango.length <= 3
          && MOTIVOS_DOS_A_CUATRO_DIAS.has(String((salidaRelacionada?.motivo || permisoExtra.permiso.motivo || "")).trim())
          ? "dos_a_cuatro_dias"
          : "varias_fechas";

        setVariasFechasModal({
          uiVariant,
          mode: "edit",
          source: "solo_extras",
          movementId: permisoExtra.permiso.id,
          salidaId: salidaRelacionada?.id ?? null,
          solicitanteId: permisoExtra.permiso.quien_solicita_id,
          funcionarioNombre: nombreSolicitante || "—",
          fechas: fechasRango,
          turnosDisponibles,
          totalTurnos: fechasRango.length,
          modoDiurno: selection.modoDiurno,
          initialMotivo: salidaRelacionada?.motivo || permisoExtra.permiso.motivo,
          initialTipoCobertura: "solo_extras",
          initialExtraAssignments,
          initialObservaciones: permisoExtra.permiso.observaciones || permisoExtra.extra.observaciones || "",
        });
        return;
      }

      if (permisoExtra.permiso.motivo === "permiso_administrativo") {
        const nombreCubridor = permisoExtra.extra.quien_cubre
          ? [permisoExtra.extra.quien_cubre.nombre, permisoExtra.extra.quien_cubre.apellidos].filter(Boolean).join(" ")
          : "—";
        const clickedRole = String(selection.rowId) === String(permisoExtra.permiso.quien_solicita_id) ? "solicitante" : "cubridor";
        const extrasOrdenados = [...(permisoExtra.extras || [])].sort((a, b) => String(a.fecha_extra_dia || "").localeCompare(String(b.fecha_extra_dia || "")));
        const extraPrincipal = extrasOrdenados[0] || permisoExtra.extra;
        const extraSecundario = extrasOrdenados[1] || null;
        setSolicitudModal({
          mode: "edit",
          source: "permiso",
          movementId: permisoExtra.permiso.id,
          extraId: extraPrincipal?.id,
          clickedRole,
          solicitanteId: permisoExtra.permiso.quien_solicita_id,
          funcionarioNombre: nombreSolicitante || "—",
          cubridorNombre: nombreCubridor,
          fecha: permisoExtra.permiso.fecha_permiso,
          fechaDevuelve: extraPrincipal?.fecha_extra_dia || permisoExtra.permiso.fecha_permiso,
          cubridorId: extraPrincipal?.quien_cubre_id,
          motivo: "permiso_administrativo",
          observaciones: permisoExtra.permiso.observaciones || permisoExtra.extra.observaciones || "",
          horaInicioExtra: String(extraPrincipal?.fecha_extra?.hora_inicio || ""),
          horaFinExtra: String(extraPrincipal?.fecha_extra?.hora_fin || ""),
          coberturasExtras: extrasOrdenados.map((item) => ({
            cubridorId: item.quien_cubre_id,
            horaInicio: String(item?.fecha_extra?.hora_inicio || ""),
            horaFin: String(item?.fecha_extra?.hora_fin || ""),
          })),
          modoDiurno: selection.modoDiurno,
          turnoSolicitado: permisoExtra.permiso.turno_permiso,
        });
        return;
      }
    }

    const salidaPaCuartoSolo = getSalidaPaCuartoSinCoberturaDelDia(
      selection.rowId,
      selection.startDay,
      mes,
      ano,
      salidas,
      asumes,
      permisos,
      extras,
    );
    if (salidaPaCuartoSolo) {
      setSolicitudModal({
        mode: "edit",
        source: "salida_pa_cuarto",
        salidaId: salidaPaCuartoSolo.id,
        solicitanteId: selection.rowId,
        funcionarioNombre: selection.rowLabel,
        fecha: fechaSeleccionada,
        motivo: "permiso_administrativo",
        observaciones: salidaPaCuartoSolo.observaciones || "",
        modoDiurno: false,
        cubridorNombre: "",
        cubridorId: "",
        turnoSolicitado: normalizeCambioTurno(
          getTurnoCalendarioEnFecha(selection.rowId, fechaSeleccionada, personal, asumes),
        ),
      });
      return;
    }

    const asumeSalida = getAsumeSalidaDelDia(selection.rowId, selection.startDay, mes, ano, asumes, salidas);
    if (asumeSalida) {
      const groupAsumes = asumeSalida.groupAsumes?.length ? asumeSalida.groupAsumes : [asumeSalida.asume];
      const isMultipleGroup = groupAsumes.length > 1 || String(asumeSalida.asume.tipo_cobertura || "") === "multiples_suplencias";
      const solicitante = personal.find((persona) => String(persona.id) === String(asumeSalida.salida.solicitante_id));
      const fechaInicio = String(asumeSalida.salida.fecha_inicio || asumeSalida.asume.fecha_inicio || "").slice(0, 10);
      const fechaFin = String(asumeSalida.salida.fecha_fin || asumeSalida.asume.fecha_fin || fechaInicio).slice(0, 10);
      const turnosDisponibles = getTurnosDisponiblesDelMes(asumeSalida.salida.solicitante_id, mes, ano, personal, asumes);
      const fechasAsume = turnosDisponibles.filter((item) => {
        const fecha = String(item?.fecha || "").slice(0, 10);
        return Boolean(fecha && fecha >= fechaInicio && fecha <= fechaFin);
      });

      setVariasFechasModal({
        mode: "edit",
        source: isMultipleGroup ? "multiples_suplencias" : "una_suplencia",
        movementId: asumeSalida.asume.id,
        movementIds: groupAsumes.map((item) => item.id),
        salidaId: asumeSalida.salida.id,
        solicitanteId: asumeSalida.salida.solicitante_id,
        funcionarioNombre: [solicitante?.nombre, solicitante?.apellidos].filter(Boolean).join(" ") || selection.rowLabel,
        fechas: fechasAsume.length > 0
          ? fechasAsume
          : [{
            fecha: fechaInicio,
            turno: normalizeCambioTurno(getTurnoCalendarioEnFecha(asumeSalida.salida.solicitante_id, fechaInicio, personal, asumes)) || "",
          }],
        turnosDisponibles,
        totalTurnos: fechasAsume.length,
        modoDiurno: selection.modoDiurno,
        initialMotivo: asumeSalida.salida.motivo || asumeSalida.asume.motivo,
        initialTipoCobertura: isMultipleGroup ? "multiples_suplencias" : "una_suplencia",
        initialSuplenciaId: asumeSalida.asume.suplencia_id,
        initialSuplenciaSegments: isMultipleGroup
          ? groupAsumes.map((item) => ({
              suplenciaId: item.suplencia_id,
              end: String(item.fecha_fin || "").slice(0, 10),
            }))
          : [],
        initialObservaciones: asumeSalida.salida.observaciones || asumeSalida.asume.observaciones || "",
      });
      return;
    }

    const turnosSeleccionados = getTurnosSeleccionadosEnRango(
      selection.rowId,
      selection.startDay,
      selection.endDay,
      mes,
      ano,
      personal,
      asumes,
    );

    /** Más de 3 turnos (≥4): modal completo con opciones de suplencias / cobertura. */
    if (turnosSeleccionados.length >= 4) {
      setVariasFechasModal({
        uiVariant: "varias_fechas",
        solicitanteId: selection.rowId,
        funcionarioNombre: selection.rowLabel,
        fechas: turnosSeleccionados,
        turnosDisponibles: getTurnosDisponiblesDelMes(selection.rowId, mes, ano, personal, asumes),
        totalTurnos: turnosSeleccionados.length,
        modoDiurno: selection.modoDiurno,
      });
      return;
    }

    /** 2 o 3 turnos: flujo solo con extras (sin suplencias en el mismo modal). */
    if (turnosSeleccionados.length >= 2 && turnosSeleccionados.length <= 3) {
      setVariasFechasModal({
        uiVariant: "dos_a_cuatro_dias",
        solicitanteId: selection.rowId,
        funcionarioNombre: selection.rowLabel,
        fechas: turnosSeleccionados,
        turnosDisponibles: getTurnosDisponiblesDelMes(selection.rowId, mes, ano, personal, asumes),
        totalTurnos: turnosSeleccionados.length,
        modoDiurno: selection.modoDiurno,
        initialMotivo: "permiso_capacitacion",
      });
      return;
    }

    setSolicitudModal({
      mode: "create",
      clickedRole: "solicitante",
      solicitanteId: selection.rowId,
      funcionarioNombre: selection.rowLabel,
      cubridorNombre: "",
      fecha: fechaSeleccionada,
      motivo: ["S", "L"].includes(
        String(
          normalizeCambioTurno(
            getTurnoCalendarioEnFecha(selection.rowId, fechaSeleccionada, personal, asumes),
          ) || "",
        ),
      )
        ? "permiso_administrativo"
        : "cambio",
      modoDiurno: selection.modoDiurno,
      turnoSolicitado: normalizeCambioTurno(
        getTurnoCalendarioEnFecha(selection.rowId, fechaSeleccionada, personal, asumes),
      ),
    });
  }, [ano, asumes, cambios, extras, mes, permisos, personal, salidas]);

  const handleGuardarExtraTurnoLibre = React.useCallback(async (payload) => {
    if (!extraTurnoLibreModal?.solicitanteId || !currentUser?.hospital_id) return;
    const turnoBase = String(extraTurnoLibreModal.turnoBase || "").toUpperCase();
    const turnoExtra = String(payload?.turnoExtra || "").toUpperCase();
    const fecha = String(payload?.fecha || "").slice(0, 10);
    if (!fecha || (turnoBase !== "S" && turnoBase !== "L") || (turnoExtra !== "D" && turnoExtra !== "N")) {
      notifyError("Datos incompletos", "Indica fecha y turno extra válido.");
      return;
    }
    setSavingExtraTurnoLibre(true);
    if (extraTurnoLibreModal?.mode === "edit" && extraTurnoLibreModal?.permisoId && extraTurnoLibreModal?.extraId) {
      const { error: permisoError } = await supabase
        .from("permisos")
        .update({
          turno_que_solicita: { fecha, turno: turnoBase },
          motivo: "extra",
          observaciones: "Extra en turno libre",
        })
        .eq("id", extraTurnoLibreModal.permisoId);
      if (permisoError) {
        setSavingExtraTurnoLibre(false);
        notifyError("No se pudo actualizar", permisoError.message || "No se pudo actualizar el permiso base.");
        return;
      }
      const { error: extraUpdateError } = await supabase
        .from("extras")
        .update({
          fecha_extra: { fecha, turno: turnoExtra },
          observaciones: "Extra en turno libre",
        })
        .eq("id", extraTurnoLibreModal.extraId);
      if (extraUpdateError) {
        setSavingExtraTurnoLibre(false);
        notifyError("No se pudo actualizar", extraUpdateError.message || "No se pudo actualizar el turno extra.");
        return;
      }
      setSavingExtraTurnoLibre(false);
      await Promise.all([fetchPermisos(), fetchExtras()]);
      notifySuccess("Turno extra actualizado", "Se actualizaron los datos del turno extra en día libre.");
      setExtraTurnoLibreModal(null);
      return;
    }
    const { data: permisoInsertado, error: permisoError } = await supabase
      .from("permisos")
      .insert({
        hospital_id: currentUser.hospital_id,
        servicio_id: servicioId,
        estamento,
        solicitante_id: extraTurnoLibreModal.solicitanteId,
        turno_que_solicita: { fecha, turno: turnoBase },
        motivo: "extra",
        observaciones: "Extra en turno libre",
      })
      .select("id")
      .single();
    if (permisoError || !permisoInsertado?.id) {
      setSavingExtraTurnoLibre(false);
      notifyError("No se pudo guardar", permisoError?.message || "No se pudo crear el registro base del extra.");
      return;
    }
    const { error: extraError } = await supabase.from("extras").insert({
      hospital_id: currentUser.hospital_id,
      servicio_id: servicioId,
      estamento,
      permiso_id: permisoInsertado.id,
      cubridor_extra_id: extraTurnoLibreModal.solicitanteId,
      fecha_extra: { fecha, turno: turnoExtra },
      observaciones: "Extra en turno libre",
    });
    if (extraError) {
      await supabase.from("permisos").delete().eq("id", permisoInsertado.id);
      setSavingExtraTurnoLibre(false);
      notifyError("No se pudo guardar", extraError.message || "No se pudo guardar el turno extra.");
      return;
    }
    setSavingExtraTurnoLibre(false);
    await Promise.all([fetchPermisos(), fetchExtras()]);
    notifySuccess("Turno extra guardado", "Se registró el turno extra en día libre.");
    setExtraTurnoLibreModal(null);
  }, [currentUser?.hospital_id, estamento, extraTurnoLibreModal, fetchExtras, fetchPermisos, servicioId]);

  const handleEliminarExtraTurnoLibre = React.useCallback(async () => {
    if (!extraTurnoLibreModal?.extraId || !extraTurnoLibreModal?.permisoId) return;
    setDeletingExtraTurnoLibre(true);
    const { error: extraError } = await supabase.from("extras").delete().eq("id", extraTurnoLibreModal.extraId);
    if (extraError) {
      setDeletingExtraTurnoLibre(false);
      notifyError("No se pudo eliminar", extraError.message || "No se pudo eliminar el turno extra.");
      return;
    }
    const { error: permisoError } = await supabase.from("permisos").delete().eq("id", extraTurnoLibreModal.permisoId);
    setDeletingExtraTurnoLibre(false);
    if (permisoError) {
      notifyError("No se pudo eliminar", permisoError.message || "No se pudo eliminar el permiso base.");
      return;
    }
    await Promise.all([fetchPermisos(), fetchExtras()]);
    notifySuccess("Turno extra eliminado", "Se eliminó el turno extra en día libre.");
    setExtraTurnoLibreModal(null);
  }, [extraTurnoLibreModal, fetchExtras, fetchPermisos]);

  const handleGuardarSolicitud = React.useCallback(async (payload) => {
    if (!solicitudModal?.solicitanteId || !currentUser?.hospital_id) return;
    const turnoQueCambia = normalizeCambioTurno(
      solicitudModal.turnoSolicitado
      ?? getTurnoCalendarioEnFecha(solicitudModal.solicitanteId, payload.fecha, personal, asumes)
      ?? getTurnoCalendarioEnFecha(solicitudModal.solicitanteId, solicitudModal.fecha, personal, asumes),
    );

    /** PA 4.º turno sin cobertura de extra: solo salida (misma marca de alcance que diurno). */
    if (
      !solicitudModal.modoDiurno
      && payload.motivo === "permiso_administrativo"
      && payload.cubreConExtra === false
    ) {
      const fi = String(payload.fecha || "").slice(0, 10);
      if (!fi) {
        notifyError("Fecha", "Indica la fecha del permiso.");
        return;
      }
      const alc = payload.alcanceDiurno;
      if (alc === "parcial") {
        if (!esRangoDentroTurno(turnoQueCambia, payload.horaInicioParcialTurno, payload.horaFinParcialTurno)) {
          notifyError(
            "Horario",
            `Indica hora inicio y fin válidas dentro del turno (${turnoQueCambia === "N" ? "20:00-08:00" : "08:00-20:00"}).`,
          );
          return;
        }
      }
      let obs = (payload.observaciones || "").trim() || null;
      const tag = alc === "parcial" && payload.horaInicioParcialTurno && payload.horaFinParcialTurno
        ? `Turno12h: ${payload.horaInicioParcialTurno} - ${payload.horaFinParcialTurno}`
        : "Turno12h: jornada completa";
      obs = obs ? `${obs} · ${tag}` : tag;
      setSavingSolicitud(true);
      if (solicitudModal.mode === "edit" && solicitudModal.source === "salida_pa_cuarto" && solicitudModal.salidaId) {
        const { error } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: fi,
            fecha_fin: fi,
            motivo: "permiso_administrativo",
            observaciones: obs,
          })
          .eq("id", solicitudModal.salidaId);
        setSavingSolicitud(false);
        if (error) {
          notifyError("No se pudo guardar", error.message || "No se pudo actualizar el permiso administrativo.");
          return;
        }
        await fetchSalidas();
        notifySuccess("Permiso actualizado", "El permiso administrativo sin extra quedó guardado.");
        setSolicitudModal(null);
        return;
      }
      if (solicitudModal.mode === "edit") {
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", "Este registro no se puede convertir a permiso sin extra desde aquí.");
        return;
      }
      const { error } = await supabase.from("salidas").insert({
        hospital_id: currentUser.hospital_id,
        servicio_id: servicioId,
        estamento,
        solicitante_id: solicitudModal.solicitanteId,
        fecha_inicio: fi,
        fecha_fin: fi,
        motivo: "permiso_administrativo",
        observaciones: obs,
      });
      setSavingSolicitud(false);
      if (error) {
        notifyError("No se pudo guardar", error.message || "No se pudo registrar el permiso administrativo.");
        return;
      }
      await fetchSalidas();
      notifySuccess("Permiso guardado", "Permiso administrativo registrado sin turno extra.");
      setSolicitudModal(null);
      return;
    }

    if (solicitudModal.modoDiurno) {
      const m = payload.motivo;
      if (m === "cambio" || m === "inversion") {
        notifyError("No aplica", "Los funcionarios diurnos no registran cambio de turno ni inversión.");
        return;
      }
      const fi = String(payload.fecha || "").slice(0, 10);
      const ff = String(payload.fechaFin || payload.fecha || "").slice(0, 10);
      if (!fi || !ff || ff < fi) {
        notifyError("Fechas inválidas", "Indica fecha de inicio y término del ausentismo (la fin no puede ser anterior a la inicio).");
        return;
      }
      const esPaCap = m === "permiso_administrativo" || m === "permiso_capacitacion";
      if (esPaCap && payload.alcanceDiurno === "parcial") {
        const h = Number(payload.horasParcial);
        if (!Number.isFinite(h) || h <= 0 || h > JORNADA_DIURNO_HORAS_UTILES) {
          notifyError(
            "Horas",
            `Indica entre 0,5 y ${JORNADA_DIURNO_HORAS_UTILES} horas (jornada diurna referencial ${JORNADA_DIURNO_INICIO}–${JORNADA_DIURNO_FIN}).`,
          );
          return;
        }
      }
      let obs = (payload.observaciones || "").trim() || null;
      if (esPaCap) {
        const tag =
          payload.alcanceDiurno === "parcial" && payload.horasParcial
            ? `Diurno: ${payload.horasParcial} h`
            : "Diurno: jornada completa";
        obs = obs ? `${obs} · ${tag}` : tag;
      }
      setSavingSolicitud(true);
      if (solicitudModal.mode === "edit" && solicitudModal.salidaId) {
        const { error } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: fi,
            fecha_fin: ff,
            motivo: m,
            observaciones: obs,
          })
          .eq("id", solicitudModal.salidaId);
        setSavingSolicitud(false);
        if (error) {
          notifyError("No se pudo guardar", error.message || "No se pudo actualizar la ausencia.");
          return;
        }
        await fetchSalidas();
        notifySuccess("Ausencia actualizada", "El registro del funcionario diurno fue actualizado.");
        setSolicitudModal(null);
        return;
      }
      const { error } = await supabase.from("salidas").insert({
        hospital_id: currentUser.hospital_id,
        servicio_id: servicioId,
        estamento,
        solicitante_id: solicitudModal.solicitanteId,
        fecha_inicio: fi,
        fecha_fin: ff,
        motivo: m,
        observaciones: obs,
      });
      setSavingSolicitud(false);
      if (error) {
        notifyError("No se pudo guardar", error.message || "No se pudo registrar la ausencia.");
        return;
      }
      await fetchSalidas();
      notifySuccess("Ausencia registrada", "La solicitud quedó guardada sin cobertura de reemplazo.");
      setSolicitudModal(null);
      return;
    }

    const fechaDevuelveReal = payload.motivo === "inversion" ? payload.fecha : payload.fechaDevuelve;

    const turnoQueDevuelve = normalizeCambioTurno(
      getTurnoCalendarioEnFecha(payload.cubridorId, fechaDevuelveReal, personal, asumes),
    );

    if (!turnoQueCambia) {
      notifyError("No se pudo guardar", "No se pudo determinar el turno que cambia. Debe ser D, N, S o L.");
      return;
    }

    if (payload.motivo === "permiso_administrativo") {
      const esExtraAutonomo = Boolean(payload.extraAutonomo);
      if (solicitudModal.mode === "edit" && solicitudModal.source !== "permiso") {
        notifyError("Operación no soportada", "Cambiar un movimiento existente a permiso administrativo desde este modal aún no está soportado.");
        return;
      }

      if (!esExtraAutonomo && turnoQueCambia !== "D" && turnoQueCambia !== "N") {
        notifyError("Turno no válido", "El permiso administrativo con extra solo se puede asignar sobre un turno D o N.");
        return;
      }
      const turnoExtraTarget = esExtraAutonomo ? normalizeCambioTurno(payload.turnoExtraLibre) : turnoQueCambia;
      if (!turnoExtraTarget || (turnoExtraTarget !== "D" && turnoExtraTarget !== "N")) {
        notifyError("Turno no válido", "Selecciona un turno extra válido (D o N).");
        return;
      }

      if (payload.alcanceDiurno === "parcial" && !esRangoDentroTurno(turnoExtraTarget, payload.horaInicioExtra, payload.horaFinExtra)) {
        notifyError("Horario inválido", "Indica hora inicio y hora término válidas para la cobertura de extra.");
        return;
      }
      if (payload.alcanceDiurno === "parcial" && !esRangoDentroTurno(turnoExtraTarget, payload.horaInicioParcialTurno, payload.horaFinParcialTurno)) {
        notifyError("Horario inválido", "Indica hora inicio y fin del permiso dentro del turno D/N.");
        return;
      }
      const coberturasExtras = Array.isArray(payload.coberturasExtras) ? payload.coberturasExtras : [];
      const tagPa =
        payload.alcanceDiurno === "parcial" && payload.horaInicioParcialTurno && payload.horaFinParcialTurno
          ? `Turno12h: ${payload.horaInicioParcialTurno} - ${payload.horaFinParcialTurno}`
          : "Turno12h: jornada completa";
      const observacionesPaBase = (payload.observaciones || "").trim() || null;
      const observacionesPa = observacionesPaBase ? `${observacionesPaBase} · ${tagPa}` : tagPa;

      const fechaExtraPayload = {
        fecha: payload.fecha,
        turno: turnoExtraTarget,
        ...(payload.horaInicioExtra && payload.horaFinExtra
          ? { hora_inicio: payload.horaInicioExtra, hora_fin: payload.horaFinExtra }
          : {}),
      };

      setSavingSolicitud(true);

      if (solicitudModal.mode === "edit") {
        const { error: permisoError } = await supabase
          .from("permisos")
          .update({
            turno_que_solicita: {
              fecha: payload.fecha,
              turno: turnoQueCambia,
            },
            observaciones: observacionesPa,
          })
          .eq("id", solicitudModal.movementId);

        if (permisoError) {
          setSavingSolicitud(false);
          notifyError("No se pudo actualizar", permisoError.message || "No se pudo actualizar el permiso administrativo.");
          return;
        }

        const { error: deleteExtrasError } = await supabase.from("extras").delete().eq("permiso_id", solicitudModal.movementId);
        if (deleteExtrasError) {
          setSavingSolicitud(false);
          notifyError("No se pudo actualizar", deleteExtrasError.message || "No se pudieron reemplazar los extras del permiso.");
          return;
        }
        const extrasToInsert = coberturasExtras.length > 0
          ? coberturasExtras.map((c) => ({
              hospital_id: currentUser.hospital_id,
              servicio_id: servicioId,
              estamento,
              permiso_id: solicitudModal.movementId,
              cubridor_extra_id: c.cubridorId,
              fecha_extra: {
                fecha: payload.fecha,
                turno: turnoExtraTarget,
                hora_inicio: c.horaInicio,
                hora_fin: c.horaFin,
              },
              observaciones: observacionesPa,
            }))
          : [
              {
                hospital_id: currentUser.hospital_id,
                servicio_id: servicioId,
                estamento,
                permiso_id: solicitudModal.movementId,
                cubridor_extra_id: esExtraAutonomo ? solicitudModal.solicitanteId : payload.cubridorId,
                fecha_extra: fechaExtraPayload,
                observaciones: observacionesPa,
              },
            ];
        const { error: extraError } = await supabase.from("extras").insert(extrasToInsert);

        setSavingSolicitud(false);

        if (extraError) {
          notifyError("No se pudo actualizar", extraError.message || "No se pudo actualizar el extra asociado al permiso.");
          return;
        }

        await Promise.all([fetchPermisos(), fetchExtras()]);
        notifySuccess("Movimiento actualizado", "El permiso administrativo y su extra quedaron guardados.");
        setSolicitudModal(null);
        return;
      }

      const { data: permisoInsertado, error: permisoError } = await supabase
        .from("permisos")
        .insert({
          hospital_id: currentUser.hospital_id,
          servicio_id: servicioId,
          estamento,
          solicitante_id: solicitudModal.solicitanteId,
          turno_que_solicita: {
            fecha: payload.fecha,
            turno: turnoQueCambia,
          },
          motivo: "permiso_administrativo",
          observaciones: observacionesPa,
        })
        .select("id")
        .single();

      if (permisoError || !permisoInsertado?.id) {
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", permisoError?.message || "No se pudo guardar el permiso administrativo.");
        return;
      }

      const extrasToInsert = coberturasExtras.length > 0
        ? coberturasExtras.map((c) => ({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            permiso_id: permisoInsertado.id,
            cubridor_extra_id: c.cubridorId,
            fecha_extra: {
              fecha: payload.fecha,
              turno: turnoExtraTarget,
              hora_inicio: c.horaInicio,
              hora_fin: c.horaFin,
            },
            observaciones: observacionesPa,
          }))
        : [{
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            permiso_id: permisoInsertado.id,
            cubridor_extra_id: esExtraAutonomo ? solicitudModal.solicitanteId : payload.cubridorId,
            fecha_extra: fechaExtraPayload,
            observaciones: observacionesPa,
          }];
      const { error: extraError } = await supabase.from("extras").insert(extrasToInsert);

      if (extraError) {
        await supabase.from("permisos").delete().eq("id", permisoInsertado.id);
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", extraError.message || "No se pudo guardar el extra asociado al permiso.");
        return;
      }
      setSavingSolicitud(false);
      await Promise.all([fetchPermisos(), fetchExtras()]);
      notifySuccess("Movimiento guardado", "El permiso administrativo y su extra fueron registrados.");
      setSolicitudModal(null);
      return;
    }

    if (solicitudModal.mode === "edit" && solicitudModal.source === "permiso") {
      notifyError("Operación no soportada", "Cambiar un permiso administrativo existente a cambio o inversión desde este modal aún no está soportado.");
      return;
    }

    if (!turnoQueDevuelve) {
      notifyError("No se pudo guardar", "No se pudo determinar el turno que devuelve el cubridor. Debe ser D, N, S o L.");
      return;
    }

    if (payload.motivo === "inversion") {
      const turnoEsperado = getTurnoContrario(turnoQueCambia);
      if (!turnoEsperado || turnoQueDevuelve !== turnoEsperado) {
        notifyError("Inversión inválida", "En una inversión, el cubridor debe tener el turno contrario al solicitante en la misma fecha.");
        return;
      }
    }

    setSavingSolicitud(true);
    const cambioPayload = {
      hospital_id: currentUser.hospital_id,
      servicio_id: servicioId,
      estamento,
      solicitante_id: solicitudModal.solicitanteId,
      cubridor_id: payload.cubridorId,
      turno_que_cambia: {
        fecha: payload.fecha,
        turno: turnoQueCambia,
      },
      turno_que_devuelve: {
        fecha: fechaDevuelveReal,
        turno: turnoQueDevuelve,
      },
      motivo: payload.motivo,
      observaciones: payload.observaciones,
    };
    const { error } = solicitudModal.mode === "edit"
      ? await supabase.from("cambios").update(cambioPayload).eq("id", solicitudModal.movementId)
      : await supabase.from("cambios").insert(cambioPayload);
    setSavingSolicitud(false);

    if (error) {
      notifyError(
        solicitudModal.mode === "edit" ? "No se pudo actualizar" : "No se pudo guardar",
        error.message || (solicitudModal.mode === "edit" ? "No se pudo actualizar la solicitud." : "No se pudo guardar la solicitud."),
      );
      return;
    }

    await fetchCambios();
    notifySuccess(
      solicitudModal.mode === "edit" ? "Movimiento actualizado" : "Movimiento guardado",
      solicitudModal.mode === "edit" ? "La solicitud fue actualizada correctamente." : "La solicitud fue guardada correctamente.",
    );
    setSolicitudModal(null);
  }, [asumes, currentUser?.hospital_id, estamento, fetchCambios, fetchExtras, fetchPermisos, fetchSalidas, personal, servicioId, solicitudModal]);

  const handleEliminarSolicitud = React.useCallback(async () => {
    if (!solicitudModal?.mode || solicitudModal.mode !== "edit") return;
    setDeletingSolicitud(true);

    if (solicitudModal.source === "diurno_salida" && solicitudModal.salidaId) {
      const { error } = await supabase.from("salidas").delete().eq("id", solicitudModal.salidaId);
      setDeletingSolicitud(false);
      if (error) {
        notifyError("No se pudo eliminar", error.message || "No se pudo eliminar la ausencia.");
        return;
      }
      await fetchSalidas();
      notifySuccess("Ausencia eliminada", "El registro del funcionario diurno fue eliminado.");
      setSolicitudModal(null);
      return;
    }

    if (solicitudModal.source === "salida_pa_cuarto" && solicitudModal.salidaId) {
      const { error } = await supabase.from("salidas").delete().eq("id", solicitudModal.salidaId);
      setDeletingSolicitud(false);
      if (error) {
        notifyError("No se pudo eliminar", error.message || "No se pudo eliminar el permiso.");
        return;
      }
      await fetchSalidas();
      notifySuccess("Permiso eliminado", "El permiso administrativo sin cobertura de extra fue eliminado.");
      setSolicitudModal(null);
      return;
    }

    if (solicitudModal.source === "permiso") {
      const { error: extraError } = await supabase.from("extras").delete().eq("id", solicitudModal.extraId);
      if (extraError) {
        setDeletingSolicitud(false);
        notifyError("No se pudo eliminar", extraError.message || "No se pudo eliminar el extra asociado.");
        return;
      }
      const { error: permisoError } = await supabase.from("permisos").delete().eq("id", solicitudModal.movementId);
      setDeletingSolicitud(false);
      if (permisoError) {
        notifyError("No se pudo eliminar", permisoError.message || "No se pudo eliminar el permiso.");
        return;
      }
      await Promise.all([fetchPermisos(), fetchExtras()]);
      notifySuccess("Movimiento eliminado", "El permiso administrativo y su extra fueron eliminados.");
      setSolicitudModal(null);
      return;
    }

    const { error } = await supabase.from("cambios").delete().eq("id", solicitudModal.movementId);
    setDeletingSolicitud(false);
    if (error) {
      notifyError("No se pudo eliminar", error.message || "No se pudo eliminar la solicitud.");
      return;
    }
    await fetchCambios();
    notifySuccess("Movimiento eliminado", "La solicitud fue eliminada correctamente.");
    setSolicitudModal(null);
  }, [fetchCambios, fetchExtras, fetchPermisos, fetchSalidas, solicitudModal]);

  const handleSelectSingleFechaDesdeVarias = React.useCallback((fechaSeleccionada) => {
    if (!variasFechasModal?.solicitanteId || !fechaSeleccionada) return;

    setVariasFechasModal(null);
    setSolicitudModal({
      mode: "create",
      clickedRole: "solicitante",
      solicitanteId: variasFechasModal.solicitanteId,
      funcionarioNombre: variasFechasModal.funcionarioNombre,
      cubridorNombre: "",
      fecha: fechaSeleccionada,
      modoDiurno: variasFechasModal.modoDiurno,
      turnoSolicitado: normalizeCambioTurno(
        getTurnoCalendarioEnFecha(variasFechasModal.solicitanteId, fechaSeleccionada, personal, asumes),
      ),
    });
  }, [asumes, personal, variasFechasModal]);

  const handleGuardarVariasFechas = React.useCallback(async (payload) => {
    if (!variasFechasModal?.solicitanteId || !currentUser?.hospital_id) return;

    const currentSource = variasFechasModal?.mode === "edit" ? variasFechasModal?.source ?? null : null;

    if (payload.tipoCobertura === "solo_extras") {
      if (!Array.isArray(payload.extras) || payload.extras.length === 0) {
        notifyError("Datos incompletos", "Debes asignar quién cubre cada turno extra antes de guardar.");
        return;
      }

      const extrasIncompletos = payload.extras.some((item) => {
        const a = item?.assignment || {};
        if (!item?.fecha || !item?.turno || !a?.cubridorId) return true;
        if (a.cobertura !== "parcial") return false;
        if (!esRangoHoraValido(a.horaInicio, a.horaFin)) return true;
        if (a.cubreResto !== "si") return false;
        return !a.segundoCubridorId || !esRangoHoraValido(a.segundoHoraInicio, a.segundoHoraFin);
      });
      if (extrasIncompletos) {
        notifyError("Datos incompletos", "Falta asignar cubridor en uno o más extras del rango.");
        return;
      }

      setSavingSolicitud(true);
      let salidaId = variasFechasModal?.salidaId ?? null;
      let createdSalidaId = null;

      if (salidaId) {
        const { error: salidaUpdateError } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .eq("id", salidaId);

        if (salidaUpdateError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaUpdateError.message || "No se pudo actualizar la salida asociada a los extras.");
          return;
        }
      } else {
        const { data: salidaInsertada, error: salidaError } = await supabase
          .from("salidas")
          .insert({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            solicitante_id: variasFechasModal.solicitanteId,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .select("id")
          .single();

        if (salidaError || !salidaInsertada?.id) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaError?.message || "No se pudo guardar la salida asociada a los extras.");
          return;
        }

        salidaId = salidaInsertada.id;
        createdSalidaId = salidaInsertada.id;
      }

      const primerExtra = payload.extras[0];
      let permisoId = currentSource === "solo_extras" ? variasFechasModal?.movementId ?? null : null;
      const permisoExistente = Boolean(permisoId);

      if (permisoId) {
        const { error: permisoUpdateError } = await supabase
          .from("permisos")
          .update({
            turno_que_solicita: {
              fecha: primerExtra.fecha,
              turno: primerExtra.turno,
            },
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .eq("id", permisoId);

        if (permisoUpdateError) {
          if (createdSalidaId) await supabase.from("salidas").delete().eq("id", createdSalidaId);
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", permisoUpdateError?.message || "No se pudo actualizar el grupo de extras.");
          return;
        }

        const { error: deleteExtrasError } = await supabase.from("extras").delete().eq("permiso_id", permisoId);
        if (deleteExtrasError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", deleteExtrasError.message || "No se pudieron reemplazar los extras existentes.");
          return;
        }
      } else {
        const { data: permisoInsertado, error: permisoError } = await supabase
          .from("permisos")
          .insert({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            solicitante_id: variasFechasModal.solicitanteId,
            turno_que_solicita: {
              fecha: primerExtra.fecha,
              turno: primerExtra.turno,
            },
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .select("id")
          .single();

        if (permisoError || !permisoInsertado?.id) {
          if (createdSalidaId) await supabase.from("salidas").delete().eq("id", createdSalidaId);
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", permisoError?.message || "No se pudo crear el grupo de extras.");
          return;
        }

        permisoId = permisoInsertado.id;
      }

      const extrasPayload = payload.extras.flatMap((item) => {
        const a = item.assignment || {};
        const first = {
          hospital_id: currentUser.hospital_id,
          servicio_id: servicioId,
          estamento,
          permiso_id: permisoId,
          cubridor_extra_id: a.cubridorId,
          fecha_extra: {
            fecha: item.fecha,
            turno: item.turno,
            ...(a.cobertura === "parcial" ? { hora_inicio: a.horaInicio, hora_fin: a.horaFin } : {}),
          },
          observaciones: payload.observaciones,
        };
        if (a.cobertura === "parcial" && a.cubreResto === "si" && a.segundoCubridorId) {
          return [
            first,
            {
              ...first,
              cubridor_extra_id: a.segundoCubridorId,
              fecha_extra: {
                fecha: item.fecha,
                turno: item.turno,
                hora_inicio: a.segundoHoraInicio,
                hora_fin: a.segundoHoraFin,
              },
            },
          ];
        }
        return [first];
      });

      const { error: extrasError } = await supabase.from("extras").insert(extrasPayload);

      if (extrasError) {
        if (!permisoExistente && permisoId) {
          await supabase.from("permisos").delete().eq("id", permisoId);
        }
        if (createdSalidaId) {
          await supabase.from("salidas").delete().eq("id", createdSalidaId);
        }
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", extrasError.message || "No se pudieron guardar los turnos extra.");
        return;
      }

      if (currentSource === "multiples_suplencias" && variasFechasModal?.salidaId) {
        const { error: asumesDeleteError } = await supabase.from("asumes").delete().eq("salida_id", variasFechasModal.salidaId);
        if (asumesDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumesDeleteError.message || "No se pudieron limpiar las suplencias anteriores.");
          return;
        }
      }

      if (currentSource === "una_suplencia" && variasFechasModal?.movementId) {
        const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
        if (asumeDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo reemplazar la suplencia anterior.");
          return;
        }
      }

      if (currentSource === "suplencia_y_extras") {
        if (variasFechasModal?.movementId) {
          const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
          if (asumeDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
            return;
          }
        }

        if (variasFechasModal?.extraGroupId) {
          const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.extraGroupId);
          if (extrasDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
            return;
          }
          const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.extraGroupId);
          if (permisoDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
            return;
          }
        }
      }

      setSavingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchPermisos(), fetchExtras(), fetchAsumes()]);
      notifySuccess(
        variasFechasModal?.mode === "edit" ? "Extras actualizados" : "Extras guardados",
        variasFechasModal?.mode === "edit"
          ? "El grupo de turnos extra fue actualizado correctamente."
          : "Los turnos extra fueron registrados correctamente.",
      );
      setVariasFechasModal(null);
      return;
    }

    if (payload.tipoCobertura === "suplencia_y_extras") {
      if (!payload.suplenciaId || !payload.fechaInicio || !payload.fechaFin || !payload.suplenciaRangeEnd) {
        notifyError("Datos incompletos", "Debes elegir una suplencia y el tramo que cubrirá antes de asignar extras.");
        return;
      }

      if (!Array.isArray(payload.extras) || payload.extras.length === 0) {
        notifyError("Datos incompletos", "Debes asignar extras para el resto del asume después de la suplencia.");
        return;
      }

      const extrasIncompletos = payload.extras.some((item) => {
        const a = item?.assignment || {};
        if (!item?.fecha || !item?.turno || !a?.cubridorId) return true;
        if (a.cobertura !== "parcial") return false;
        if (!esRangoHoraValido(a.horaInicio, a.horaFin)) return true;
        if (a.cubreResto !== "si") return false;
        return !a.segundoCubridorId || !esRangoHoraValido(a.segundoHoraInicio, a.segundoHoraFin);
      });
      if (extrasIncompletos) {
        notifyError("Datos incompletos", "Falta asignar cubridor en uno o más extras del rango restante.");
        return;
      }

      const suplencia = personal.find((persona) => String(persona.id) === String(payload.suplenciaId));
      if (!suplencia || String(suplencia.calidad_juridica || "").toLowerCase() !== "suplencia") {
        notifyError("Suplencia no válida", "La persona seleccionada no corresponde a una suplencia válida.");
        return;
      }

      const solapamientoLocal = asumes.some((asume) => (
        String(asume.suplencia_id) === String(payload.suplenciaId)
        && !(currentSource === "multiples_suplencias"
          ? String(asume.salida_id || "") === String(variasFechasModal?.salidaId || "")
          : String(asume.id) === String(variasFechasModal?.movementId || ""))
        && rangosSeSolapan(payload.fechaInicio, payload.suplenciaRangeEnd, asume.fecha_inicio, asume.fecha_fin)
      ));

      if (solapamientoLocal) {
        notifyError("Suplencia no disponible", "La suplencia seleccionada ya tiene un asume en el tramo elegido.");
        return;
      }

      setSavingSolicitud(true);

      let salidaId = variasFechasModal?.salidaId ?? null;
      let createdSalidaId = null;

      if (salidaId) {
        const { error: salidaUpdateError } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .eq("id", salidaId);

        if (salidaUpdateError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaUpdateError.message || "No se pudo actualizar la salida.");
          return;
        }
      } else {
        const { data: salidaInsertada, error: salidaError } = await supabase
          .from("salidas")
          .insert({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            solicitante_id: variasFechasModal.solicitanteId,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .select("id")
          .single();

        if (salidaError || !salidaInsertada?.id) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaError?.message || "No se pudo guardar la salida.");
          return;
        }

        salidaId = salidaInsertada.id;
        createdSalidaId = salidaInsertada.id;
      }

      if (currentSource === "solo_extras" && variasFechasModal?.movementId) {
        const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.movementId);
        if (extrasDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
          return;
        }
        const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.movementId);
        if (permisoDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
          return;
        }
      }

      if (currentSource === "una_suplencia" && variasFechasModal?.movementId) {
        const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
        if (asumeDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
          return;
        }
      }

      if (currentSource === "multiples_suplencias" && variasFechasModal?.salidaId) {
        const { error: asumesDeleteError } = await supabase.from("asumes").delete().eq("salida_id", variasFechasModal.salidaId);
        if (asumesDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumesDeleteError.message || "No se pudieron limpiar las suplencias anteriores.");
          return;
        }
      }

      if (currentSource === "suplencia_y_extras") {
        if (variasFechasModal?.movementId) {
          const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
          if (asumeDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
            return;
          }
        }
        if (variasFechasModal?.extraGroupId) {
          const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.extraGroupId);
          if (extrasDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
            return;
          }
          const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.extraGroupId);
          if (permisoDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
            return;
          }
        }
      }

      const { error: asumeInsertError } = await supabase.from("asumes").insert({
        hospital_id: currentUser.hospital_id,
        servicio_id: servicioId,
        estamento,
        salida_id: salidaId,
        suplencia_id: payload.suplenciaId,
        titular_id: variasFechasModal.solicitanteId,
        fecha_inicio: payload.fechaInicio,
        fecha_fin: payload.suplenciaRangeEnd,
        motivo: payload.motivo,
        tipo_cobertura: "suplencia_y_extras",
        observaciones: payload.observaciones,
      });

      if (asumeInsertError) {
        if (createdSalidaId) await supabase.from("salidas").delete().eq("id", createdSalidaId);
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", asumeInsertError.message || "No se pudo guardar la suplencia del grupo.");
        return;
      }

      const primerExtra = payload.extras[0];
      const { data: permisoInsertado, error: permisoError } = await supabase
        .from("permisos")
        .insert({
          hospital_id: currentUser.hospital_id,
          servicio_id: servicioId,
          estamento,
          solicitante_id: variasFechasModal.solicitanteId,
          turno_que_solicita: {
            fecha: primerExtra.fecha,
            turno: primerExtra.turno,
          },
          motivo: payload.motivo,
          observaciones: payload.observaciones,
        })
        .select("id")
        .single();

      if (permisoError || !permisoInsertado?.id) {
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", permisoError?.message || "No se pudo crear el grupo de extras del tramo restante.");
        return;
      }

      const extrasPayload = payload.extras.flatMap((item) => {
        const a = item.assignment || {};
        const first = {
          hospital_id: currentUser.hospital_id,
          servicio_id: servicioId,
          estamento,
          permiso_id: permisoInsertado.id,
          cubridor_extra_id: a.cubridorId,
          fecha_extra: {
            fecha: item.fecha,
            turno: item.turno,
            ...(a.cobertura === "parcial" ? { hora_inicio: a.horaInicio, hora_fin: a.horaFin } : {}),
          },
          observaciones: payload.observaciones,
        };
        if (a.cobertura === "parcial" && a.cubreResto === "si" && a.segundoCubridorId) {
          return [
            first,
            {
              ...first,
              cubridor_extra_id: a.segundoCubridorId,
              fecha_extra: {
                fecha: item.fecha,
                turno: item.turno,
                hora_inicio: a.segundoHoraInicio,
                hora_fin: a.segundoHoraFin,
              },
            },
          ];
        }
        return [first];
      });

      const { error: extrasInsertError } = await supabase.from("extras").insert(extrasPayload);
      if (extrasInsertError) {
        await supabase.from("permisos").delete().eq("id", permisoInsertado.id);
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", extrasInsertError.message || "No se pudieron guardar los extras del tramo restante.");
        return;
      }

      setSavingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchAsumes(), fetchPermisos(), fetchExtras()]);
      notifySuccess(
        variasFechasModal?.mode === "edit" ? "Cobertura actualizada" : "Cobertura guardada",
        variasFechasModal?.mode === "edit"
          ? "La combinación de suplencia y extras fue actualizada correctamente."
          : "La combinación de suplencia y extras quedó registrada correctamente.",
      );
      setVariasFechasModal(null);
      return;
    }

    if (payload.tipoCobertura === "multiples_suplencias") {
      const segmentos = Array.isArray(payload.suplenciaSegments) ? payload.suplenciaSegments : [];
      if (segmentos.length === 0) {
        notifyError("Datos incompletos", "Debes asignar al menos una suplencia para cubrir el rango.");
        return;
      }

      const segmentoInvalido = segmentos.some((segmento) => !segmento?.suplenciaId || !segmento?.fechaInicio || !segmento?.fechaFin);
      if (segmentoInvalido) {
        notifyError("Datos incompletos", "Cada tramo debe tener una suplencia y un rango válido.");
        return;
      }

      let siguienteInicioEsperado = payload.fechaInicio;
      for (const segmento of segmentos) {
        if (String(segmento.fechaInicio) !== String(siguienteInicioEsperado)) {
          notifyError("Rango incompleto", "Las suplencias deben cubrir el asume sin saltos entre tramos.");
          return;
        }
        if (String(segmento.fechaFin) < String(segmento.fechaInicio)) {
          notifyError("Rango inválido", "Uno de los tramos tiene una fecha final anterior a la inicial.");
          return;
        }
        siguienteInicioEsperado = sumarDiasISO(segmento.fechaFin, 1);
      }

      if (String(segmentos[segmentos.length - 1]?.fechaFin || "") !== String(payload.fechaFin)) {
        notifyError("Rango incompleto", "Las suplencias deben cubrir el rango completo del asume hasta la fecha final.");
        return;
      }

      const suplenciasDuplicadas = new Set();
      for (const segmento of segmentos) {
        const key = String(segmento.suplenciaId);
        if (suplenciasDuplicadas.has(key)) {
          notifyError("Suplencia repetida", "Cada tramo debe usar una suplencia distinta para cubrir el resto del asume.");
          return;
        }
        suplenciasDuplicadas.add(key);
      }

      const conflictoLocal = segmentos.find((segmento) => asumes.some((asume) => {
        const mismoGrupoEditado = currentSource === "multiples_suplencias"
          ? String(asume.salida_id || "") === String(variasFechasModal?.salidaId || "")
          : currentSource === "una_suplencia"
            ? String(asume.id) === String(variasFechasModal?.movementId || "")
            : false;

        if (mismoGrupoEditado) return false;
        if (String(asume.suplencia_id) !== String(segmento.suplenciaId)) return false;
        return rangosSeSolapan(segmento.fechaInicio, segmento.fechaFin, asume.fecha_inicio, asume.fecha_fin);
      }));

      if (conflictoLocal) {
        notifyError("Suplencia no disponible", "Una de las suplencias seleccionadas ya tiene un asume en parte del rango asignado.");
        return;
      }

      setSavingSolicitud(true);

      let salidaId = variasFechasModal?.salidaId ?? null;
      let createdSalidaId = null;

      if (salidaId) {
        const { error: salidaUpdateError } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .eq("id", salidaId);

        if (salidaUpdateError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaUpdateError.message || "No se pudo actualizar la salida.");
          return;
        }
      } else {
        const { data: salidaInsertada, error: salidaError } = await supabase
          .from("salidas")
          .insert({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            solicitante_id: variasFechasModal.solicitanteId,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .select("id")
          .single();

        if (salidaError || !salidaInsertada?.id) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaError?.message || "No se pudo guardar la salida.");
          return;
        }

        salidaId = salidaInsertada.id;
        createdSalidaId = salidaInsertada.id;
      }

      if (currentSource === "solo_extras" && variasFechasModal?.movementId) {
        const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.movementId);
        if (extrasDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
          return;
        }

        const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.movementId);
        if (permisoDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
          return;
        }
      }

      if (currentSource === "una_suplencia" && variasFechasModal?.movementId) {
        const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
        if (asumeDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
          return;
        }
      }

      if (currentSource === "multiples_suplencias" && variasFechasModal?.salidaId) {
        const { error: asumesDeleteError } = await supabase.from("asumes").delete().eq("salida_id", variasFechasModal.salidaId);
        if (asumesDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumesDeleteError.message || "No se pudieron reemplazar las suplencias anteriores.");
          return;
        }
      }

      if (currentSource === "suplencia_y_extras") {
        if (variasFechasModal?.movementId) {
          const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
          if (asumeDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
            return;
          }
        }
        if (variasFechasModal?.extraGroupId) {
          const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.extraGroupId);
          if (extrasDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
            return;
          }
          const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.extraGroupId);
          if (permisoDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
            return;
          }
        }
      }

      const asumesPayload = segmentos.map((segmento) => ({
        hospital_id: currentUser.hospital_id,
        servicio_id: servicioId,
        estamento,
        salida_id: salidaId,
        suplencia_id: segmento.suplenciaId,
        titular_id: variasFechasModal.solicitanteId,
        fecha_inicio: segmento.fechaInicio,
        fecha_fin: segmento.fechaFin,
        motivo: payload.motivo,
        tipo_cobertura: "multiples_suplencias",
        observaciones: payload.observaciones,
      }));

      const { error: asumesInsertError } = await supabase.from("asumes").insert(asumesPayload);
      if (asumesInsertError) {
        if (createdSalidaId) {
          await supabase.from("salidas").delete().eq("id", createdSalidaId);
        }
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", asumesInsertError.message || "No se pudieron guardar las suplencias del grupo.");
        return;
      }

      setSavingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchAsumes(), fetchPermisos(), fetchExtras()]);
      notifySuccess(
        variasFechasModal?.mode === "edit" ? "Cobertura actualizada" : "Cobertura guardada",
        variasFechasModal?.mode === "edit"
          ? "Las múltiples suplencias fueron actualizadas correctamente."
          : "Las múltiples suplencias quedaron registradas correctamente.",
      );
      setVariasFechasModal(null);
      return;
    }

    if (payload.tipoCobertura !== "una_suplencia") {
      notifyError("Aún no disponible", "Por ahora solo están implementadas 1 suplencia, 2 o más suplencias y solo extras.");
      return;
    }

    if (!payload.suplenciaId || !payload.fechaInicio || !payload.fechaFin) {
      notifyError("Datos incompletos", "Debes elegir una suplencia y un rango válido antes de guardar.");
      return;
    }

    const suplencia = personal.find((persona) => String(persona.id) === String(payload.suplenciaId));
    if (!suplencia || String(suplencia.calidad_juridica || "").toLowerCase() !== "suplencia") {
      notifyError("Suplencia no válida", "La persona seleccionada no corresponde a una suplencia válida.");
      return;
    }

    const solapamientoLocal = asumes.some((asume) => (
      String(asume.suplencia_id) === String(payload.suplenciaId)
      && !(currentSource === "multiples_suplencias"
        ? String(asume.salida_id || "") === String(variasFechasModal?.salidaId || "")
        : String(asume.id) === String(variasFechasModal?.movementId || ""))
      && rangosSeSolapan(payload.fechaInicio, payload.fechaFin, asume.fecha_inicio, asume.fecha_fin)
    ));

    if (solapamientoLocal) {
      notifyError("Suplencia no disponible", "La suplencia seleccionada ya tiene un asume en ese rango de fechas.");
      return;
    }

    setSavingSolicitud(true);

    const { data: asumeExistente, error: asumeExistenteError } = await supabase
      .from("asumes")
      .select("id")
      .eq("suplencia_id", payload.suplenciaId)
      .lte("fecha_inicio", payload.fechaFin)
      .gte("fecha_fin", payload.fechaInicio)
      .neq("id", String(variasFechasModal?.movementId || "00000000-0000-0000-0000-000000000000"))
      .neq("salida_id", String(currentSource === "multiples_suplencias" ? variasFechasModal?.salidaId || "00000000-0000-0000-0000-000000000000" : "00000000-0000-0000-0000-000000000000"))
      .limit(1)
      .maybeSingle();

    if (asumeExistenteError) {
      setSavingSolicitud(false);
      notifyError("No se pudo validar", asumeExistenteError.message || "No se pudo validar disponibilidad de la suplencia.");
      return;
    }

    if (asumeExistente?.id) {
      setSavingSolicitud(false);
      await fetchAsumes();
      notifyError("Suplencia no disponible", "La suplencia seleccionada ya tomó otro asume en ese rango de fechas.");
      return;
    }

    if (variasFechasModal?.mode === "edit" && currentSource === "una_suplencia" && variasFechasModal?.movementId && variasFechasModal?.salidaId) {
      const { error: salidaUpdateError } = await supabase
        .from("salidas")
        .update({
          fecha_inicio: payload.fechaInicio,
          fecha_fin: payload.fechaFin,
          motivo: payload.motivo,
          observaciones: payload.observaciones,
        })
        .eq("id", variasFechasModal.salidaId);

      if (salidaUpdateError) {
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", salidaUpdateError.message || "No se pudo actualizar la salida.");
        return;
      }

      const { error: asumeUpdateError } = await supabase
        .from("asumes")
        .update({
          suplencia_id: payload.suplenciaId,
          fecha_inicio: payload.fechaInicio,
          fecha_fin: payload.fechaFin,
          motivo: payload.motivo,
          tipo_cobertura: payload.tipoCobertura,
          observaciones: payload.observaciones,
        })
        .eq("id", variasFechasModal.movementId);

      if (asumeUpdateError) {
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", asumeUpdateError.message || "No se pudo actualizar el asume asociado.");
        return;
      }
    } else {
      let salidaId = variasFechasModal?.salidaId ?? null;
      let createdSalidaId = null;

      if (salidaId) {
        const { error: salidaUpdateError } = await supabase
          .from("salidas")
          .update({
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .eq("id", salidaId);

        if (salidaUpdateError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaUpdateError.message || "No se pudo actualizar la salida.");
          return;
        }
      } else {
        const { data: salidaInsertada, error: salidaError } = await supabase
          .from("salidas")
          .insert({
            hospital_id: currentUser.hospital_id,
            servicio_id: servicioId,
            estamento,
            solicitante_id: variasFechasModal.solicitanteId,
            fecha_inicio: payload.fechaInicio,
            fecha_fin: payload.fechaFin,
            motivo: payload.motivo,
            observaciones: payload.observaciones,
          })
          .select("id")
          .single();

        if (salidaError || !salidaInsertada?.id) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", salidaError?.message || "No se pudo guardar la salida.");
          return;
        }

        salidaId = salidaInsertada.id;
        createdSalidaId = salidaInsertada.id;
      }

      if (currentSource === "multiples_suplencias" && variasFechasModal?.salidaId) {
        const { error: asumesDeleteError } = await supabase.from("asumes").delete().eq("salida_id", variasFechasModal.salidaId);
        if (asumesDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", asumesDeleteError.message || "No se pudieron limpiar las suplencias anteriores.");
          return;
        }
      }

      if (currentSource === "suplencia_y_extras") {
        if (variasFechasModal?.movementId) {
          const { error: asumeDeleteError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
          if (asumeDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", asumeDeleteError.message || "No se pudo limpiar la suplencia anterior.");
            return;
          }
        }
        if (variasFechasModal?.extraGroupId) {
          const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.extraGroupId);
          if (extrasDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
            return;
          }
          const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.extraGroupId);
          if (permisoDeleteError) {
            setSavingSolicitud(false);
            notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
            return;
          }
        }
      }

      const { error: asumeError } = await supabase
        .from("asumes")
        .insert({
          hospital_id: currentUser.hospital_id,
          servicio_id: servicioId,
          estamento,
          salida_id: salidaId,
          suplencia_id: payload.suplenciaId,
          titular_id: variasFechasModal.solicitanteId,
          fecha_inicio: payload.fechaInicio,
          fecha_fin: payload.fechaFin,
          motivo: payload.motivo,
          tipo_cobertura: payload.tipoCobertura,
          observaciones: payload.observaciones,
        });

      if (asumeError) {
        if (createdSalidaId) {
          await supabase.from("salidas").delete().eq("id", createdSalidaId);
        }
        setSavingSolicitud(false);
        notifyError("No se pudo guardar", asumeError.message || "No se pudo guardar el asume asociado.");
        return;
      }

      if (currentSource === "solo_extras" && variasFechasModal?.movementId) {
        const { error: extrasDeleteError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.movementId);
        if (extrasDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", extrasDeleteError.message || "No se pudieron limpiar los extras anteriores.");
          return;
        }

        const { error: permisoDeleteError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.movementId);
        if (permisoDeleteError) {
          setSavingSolicitud(false);
          notifyError("No se pudo guardar", permisoDeleteError.message || "No se pudo limpiar el permiso anterior.");
          return;
        }
      }
    }

    setSavingSolicitud(false);
    await Promise.all([fetchSalidas(), fetchAsumes(), fetchPermisos(), fetchExtras()]);
    notifySuccess(
      variasFechasModal?.mode === "edit" ? "Movimiento actualizado" : "Movimiento guardado",
      variasFechasModal?.mode === "edit"
        ? "La salida y su asume quedaron actualizados correctamente."
        : "La salida y su asume quedaron registrados correctamente.",
    );
    setVariasFechasModal(null);
  }, [ano, asumes, currentUser?.hospital_id, estamento, fetchAsumes, fetchExtras, fetchPermisos, fetchSalidas, mes, personal, salidas, servicioId, variasFechasModal]);

  const handleEliminarVariasFechas = React.useCallback(async () => {
    if (variasFechasModal?.mode !== "edit") return;

    setDeletingSolicitud(true);

    if (variasFechasModal.source === "solo_extras") {
      if (variasFechasModal.movementId) {
        const { error: extrasError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.movementId);
        if (extrasError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", extrasError.message || "No se pudieron eliminar los extras del grupo.");
          return;
        }

        const { error: permisoError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.movementId);
        if (permisoError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", permisoError.message || "No se pudo eliminar el permiso del grupo.");
          return;
        }
      }

      if (variasFechasModal.salidaId) {
        const { error: salidaError } = await supabase.from("salidas").delete().eq("id", variasFechasModal.salidaId);
        if (salidaError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", salidaError.message || "No se pudo eliminar la salida asociada.");
          return;
        }
      }

      setDeletingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchPermisos(), fetchExtras()]);
      notifySuccess("Grupo eliminado", "El grupo de turnos extra fue eliminado correctamente.");
      setVariasFechasModal(null);
      return;
    }

    if (variasFechasModal.source === "una_suplencia") {
      if (variasFechasModal.movementId) {
        const { error: asumeError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
        if (asumeError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", asumeError.message || "No se pudo eliminar el asume asociado.");
          return;
        }
      }

      if (variasFechasModal.salidaId) {
        const { error: salidaError } = await supabase.from("salidas").delete().eq("id", variasFechasModal.salidaId);
        if (salidaError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", salidaError.message || "No se pudo eliminar la salida asociada.");
          return;
        }
      }

      setDeletingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchAsumes()]);
      notifySuccess("Grupo eliminado", "La suplencia fue eliminada correctamente.");
      setVariasFechasModal(null);
      return;
    }

    if (variasFechasModal.source === "multiples_suplencias") {
      if (variasFechasModal.salidaId) {
        const { error: salidaError } = await supabase.from("salidas").delete().eq("id", variasFechasModal.salidaId);
        if (salidaError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", salidaError.message || "No se pudo eliminar la salida asociada al grupo.");
          return;
        }
      }

      setDeletingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchAsumes()]);
      notifySuccess("Grupo eliminado", "El grupo de múltiples suplencias fue eliminado correctamente.");
      setVariasFechasModal(null);
      return;
    }

    if (variasFechasModal.source === "suplencia_y_extras") {
      if (variasFechasModal.extraGroupId) {
        const { error: extrasError } = await supabase.from("extras").delete().eq("permiso_id", variasFechasModal.extraGroupId);
        if (extrasError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", extrasError.message || "No se pudieron eliminar los extras del grupo.");
          return;
        }

        const { error: permisoError } = await supabase.from("permisos").delete().eq("id", variasFechasModal.extraGroupId);
        if (permisoError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", permisoError.message || "No se pudo eliminar el permiso del grupo.");
          return;
        }
      }

      if (variasFechasModal.movementId) {
        const { error: asumeError } = await supabase.from("asumes").delete().eq("id", variasFechasModal.movementId);
        if (asumeError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", asumeError.message || "No se pudo eliminar la suplencia asociada.");
          return;
        }
      }

      if (variasFechasModal.salidaId) {
        const { error: salidaError } = await supabase.from("salidas").delete().eq("id", variasFechasModal.salidaId);
        if (salidaError) {
          setDeletingSolicitud(false);
          notifyError("No se pudo eliminar", salidaError.message || "No se pudo eliminar la salida asociada.");
          return;
        }
      }

      setDeletingSolicitud(false);
      await Promise.all([fetchSalidas(), fetchAsumes(), fetchPermisos(), fetchExtras()]);
      notifySuccess("Grupo eliminado", "La combinación de suplencia y extras fue eliminada correctamente.");
      setVariasFechasModal(null);
      return;
    }

    setDeletingSolicitud(false);
  }, [fetchAsumes, fetchExtras, fetchPermisos, fetchSalidas, variasFechasModal]);

  return (
    <div className="mx-auto max-w-[min(100%,1600px)] space-y-8 pb-2">
      <header className="flex flex-col gap-4 border-b border-neutral-200/60 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[1.375rem] font-semibold leading-[1.2] tracking-tight text-neutral-900 sm:text-[1.5rem]">
            {titulo}
          </h2>
          <p className="text-[0.8125rem] font-medium leading-snug text-neutral-500">
            Período: {mesLabel} {ano}
          </p>
        </div>
        <Popover isOpen={popoverOpen} onOpenChange={setPopoverOpen} placement="bottom-end">
          <PopoverTrigger>
            <Button
              size="sm"
              variant="bordered"
              radius="full"
              className="shrink-0 border-neutral-200/90 bg-white/80 px-4 text-[0.8125rem] font-medium text-neutral-700 shadow-sm backdrop-blur-sm"
              startContent={<CalendarDaysIcon className="h-4 w-4 text-neutral-600" />}
            >
              Cambiar fecha
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 min-w-40 p-2">
            <div className="flex flex-col gap-2 w-full">
              <div>
                <label className="text-small text-foreground block mb-1">Mes</label>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full h-8 px-2 rounded-small bg-default-100 text-small border-0 outline-none focus:ring-1 focus:ring-default-400"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-small text-foreground block mb-1">Año</label>
                <select
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="w-full h-8 px-2 rounded-small bg-default-100 text-small border-0 outline-none focus:ring-1 focus:ring-default-400"
                >
                  {anos.map((a) => (
                    <option key={a} value={String(a)}>{a}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" color="primary" onPress={handleAplicar}>
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </header>

      <section className="space-y-3">
        <h3 className="text-[0.6875rem] font-medium uppercase tracking-widest text-neutral-400">
          Rotación 4to turno
        </h3>
        <TablaRotacion
          key={`rotacion-cuarto-${selectionResetKey}`}
          personal={personalParaTabla(
            personal.filter((p) => !esFuncionarioDiurno(p)),
            asumes,
            mes,
            ano
          )}
          diasDelMes={diasDelMes}
          mes={mes}
          ano={ano}
          tituloColumna="Funcionario 4to Turno"
          getNombreCell={getNombreCell}
          salidas={salidas}
          asumes={asumes}
          cambios={cambios}
          permisos={permisos}
          extras={extras}
          onSelectionComplete={handleOpenSolicitud}
        />
      </section>

      {estamento !== "kinesiologia" && (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-[0.6875rem] font-medium uppercase tracking-widest text-neutral-400">
              Rotación diurnos
            </h3>
          </div>
          <TablaRotacionFuncionarioDiurno
            key={`rotacion-diurno-${selectionResetKey}`}
            personal={personalParaTabla(personal.filter((p) => esFuncionarioDiurno(p)), asumes, mes, ano)}
            salidas={salidas}
            asumes={asumes}
            diasDelMes={diasDelMes}
            mes={mes}
            ano={ano}
            tituloColumna="Funcionario diurno"
            getNombreCell={getNombreCell}
            onSelectionComplete={handleOpenSolicitud}
          />
        </section>
      )}

      <section className="space-y-0">
        <button
          type="button"
          onClick={() => setLeyendaAbierta((v) => !v)}
          className="group flex w-full items-center justify-between gap-3 py-1.5 text-left transition-opacity active:opacity-55 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/20 focus-visible:ring-offset-2"
          aria-expanded={leyendaAbierta}
          id="leyenda-rotacion-toggle"
        >
          <span className="text-[0.9375rem] font-normal leading-snug text-[#007AFF]">
            Leyenda — referencia de códigos
          </span>
          <ChevronRightIcon
            className={`h-4.5 w-4.5 shrink-0 text-[#007AFF] opacity-85 transition-transform duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${leyendaAbierta ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>
        {leyendaAbierta && (
          <div
            className="mt-3 border-l-2 border-[#007AFF]/25 pl-4 text-[11px] leading-relaxed text-neutral-600 sm:text-xs"
            role="region"
            aria-labelledby="leyenda-rotacion-toggle"
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_TURNO.A}`} /> Turno A
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_TURNO.B}`} /> Turno B
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_TURNO.C}`} /> Turno C
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_TURNO.D}`} /> Turno D
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_SUPLENCIA}`} /> Suplencia
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 shrink-0 rounded bg-orange-200" /> Fin de semana / Feriado
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_TURNO_EXTRA_D}`} /> Turno extra día (DE)
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_TURNO_EXTRA_N}`} /> Turno extra noche (NE)
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_PA}`} /> Permiso administrativo (histórico)
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_CAPACITACION}`} /> Capacitación
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_CAMBIO_TURNO}`} /> Cambio de turno
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_INVERSION}`} /> Inversión
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_CUMPLEANOS}`} /> Permiso cumpleaños
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_CONSILIACION}`} /> Consiliación familiar
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_MOTIVO.licencia_medica}`} /> Licencia médica
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_MOTIVO.feriado_legal}`} /> Feriado legal
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_MOTIVO.dias_compensatorios}`} /> Días compensatorios (DC)
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_MOTIVO.prenatal}`} /> Prenatal
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 shrink-0 rounded ${COLOR_POR_MOTIVO.postnatal}`} /> Postnatal
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[0.6875rem] font-medium uppercase tracking-widest text-neutral-400">
          Conteo por turno (día / noche)
        </h3>
        <TablaConteoDN
        personal={personalParaTabla(personal.filter((p) => !esFuncionarioDiurno(p)), asumes, mes, ano)}
        asumes={asumes}
        cambios={cambios}
        permisos={permisos}
        extras={extras}
        diasDelMes={diasDelMes}
        mes={mes}
        ano={ano}
        estamento={estamento}
        />
        <MovimientosRotacion cambios={cambios} permisos={permisos} extras={extras} salidas={salidas} asumes={asumes} personal={personal} mes={mes} ano={ano} />
      </section>

      <UnaFechaModal
        isOpen={Boolean(solicitudModal)}
        funcionarioNombre={solicitudModal?.funcionarioNombre ?? ""}
        defaultFecha={solicitudModal?.fecha ?? ""}
        defaultFechaFin={solicitudModal?.fechaFin ?? solicitudModal?.fecha ?? ""}
        funcionarioDiurno={Boolean(solicitudModal?.modoDiurno)}
        solicitanteId={solicitudModal?.solicitanteId ?? ""}
        personal={personal}
        asumes={asumes}
        loading={savingSolicitud}
        deleteLoading={deletingSolicitud}
        allowPermisoAdministrativo
        paSoloSalidaCuartoTurno={solicitudModal?.source === "salida_pa_cuarto"}
        mode={solicitudModal?.mode ?? "create"}
        initialMotivo={solicitudModal?.modoDiurno ? solicitudModal?.initialMotivo ?? "feriado_legal" : solicitudModal?.motivo ?? "cambio"}
        initialCubridorId={solicitudModal?.cubridorId ?? ""}
        initialFechaDevuelve={solicitudModal?.fechaDevuelve ?? ""}
        initialCoberturasExtras={solicitudModal?.coberturasExtras ?? []}
        turnoSolicitadoInicial={solicitudModal?.turnoSolicitado ?? ""}
        initialObservaciones={solicitudModal?.observaciones ?? ""}
        onConfirm={handleGuardarSolicitud}
        onDelete={handleEliminarSolicitud}
        onClose={() => setSolicitudModal(null)}
      />

      <ExtraTurnoLibreModal
        isOpen={Boolean(extraTurnoLibreModal)}
        funcionarioNombre={extraTurnoLibreModal?.funcionarioNombre ?? ""}
        fecha={extraTurnoLibreModal?.fecha ?? ""}
        turnoBase={extraTurnoLibreModal?.turnoBase ?? ""}
        mode={extraTurnoLibreModal?.mode ?? "create"}
        initialTurnoExtra={extraTurnoLibreModal?.initialTurnoExtra ?? "D"}
        loading={savingExtraTurnoLibre}
        deleteLoading={deletingExtraTurnoLibre}
        onClose={() => setExtraTurnoLibreModal(null)}
        onConfirm={handleGuardarExtraTurnoLibre}
        onDelete={handleEliminarExtraTurnoLibre}
      />

      <DosACuatroDias
        isOpen={Boolean(variasFechasModal && variasFechasModal.uiVariant === "dos_a_cuatro_dias")}
        mode={variasFechasModal?.mode ?? "create"}
        funcionarioNombre={variasFechasModal?.funcionarioNombre ?? ""}
        solicitanteId={variasFechasModal?.solicitanteId ?? ""}
        funcionarioDiurno={Boolean(variasFechasModal?.modoDiurno)}
        fechas={variasFechasModal?.fechas ?? []}
        turnosDisponibles={variasFechasModal?.turnosDisponibles ?? []}
        personal={personal}
        loading={savingSolicitud}
        deleteLoading={deletingSolicitud}
        initialMotivo={variasFechasModal?.initialMotivo ?? "permiso_capacitacion"}
        initialExtraAssignments={variasFechasModal?.initialExtraAssignments ?? {}}
        initialObservaciones={variasFechasModal?.initialObservaciones ?? ""}
        onConfirm={handleGuardarVariasFechas}
        onDelete={handleEliminarVariasFechas}
        onSelectSingleDate={handleSelectSingleFechaDesdeVarias}
        onClose={() => setVariasFechasModal(null)}
      />

      <VariasFechasModal
        isOpen={Boolean(variasFechasModal && variasFechasModal.uiVariant !== "dos_a_cuatro_dias")}
        mode={variasFechasModal?.mode ?? "create"}
        source={variasFechasModal?.source ?? null}
        funcionarioNombre={variasFechasModal?.funcionarioNombre ?? ""}
        solicitanteId={variasFechasModal?.solicitanteId ?? ""}
        fechas={variasFechasModal?.fechas ?? []}
        turnosDisponibles={variasFechasModal?.turnosDisponibles ?? []}
        personal={personal}
        asumes={asumes}
        loading={savingSolicitud}
        deleteLoading={deletingSolicitud}
        initialMotivo={variasFechasModal?.initialMotivo ?? "feriado_legal"}
        initialTipoCobertura={variasFechasModal?.initialTipoCobertura ?? "una_suplencia"}
        initialSuplenciaId={variasFechasModal?.initialSuplenciaId ?? ""}
        initialSuplenciaRangeEnd={variasFechasModal?.initialSuplenciaRangeEnd ?? ""}
        initialSuplenciaSegments={variasFechasModal?.initialSuplenciaSegments ?? []}
        initialExtraAssignments={variasFechasModal?.initialExtraAssignments ?? {}}
        initialObservaciones={variasFechasModal?.initialObservaciones ?? ""}
        onConfirm={handleGuardarVariasFechas}
        onDelete={handleEliminarVariasFechas}
        onSelectSingleDate={handleSelectSingleFechaDesdeVarias}
        onClose={() => setVariasFechasModal(null)}
      />
    </div>
  );
}

const COLOR_CONTEO_OK = "bg-green-500 text-white";
const COLOR_CONTEO_WARN = "bg-orange-500 text-white";
const COLOR_CONTEO_BAJO = "bg-red-500 text-white";

const getConteoThresholds = (estamento) => {
  if (String(estamento || "").toLowerCase() === "kinesiologia") {
    return {
      okMin: 3,
      warnValue: 2,
      legend: "Verde: 3+, Naranja: 2, Rojo: 1 o menos",
    };
  }

  return {
    okMin: 6,
    warnValue: 5,
    legend: "Verde: 6+, Naranja: 5, Rojo: 4 o menos",
  };
};

const getColorConteo = (n, thresholds) => {
  if (n >= thresholds.okMin) return COLOR_CONTEO_OK;
  if (n === thresholds.warnValue) return COLOR_CONTEO_WARN;
  return COLOR_CONTEO_BAJO;
};

const getCambioTurnoDelDia = (rowId, d, mes, ano, cambios) => {
  return (cambios || []).find(
    (c) => (c.motivo === "cambio_turno" || c.motivo === "inversion") &&
      (diaCoincideConCambio(d, mes, ano, c.fecha_cambio) || (c.fecha_que_cubre_trabajara && diaCoincideConCambio(d, mes, ano, c.fecha_que_cubre_trabajara))) &&
      (String(c.quien_solicita_id) === String(rowId) || String(c.quien_cubre_id) === String(rowId)),
  );
};

/** PA 4.º turno registrado solo en `salidas` (sin asume ni permiso+extra ese día). */
const getSalidaPaCuartoSinCoberturaDelDia = (rowId, d, mes, ano, salidas, asumes, permisos, extras) => {
  const fecha = formatFechaInput(d, mes, ano);
  for (const salida of salidas || []) {
    if (String(salida.solicitante_id) !== String(rowId)) continue;
    if (String(salida.motivo || "").toLowerCase() !== "permiso_administrativo") continue;
    const fi = String(salida.fecha_inicio || "").slice(0, 10);
    const ff = String(salida.fecha_fin || "").slice(0, 10);
    if (!fi || !ff || fecha < fi || fecha > ff) continue;
    const tieneAsume = (asumes || []).some((item) => String(item.salida_id || "") === String(salida.id));
    if (tieneAsume) continue;
    const extraPaEseDia = (extras || []).some((ex) => {
      const permiso = (permisos || []).find((p) => String(p.id) === String(ex.permiso_id));
      if (!permiso) return false;
      if (String(permiso.quien_solicita_id) !== String(rowId)) return false;
      if (String(permiso.motivo || "") !== "permiso_administrativo") return false;
      return String(ex.fecha_extra_dia || "").slice(0, 10) === fecha;
    });
    if (extraPaEseDia) continue;
    return salida;
  }
  return null;
};

const getPermisoExtraDelDia = (rowId, d, mes, ano, permisos, extras) => {
  const extrasDelDia = (extras || []).filter((item) => diaCoincideConCambio(d, mes, ano, item.fecha_extra_dia));

  for (const extra of extrasDelDia) {
    const permiso = (permisos || []).find((item) => String(item.id) === String(extra.permiso_id));
    if (!permiso) continue;

    const extrasRelacionados = extrasDelDia.filter((item) => String(item.permiso_id) === String(permiso.id));
    const extraDelRow = extrasRelacionados.find((item) => String(item.quien_cubre_id) === String(rowId)) || null;

    if (String(permiso.quien_solicita_id) === String(rowId) || extraDelRow) {
      return {
        permiso,
        extra: extraDelRow || extrasRelacionados[0] || extra,
        extras: extrasRelacionados,
      };
    }
  }
  return null;
};

const buildExtraAssignmentsFromRows = (rows = []) => {
  const byDate = new Map();
  const sorted = [...rows].sort((a, b) => String(a.fecha_extra_dia || "").localeCompare(String(b.fecha_extra_dia || "")));
  for (const item of sorted) {
    const fecha = String(item.fecha_extra_dia || "").slice(0, 10);
    if (!fecha) continue;
    const horaInicio = String(item?.fecha_extra?.hora_inicio || "");
    const horaFin = String(item?.fecha_extra?.hora_fin || "");
    const curr = byDate.get(fecha);
    if (!curr) {
      byDate.set(fecha, {
        cubridorId: item.quien_cubre_id || "",
        cobertura: horaInicio && horaFin ? "parcial" : "completo",
        horaInicio,
        horaFin,
        cubreResto: "no",
        segundoCubridorId: "",
        segundoHoraInicio: "",
        segundoHoraFin: "",
      });
      continue;
    }
    byDate.set(fecha, {
      ...curr,
      cubreResto: "si",
      segundoCubridorId: item.quien_cubre_id || "",
      segundoHoraInicio: horaInicio,
      segundoHoraFin: horaFin,
      cobertura: "parcial",
    });
  }
  return Object.fromEntries(byDate);
};

const getSoloExtrasSalidaDelDia = (rowId, d, mes, ano, salidas, asumes, permisos, extras) => {
  const fecha = formatFechaInput(d, mes, ano);

  for (const salida of salidas || []) {
    if (String(salida.solicitante_id) !== String(rowId)) continue;

    const fechaInicio = String(salida.fecha_inicio || "").slice(0, 10);
    const fechaFin = String(salida.fecha_fin || "").slice(0, 10);
    if (!fechaInicio || !fechaFin || fecha < fechaInicio || fecha > fechaFin) continue;

    const tieneAsumeAsociado = (asumes || []).some((item) => String(item.salida_id || "") === String(salida.id));
    if (tieneAsumeAsociado) continue;

    const extrasGroup = (permisos || [])
      .map((permiso) => ({
        permiso,
        extras: (extras || [])
          .filter((item) => String(item.permiso_id) === String(permiso.id))
          .sort((left, right) => String(left.fecha_extra_dia || "").localeCompare(String(right.fecha_extra_dia || ""))),
      }))
      .find(({ permiso, extras: extrasRelacionados }) => {
        if (String(permiso?.quien_solicita_id || "") !== String(salida.solicitante_id || "")) return false;
        if (String(permiso?.motivo || "") === "permiso_administrativo") return false;
        if (!extrasRelacionados.length) return false;
        const primerExtra = String(extrasRelacionados[0]?.fecha_extra_dia || "").slice(0, 10);
        const ultimoExtra = String(extrasRelacionados[extrasRelacionados.length - 1]?.fecha_extra_dia || "").slice(0, 10);
        return primerExtra >= fechaInicio && ultimoExtra <= fechaFin;
      });

    if (!extrasGroup) continue;

    return {
      salida,
      permiso: extrasGroup.permiso,
      extras: extrasGroup.extras,
    };
  }

  return null;
};

const getAsumeSalidaDelDia = (rowId, d, mes, ano, asumes, salidas) => {
  const asumeTitular = (asumes || []).find(
    (item) =>
      String(item.titular_id) === String(rowId)
      && diaEnRangoAsume(d, mes, ano, item.fecha_inicio, item.fecha_fin),
  );

  const asumeSuplencia = asumeTitular ? null : (asumes || []).find(
    (item) =>
      String(item.suplencia_id) === String(rowId)
      && diaEnRangoAsume(d, mes, ano, item.fecha_inicio, item.fecha_fin),
  );

  const asume = asumeTitular || asumeSuplencia;

  if (!asume) return null;

  const salida = (salidas || []).find((item) => String(item.id) === String(asume.salida_id)) || null;
  if (!salida) return null;

  const groupAsumes = (asumes || [])
    .filter((item) => String(item.salida_id || "") === String(salida.id))
    .sort((left, right) => String(left.fecha_inicio || "").localeCompare(String(right.fecha_inicio || "")));

  return { asume, salida, groupAsumes };
};

const getSuplenciaYExtrasDelDia = (rowId, d, mes, ano, asumes, salidas, permisos, extras) => {
  const fecha = formatFechaInput(d, mes, ano);

  const buildResultForSalida = (salida, allowSuplenciaClick = false) => {
    const fechaInicio = String(salida.fecha_inicio || "").slice(0, 10);
    const fechaFin = String(salida.fecha_fin || "").slice(0, 10);
    if (!fechaInicio || !fechaFin || fecha < fechaInicio || fecha > fechaFin) return null;

    const asume = (asumes || []).find(
      (item) => String(item.salida_id || "") === String(salida.id) && String(item.tipo_cobertura || "") === "suplencia_y_extras",
    );
    if (!asume) return null;

    const extrasGroup = (permisos || [])
      .map((permiso) => ({
        permiso,
        extras: (extras || [])
          .filter((item) => String(item.permiso_id) === String(permiso.id))
          .sort((left, right) => String(left.fecha_extra_dia || "").localeCompare(String(right.fecha_extra_dia || ""))),
      }))
      .find(({ permiso, extras: extrasRelacionados }) => {
        if (String(permiso?.quien_solicita_id || "") !== String(salida.solicitante_id || "")) return false;
        if (String(permiso?.motivo || "") === "permiso_administrativo") return false;
        if (!extrasRelacionados.length) return false;
        const primerExtra = String(extrasRelacionados[0]?.fecha_extra_dia || "").slice(0, 10);
        const ultimoExtra = String(extrasRelacionados[extrasRelacionados.length - 1]?.fecha_extra_dia || "").slice(0, 10);
        return primerExtra === sumarDiasISO(asume.fecha_fin, 1) && ultimoExtra <= fechaFin;
      });

    if (!extrasGroup) return null;

    const clickedAsSolicitante = String(rowId) === String(salida.solicitante_id);
    const clickedAsSuplencia = allowSuplenciaClick
      && String(rowId) === String(asume.suplencia_id)
      && fecha >= String(asume.fecha_inicio || "").slice(0, 10)
      && fecha <= String(asume.fecha_fin || "").slice(0, 10);

    if (!clickedAsSolicitante && !clickedAsSuplencia) return null;

    return {
      salida,
      asume,
      permiso: extrasGroup.permiso,
      extras: extrasGroup.extras,
    };
  };

  for (const salida of salidas || []) {
    if (String(salida.solicitante_id) !== String(rowId)) continue;
    const result = buildResultForSalida(salida, false);
    if (result) return result;
  }

  for (const salida of salidas || []) {
    const result = buildResultForSalida(salida, true);
    if (result) return result;
  }

  return null;
};

/**
 * Cubridor con turnos extra (DE/NE) para un titular ausente: en días del asume sin TE ese día,
 * si el ciclo del cubridor es libre (L), mostrar − con color del motivo de ausencia.
 */
const cubridorLibreEntreExtrasEnRangoAsume = (row, d, mes, ano, personal, asumes, salidas, permisos, extras) => {
  const ciclo = getTurnoDelDia(d, mes, ano, row.turno);
  if (ciclo !== "L" && ciclo !== "—") return null;

  const tesCubre = (extras || []).filter(
    (item) => String(item.quien_cubre_id) === String(row.id)
  );
  if (tesCubre.length === 0) return null;

  const solicitantesIds = [...new Set(
    tesCubre
      .map((item) => permisos.find((permiso) => String(permiso.id) === String(item.permiso_id))?.quien_solicita_id)
      .filter(Boolean)
      .map(String),
  )];
  for (const sid of solicitantesIds) {
    const tieneSalidaPropiaEseDia = (salidas || []).some(
      (salida) =>
        String(salida.solicitante_id) === String(sid)
        && diaEnRangoAsume(d, mes, ano, salida.fecha_inicio, salida.fecha_fin),
    );
    if (tieneSalidaPropiaEseDia) continue;

    const asumeBloque = asumes.find(
      (a) =>
        String(a.titular_id) === String(sid) &&
        diaEnRangoAsume(d, mes, ano, a.fecha_inicio, a.fecha_fin)
    );
    if (!asumeBloque) continue;

    const extrasDelPar = tesCubre
      .filter((item) => {
        const permiso = permisos.find((entry) => String(entry.id) === String(item.permiso_id));
        return String(permiso?.quien_solicita_id) === String(sid);
      })
      .sort((left, right) => String(left.fecha_extra_dia || "").localeCompare(String(right.fecha_extra_dia || "")));

    if (String(asumeBloque.tipo_cobertura || "") === "suplencia_y_extras") {
      const primerExtra = String(extrasDelPar[0]?.fecha_extra_dia || "").slice(0, 10);
      const fechaActual = formatFechaInput(d, mes, ano);
      if (!primerExtra || fechaActual < primerExtra) continue;
    }

    const hayTeEsteDiaParaPar = tesCubre.some(
      (item) => {
        const permiso = permisos.find((entry) => String(entry.id) === String(item.permiso_id));
        return String(permiso?.quien_solicita_id) === String(sid) && diaCoincideConCambio(d, mes, ano, item.fecha_extra_dia);
      }
    );
    if (hayTeEsteDiaParaPar) continue;

    const solicitante = personal.find((p) => String(p.id) === String(sid));
    const nombreSolicita = solicitante ? [solicitante.nombre, solicitante.apellidos].filter(Boolean).join(" ") : "—";
    const motivoKey = asumeBloque.motivo;
    const motivoTxt = MOTIVO_ASUME_CORTO[motivoKey] ?? String(motivoKey || "").replace(/_/g, " ");
    const rango = `Del ${formatFechaCortaCal(asumeBloque.fecha_inicio)} al ${formatFechaCortaCal(asumeBloque.fecha_fin)}`;
    return {
      motivoKey,
      cellTitle: `${rango} — Cubre turnos extra a ${nombreSolicita} (${motivoTxt}). Día libre en ciclo (−).`,
    };
  }
  return null;
};

const getValorParaConteo = (row, d, mes, ano, personal, asumes, cambios, permisos, extras) => {
  const cambioTurno = cambios.find(
    (c) => (c.motivo === "cambio_turno" || c.motivo === "inversion") &&
      (diaCoincideConCambio(d, mes, ano, c.fecha_cambio) || (c.fecha_que_cubre_trabajara && diaCoincideConCambio(d, mes, ano, c.fecha_que_cubre_trabajara))) &&
      (String(c.quien_solicita_id) === String(row.id) || String(c.quien_cubre_id) === String(row.id))
  );
  const permisoExtra = !cambioTurno ? getPermisoExtraDelDia(row.id, d, mes, ano, permisos, extras) : null;
  const esCubreCapacitacion = (c) => {
    if (String(c.quien_cubre_id) === String(row.id)) return true;
    const ids = c.quienes_cubren_ids || [];
    return ids.some((cid) => String(cid) === String(row.id));
  };
  const cambioCapacitacion = !cambioTurno && !permisoExtra && cambios.find(
    (c) => (c.motivo || "").toLowerCase() === "capacitacion" &&
      diaEnRangoCambio(d, mes, ano, c.fecha_cambio, c.fecha_que_cubre_trabajara) &&
      (String(c.quien_solicita_id) === String(row.id) || esCubreCapacitacion(c))
  );
  const cambioCumpleanos = !cambioTurno && !permisoExtra && !cambioCapacitacion && cambios.find(
    (c) => (c.motivo || "").toLowerCase() === "permiso_cumpleanos" &&
      diaCoincideConCambio(d, mes, ano, c.fecha_cambio) &&
      (String(c.quien_solicita_id) === String(row.id) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(row.id)))
  );
  const cambioConsiliacion = !cambioTurno && !permisoExtra && !cambioCapacitacion && !cambioCumpleanos && cambios.find(
    (c) => (c.motivo || "").toLowerCase() === "consilacion_familiar" &&
      diaCoincideConCambio(d, mes, ano, c.fecha_cambio) &&
      (String(c.quien_solicita_id) === String(row.id) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(row.id)))
  );
  if (cambioTurno) {
    const esInversion = cambioTurno.motivo === "inversion";
    const turnoCambio = cambioTurno.turno_cambio;
    const turnoDevuelve = cambioTurno.turno_devuelve;
    const esMismoDiaInv = esInversion && cambioTurno.fecha_que_cubre_trabajara && turnosIguales(cambioTurno.fecha_cambio, cambioTurno.fecha_que_cubre_trabajara);
    if (diaCoincideConCambio(d, mes, ano, cambioTurno.fecha_cambio)) {
      if (String(cambioTurno.quien_solicita_id) === String(row.id)) {
        if (esInversion && esMismoDiaInv) return turnoDevuelve === "D" || turnoDevuelve === "N" ? turnoDevuelve : null;
        return null;
      }
      return turnoCambio === "D" || turnoCambio === "N" ? turnoCambio : null;
    }
    if (cambioTurno.fecha_que_cubre_trabajara && diaCoincideConCambio(d, mes, ano, cambioTurno.fecha_que_cubre_trabajara)) {
      if (String(cambioTurno.quien_cubre_id) === String(row.id)) return null;
      return turnoDevuelve === "D" || turnoDevuelve === "N" ? turnoDevuelve : null;
    }
  }
  if (permisoExtra) {
    if (String(permisoExtra.permiso.quien_solicita_id) === String(row.id)) return null;
    return permisoExtra.extra.turno_extra === "D" || permisoExtra.extra.turno_extra === "N" ? permisoExtra.extra.turno_extra : null;
  }
  if (cambioCapacitacion) {
    if (String(cambioCapacitacion.quien_solicita_id) === String(row.id)) return null;
    return getTurnoEfectivoDelDia(cambioCapacitacion.quien_solicita_id, d, mes, ano, personal, asumes) || null;
  }
  if (cambioCumpleanos) {
    if (String(cambioCumpleanos.quien_solicita_id) === String(row.id)) return null;
    return getTurnoEfectivoDelDia(cambioCumpleanos.quien_solicita_id, d, mes, ano, personal, asumes) || null;
  }
  if (cambioConsiliacion) {
    if (String(cambioConsiliacion.quien_solicita_id) === String(row.id)) return null;
    return getTurnoEfectivoDelDia(cambioConsiliacion.quien_solicita_id, d, mes, ano, personal, asumes) || null;
  }
  const asumeSuplencia = asumes.find(
    (a) => String(a.suplencia_id) === String(row.id) && diaEnRangoAsume(d, mes, ano, a.fecha_inicio, a.fecha_fin)
  );
  const asumeTitular = asumes.find(
    (a) => String(a.titular_id) === String(row.id) && diaEnRangoAsume(d, mes, ano, a.fecha_inicio, a.fecha_fin)
  );
  if (asumeSuplencia) {
    const titular = personal.find((p) => String(p.id) === String(asumeSuplencia.titular_id));
    const v = getTurnoDelDia(d, mes, ano, titular?.turno);
    return v === "D" || v === "N" ? v : null;
  }
  if (asumeTitular) return null;
  const calidadJuridica = (row.calidad_juridica || "").toLowerCase();
  if (calidadJuridica === "suplencia") return null;
  const v = getTurnoDelDia(d, mes, ano, row.turno);
  return v === "D" || v === "N" ? v : null;
};

function TablaConteoDN({ personal, asumes, cambios, permisos, extras, diasDelMes, mes, ano, estamento }) {
  const thresholds = React.useMemo(() => getConteoThresholds(estamento), [estamento]);

  const conteos = React.useMemo(() => {
    const porDia = [];
    for (let i = 1; i <= diasDelMes; i++) {
      let countD = 0;
      let countN = 0;
      for (const p of personal) {
        const v = getValorParaConteo(p, i, mes, ano, personal, asumes, cambios, permisos, extras);
        if (v === "D") countD++;
        else if (v === "N") countN++;
      }
      porDia.push({ d: i, countD, countN });
    }
    return porDia;
  }, [personal, asumes, cambios, permisos, extras, diasDelMes, mes, ano]);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-neutral-200/55">
      <table className="notranslate w-full table-fixed border-collapse" translate="no">
        <colgroup>
          <col style={{ width: "5.5rem" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            <th className="sticky left-0 z-20 bg-gray-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              Turno
            </th>
            {Array.from({ length: diasDelMes }, (_, i) => {
              const d = i + 1;
              const esEspecial = esFinDeSemanaOFeriado(d, mes, ano);
              return (
                <th
                  key={d}
                  className={`px-0.5 py-1.5 text-center text-[11px] font-semibold tabular-nums leading-none text-neutral-700 ${esEspecial ? "bg-orange-200" : ""}`}
                >
                  {d}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="sticky left-0 z-10 bg-gray-50/90 px-2 py-1.5 text-xs font-medium text-neutral-800">Día</td>
            {conteos.map(({ d, countD }) => (
              <td
                key={d}
                className={`px-0.5 py-1.5 text-center text-xs font-semibold tabular-nums leading-none ${getColorConteo(countD, thresholds)}`}
              >
                {countD}
              </td>
            ))}
          </tr>
          <tr>
            <td className="sticky left-0 z-10 bg-gray-50/90 px-2 py-1.5 text-xs font-medium text-neutral-800">Noche</td>
            {conteos.map(({ d, countN }) => (
              <td
                key={d}
                className={`px-0.5 py-1.5 text-center text-xs font-semibold tabular-nums leading-none ${getColorConteo(countN, thresholds)}`}
              >
                {countN}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="border-t border-gray-100 px-2 py-2 text-xs text-neutral-500">
        {thresholds.legend}
      </p>
    </div>
  );
}

const letraTurnoFila = (row) => {
  const raw = String(row?.turno || "A").toUpperCase();
  return raw.match(/[ABCD]/)?.[0] ?? "A";
};

/**
 * Inserta una fila en blanco al cambiar de grupo de turno base (A/B/C/D) y una cabecera antes del bloque de suplencias.
 */
const buildFilasTablaRotacion = (rows) => {
  const items = [];
  let prevLetraTitular = null;
  let encabezadoSuplenciasPuesto = false;

  for (const row of rows || []) {
    const esSuplencia = String(row.calidad_juridica || "").toLowerCase() === "suplencia";
    if (esSuplencia) {
      if (!encabezadoSuplenciasPuesto) {
        items.push({ kind: "suplenciaHeader", key: "cabecera-suplencias" });
        encabezadoSuplenciasPuesto = true;
      }
      items.push({ kind: "persona", key: `p-${row.id}`, row });
      continue;
    }
    encabezadoSuplenciasPuesto = false;
    const letra = letraTurnoFila(row);
    if (prevLetraTitular !== null && letra !== prevLetraTitular) {
      items.push({ kind: "spacerTurno", key: `esp-${prevLetraTitular}-${letra}-${row.id}` });
    }
    prevLetraTitular = letra;
    items.push({ kind: "persona", key: `p-${row.id}`, row });
  }
  return items;
};

function TablaRotacion({ personal, diasDelMes, mes, ano, tituloColumna, getNombreCell, salidas = [], asumes = [], cambios = [], permisos = [], extras = [], onSelectionComplete }) {
  const [selectedRange, setSelectedRange] = React.useState(null);
  const [dragSelection, setDragSelection] = React.useState(null);

  const handlePointerStart = React.useCallback((row, day) => {
    setDragSelection({
      rowId: row.id,
      rowLabel: [row.nombre, row.apellidos].filter(Boolean).join(" ") || "—",
      startDay: day,
      currentDay: day,
    });
  }, []);

  const handlePointerEnter = React.useCallback((rowId, day) => {
    setDragSelection((prev) => {
      if (!prev || prev.rowId !== rowId) return prev;
      if (prev.currentDay === day) return prev;
      return { ...prev, currentDay: day };
    });
  }, []);

  const finalizeSelection = React.useCallback(() => {
    setDragSelection((prev) => {
      if (!prev) return null;
      const startDay = Math.min(prev.startDay, prev.currentDay);
      const endDay = Math.max(prev.startDay, prev.currentDay);
      const nextSelection = { rowId: prev.rowId, rowLabel: prev.rowLabel, startDay, endDay, modoDiurno: false };
      setSelectedRange(nextSelection);
      onSelectionComplete?.(nextSelection);
      return null;
    });
  }, [onSelectionComplete]);

  const isCellSelected = React.useCallback((rowId, day) => {
    const activeRange = dragSelection
      ? {
          rowId: dragSelection.rowId,
          startDay: Math.min(dragSelection.startDay, dragSelection.currentDay),
          endDay: Math.max(dragSelection.startDay, dragSelection.currentDay),
        }
      : selectedRange;
    if (!activeRange || activeRange.rowId !== rowId) return false;
    return day >= activeRange.startDay && day <= activeRange.endDay;
  }, [dragSelection, selectedRange]);

  const rangeLabel = React.useMemo(() => {
    const activeRange = dragSelection
      ? {
          rowLabel: dragSelection.rowLabel,
          startDay: Math.min(dragSelection.startDay, dragSelection.currentDay),
          endDay: Math.max(dragSelection.startDay, dragSelection.currentDay),
        }
      : selectedRange;
    if (!activeRange) return "Mantén el clic presionado y arrastra sobre las fechas del mismo funcionario para seleccionar un rango.";
    const startLabel = formatFechaSeleccion(activeRange.startDay, mes, ano);
    const endLabel = formatFechaSeleccion(activeRange.endDay, mes, ano);
    if (activeRange.startDay === activeRange.endDay) {
      return `${activeRange.rowLabel}: ${startLabel}`;
    }
    return `${activeRange.rowLabel}: ${startLabel} al ${endLabel}`;
  }, [dragSelection, selectedRange, mes, ano]);

  return (
    <div
      className="w-full min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-neutral-200/55"
      onPointerUp={finalizeSelection}
      onPointerLeave={finalizeSelection}
    >
      <table className="notranslate w-full table-fixed border-collapse" translate="no">
        <colgroup>
          <col style={{ width: "11rem" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            <th className="sticky left-0 z-20 bg-gray-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
              {tituloColumna}
            </th>
            {Array.from({ length: diasDelMes }, (_, i) => {
              const d = i + 1;
              const esEspecial = esFinDeSemanaOFeriado(d, mes, ano);
              return (
                <th
                  key={d}
                  className={`px-0.5 py-1.5 text-center text-[11px] font-semibold tabular-nums leading-none text-neutral-700 ${esEspecial ? "bg-orange-200" : ""}`}
                >
                  {d}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
            {personal.length === 0 ? (
              <tr>
                <td colSpan={diasDelMes + 1} className="px-3 py-4 text-center text-xs text-neutral-400">
                  No hay personal registrado
                </td>
              </tr>
            ) : (
              buildFilasTablaRotacion(personal).map((item) => {
                if (item.kind === "spacerTurno") {
                  return (
                    <tr key={item.key} aria-hidden="true" className="pointer-events-none">
                      <td colSpan={diasDelMes + 1} className="h-2.5 border-y border-neutral-100 bg-neutral-50/60 p-0" />
                    </tr>
                  );
                }
                if (item.kind === "suplenciaHeader") {
                  return (
                    <tr key={item.key} className="pointer-events-none">
                      <td className="sticky left-0 z-10 border-y border-neutral-200 bg-neutral-100 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] sm:text-[11px]">
                        Suplencias
                      </td>
                      {Array.from({ length: diasDelMes }, (_, i) => (
                        <td key={i + 1} className="border-y border-neutral-200 bg-neutral-50/80 p-0" aria-hidden />
                      ))}
                    </tr>
                  );
                }
                const row = item.row;
                const bgColor = getColorFila(row);
                return (
                  <tr key={item.key} className="group transition-colors hover:bg-gray-50/30">
                    <td
                      className={`sticky left-0 z-10 px-2 py-1 text-left text-[10px] font-medium leading-snug text-neutral-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] sm:text-[11px] ${bgColor}`}
                    >
                      <span className="line-clamp-2">{getNombreCell(row)}</span>
                    </td>
                    {Array.from({ length: diasDelMes }, (_, i) => {
                      const d = i + 1;
                      const esEspecial = esFinDeSemanaOFeriado(d, mes, ano);
                      let valor;
                      let cellBg = esEspecial ? "bg-orange-200" : "bg-white";
                      let cellTitle = null;
                      let asumeMotivo = null;
                      const cambioTurno = cambios.find(
                        (c) => (c.motivo === "cambio_turno" || c.motivo === "inversion") &&
                          (diaCoincideConCambio(d, mes, ano, c.fecha_cambio) || (c.fecha_que_cubre_trabajara && diaCoincideConCambio(d, mes, ano, c.fecha_que_cubre_trabajara))) &&
                          (String(c.quien_solicita_id) === String(row.id) || String(c.quien_cubre_id) === String(row.id))
                      );
                      const permisoExtra = !cambioTurno ? getPermisoExtraDelDia(row.id, d, mes, ano, permisos, extras) : null;
                      const esCubreCapRow = (c) =>
                        String(c.quien_cubre_id) === String(row.id) || (c.quienes_cubren_ids || []).some((cid) => String(cid) === String(row.id));
                      const cambioCapacitacion = !cambioTurno && !permisoExtra && cambios.find(
                        (c) => (c.motivo || "").toLowerCase() === "capacitacion" &&
                          diaEnRangoCambio(d, mes, ano, c.fecha_cambio, c.fecha_que_cubre_trabajara) &&
                          (String(c.quien_solicita_id) === String(row.id) || esCubreCapRow(c))
                      );
                      const cambioCumpleanos = !cambioTurno && !permisoExtra && !cambioCapacitacion && cambios.find(
                        (c) => (c.motivo || "").toLowerCase() === "permiso_cumpleanos" &&
                          diaCoincideConCambio(d, mes, ano, c.fecha_cambio) &&
                          (String(c.quien_solicita_id) === String(row.id) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(row.id)))
                      );
                      const cambioConsiliacion = !cambioTurno && !permisoExtra && !cambioCapacitacion && !cambioCumpleanos && cambios.find(
                        (c) => (c.motivo || "").toLowerCase() === "consilacion_familiar" &&
                          diaCoincideConCambio(d, mes, ano, c.fecha_cambio) &&
                          (String(c.quien_solicita_id) === String(row.id) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(row.id)))
                      );
                      const interCubreExtras =
                        !cambioTurno && !permisoExtra
                          ? cubridorLibreEntreExtrasEnRangoAsume(row, d, mes, ano, personal, asumes, salidas, permisos, extras)
                          : null;
                      /** Ausencia por asume (titular): debe pintar TODO el rango fecha_inicio–fecha_fin igual, sin cortar por días con TE/PA en cambios. */
                      const asumeTitularHoy =
                        asumes.length > 0
                          ? asumes.find(
                              (a) =>
                                String(a.titular_id) === String(row.id) &&
                                diaEnRangoAsume(d, mes, ano, a.fecha_inicio, a.fecha_fin)
                            )
                          : null;
                      const salidaTitularHoy =
                        salidas.length > 0
                          ? salidas.find(
                              (salida) =>
                                String(salida.solicitante_id) === String(row.id) &&
                                diaEnRangoAsume(d, mes, ano, salida.fecha_inicio, salida.fecha_fin)
                            )
                          : null;
                      if (cambioTurno) {
                        const esInversion = cambioTurno.motivo === "inversion";
                        const colorSwap = esInversion ? COLOR_INVERSION : COLOR_CAMBIO_TURNO;
                        const etiqueta = esInversion ? "Inversión" : "Cambio turno";
                        const esMismoDiaInv = esInversion && cambioTurno.fecha_que_cubre_trabajara && turnosIguales(cambioTurno.fecha_cambio, cambioTurno.fecha_que_cubre_trabajara);
                        const cubre = personal.find((p) => p.id === cambioTurno.quien_cubre_id) || cambioTurno.quien_cubre;
                        const solicitante = personal.find((p) => p.id === cambioTurno.quien_solicita_id) || cambioTurno.quien_solicita;
                        const turnoCambio = cambioTurno.turno_cambio || "—";
                        const turnoDevuelve = cambioTurno.turno_devuelve || "—";
                        const nombreCubre = cubre ? [cubre.nombre, cubre.apellidos].filter(Boolean).join(" ") : "—";
                        const nombreSolicita = solicitante ? [solicitante.nombre, solicitante.apellidos].filter(Boolean).join(" ") : "—";
                        if (diaCoincideConCambio(d, mes, ano, cambioTurno.fecha_cambio)) {
                          if (String(cambioTurno.quien_solicita_id) === String(row.id)) {
                            if (esInversion && esMismoDiaInv) {
                              valor = turnoDevuelve;
                              cellTitle = `${etiqueta} - Recibe ${turnoDevuelve} de ${nombreCubre}`;
                            } else {
                              valor = "L";
                              cellTitle = `${etiqueta} - Libre (cubre ${nombreCubre} con ${turnoCambio})`;
                            }
                            cellBg = colorSwap;
                          } else {
                            valor = turnoCambio;
                            cellTitle = `${etiqueta} - Cubre a ${nombreSolicita} con ${turnoCambio}`;
                            cellBg = colorSwap;
                          }
                        } else if (cambioTurno.fecha_que_cubre_trabajara && diaCoincideConCambio(d, mes, ano, cambioTurno.fecha_que_cubre_trabajara)) {
                          if (String(cambioTurno.quien_cubre_id) === String(row.id)) {
                            valor = "L";
                            cellBg = colorSwap;
                            cellTitle = `${etiqueta} - Libre (devuelve ${turnoDevuelve} a ${nombreSolicita})`;
                          } else {
                            valor = turnoDevuelve;
                            cellBg = colorSwap;
                            cellTitle = `${etiqueta} - Recibe ${turnoDevuelve} de ${nombreCubre}`;
                          }
                        }
                      } else if (asumeTitularHoy) {
                        asumeMotivo = asumeTitularHoy.motivo;
                        const titularP = personal.find((p) => String(p.id) === String(row.id));
                        const tCiclo = getTurnoDelDia(d, mes, ano, titularP?.turno);
                        valor =
                          CELDA_CORTA_AUSENCIA[asumeTitularHoy.motivo] ??
                          String(asumeTitularHoy.motivo || "")
                            .slice(0, 3)
                            .toUpperCase();
                        const suplencia = personal.find((p) => String(p.id) === String(asumeTitularHoy.suplencia_id));
                        const nombreSuplencia = suplencia ? [suplencia.nombre, suplencia.apellidos].filter(Boolean).join(" ") : "—";
                        const motivoTxt =
                          MOTIVO_ASUME_CORTO[asumeTitularHoy.motivo] ??
                          String(asumeTitularHoy.motivo || "").replace(/_/g, " ");
                        const rangoAusencia = `Del ${formatFechaCortaCal(asumeTitularHoy.fecha_inicio)} al ${formatFechaCortaCal(asumeTitularHoy.fecha_fin)}`;
                        let baseTitle =
                          `${rangoAusencia} — Ausente (${motivoTxt}) — cubre ${nombreSuplencia}. Ciclo este día: ${tCiclo || "—"}.`;
                        const permisoTitularHoy = (permisos || []).find(
                          (permiso) => String(permiso.quien_solicita_id) === String(row.id) && diaCoincideConCambio(d, mes, ano, permiso.fecha_permiso),
                        );
                        const teHoyTitular = permisoTitularHoy
                          ? (extras || []).find((item) => String(item.permiso_id) === String(permisoTitularHoy.id) && diaCoincideConCambio(d, mes, ano, item.fecha_extra_dia))
                          : null;
                        if (teHoyTitular) {
                          const cubreTe = teHoyTitular.quien_cubre_id
                            ? personal.find((p) => String(p.id) === String(teHoyTitular.quien_cubre_id))
                            : null;
                          const nombreCubreTe = cubreTe ? [cubreTe.nombre, cubreTe.apellidos].filter(Boolean).join(" ") : "—";
                          baseTitle += ` · Registro turno extra: ${teHoyTitular.turno_extra === "N" ? "NE" : "DE"} — quien cubre ${nombreCubreTe}.`;
                        }
                        cellTitle = baseTitle;
                        cellBg =
                          COLOR_POR_MOTIVO[asumeMotivo] ?? (esEspecial ? "bg-orange-200" : "bg-white");
                      } else if (salidaTitularHoy) {
                        valor =
                          CELDA_CORTA_AUSENCIA[salidaTitularHoy.motivo] ??
                          String(salidaTitularHoy.motivo || "")
                            .slice(0, 3)
                            .toUpperCase();
                        cellBg = COLOR_POR_MOTIVO[salidaTitularHoy.motivo] ?? (esEspecial ? "bg-orange-200" : "bg-white");
                        const extrasDelTitularHoy = (extras || []).filter((item) => {
                          if (!diaCoincideConCambio(d, mes, ano, item.fecha_extra_dia)) return false;
                          const permiso = (permisos || []).find((permisoItem) => String(permisoItem.id) === String(item.permiso_id));
                          return String(permiso?.quien_solicita_id) === String(row.id);
                        });
                        const descripcionExtras = extrasDelTitularHoy.length
                          ? extrasDelTitularHoy.map((item) => {
                              const cubridor = personal.find((p) => String(p.id) === String(item.quien_cubre_id)) || item.quien_cubre;
                              const nombre = cubridor ? [cubridor.nombre, cubridor.apellidos].filter(Boolean).join(" ") : "—";
                              return `${nombre} (${item.turno_extra || "—"})`;
                            }).join(", ")
                          : "sin extras ese día";
                        cellTitle = `Del ${formatFechaCortaCal(salidaTitularHoy.fecha_inicio)} al ${formatFechaCortaCal(salidaTitularHoy.fecha_fin)} — Ausente (${String(salidaTitularHoy.motivo || "").replace(/_/g, " ")}). Cobertura del día: ${descripcionExtras}.`;
                      } else if (permisoExtra) {
                        const { permiso, extra, extras: extrasRelacionados = [] } = permisoExtra;
                        const cubre = personal.find((p) => String(p.id) === String(extra.quien_cubre_id)) || extra.quien_cubre;
                        const solicita = personal.find((p) => String(p.id) === String(permiso.quien_solicita_id)) || permiso.quien_solicita;
                        const nombreCubre = cubre ? [cubre.nombre, cubre.apellidos].filter(Boolean).join(" ") : "—";
                        const nombreSolicita = solicita ? [solicita.nombre, solicita.apellidos].filter(Boolean).join(" ") : "—";
                        const motivoSolicitante =
                          CELDA_CORTA_PERMISO_EXTRA[permiso.motivo] ??
                          String(permiso.motivo || "")
                            .slice(0, 3)
                            .toUpperCase();
                        const descripcionExtras = extrasRelacionados.length
                          ? extrasRelacionados.map((item) => {
                              const cubridor = personal.find((p) => String(p.id) === String(item.quien_cubre_id)) || item.quien_cubre;
                              const nombre = cubridor ? [cubridor.nombre, cubridor.apellidos].filter(Boolean).join(" ") : "—";
                              return `${nombre} (${item.turno_extra || "—"})`;
                            }).join(", ")
                          : nombreCubre;
                        const esAutoExtra = String(permiso.quien_solicita_id) === String(row.id) && String(extra.quien_cubre_id) === String(row.id);
                        if (esAutoExtra) {
                          valor = extra.turno_extra === "N" ? "NE" : "DE";
                          cellBg = extra.turno_extra === "N" ? COLOR_TURNO_EXTRA_N : COLOR_TURNO_EXTRA_D;
                          const horaInicio = String(extra?.fecha_extra?.hora_inicio || "").trim();
                          const horaFin = String(extra?.fecha_extra?.hora_fin || "").trim();
                          const rangoHora = horaInicio && horaFin ? ` Horario: ${horaInicio} a ${horaFin}.` : "";
                          cellTitle = `Turno extra en día libre (${extra.turno_extra === "N" ? "noche" : "día"}).${rangoHora}`;
                        } else if (String(permiso.quien_solicita_id) === String(row.id)) {
                          valor = motivoSolicitante || "PA";
                          cellBg = COLOR_PA;
                          cellTitle = `Motivo: ${String(permiso.motivo || "").replace(/_/g, " ")} - Cubren ${descripcionExtras}`;
                        } else if (String(extra.quien_cubre_id) === String(row.id)) {
                          valor = extra.turno_extra === "N" ? "NE" : "DE";
                          cellBg = extra.turno_extra === "N" ? COLOR_TURNO_EXTRA_N : COLOR_TURNO_EXTRA_D;
                          const horaInicio = String(extra?.fecha_extra?.hora_inicio || "").trim();
                          const horaFin = String(extra?.fecha_extra?.hora_fin || "").trim();
                          const rangoHora = horaInicio && horaFin ? ` Horario: ${horaInicio} a ${horaFin}.` : "";
                          cellTitle = `Turno extra — Cubre a ${nombreSolicita} (${extra.turno_extra === "N" ? "noche" : "día"}).${rangoHora} Coberturas del día: ${descripcionExtras}`;
                        }
                      } else if (interCubreExtras) {
                        valor = "-";
                        asumeMotivo = interCubreExtras.motivoKey;
                        cellBg =
                          COLOR_POR_MOTIVO[interCubreExtras.motivoKey] ||
                          (esEspecial ? "bg-orange-200" : "bg-white");
                        cellTitle = interCubreExtras.cellTitle;
                      } else if (cambioCapacitacion) {
                        if (cambioCapacitacion.quien_solicita_id === row.id) {
                          valor = "Cap";
                          cellBg = COLOR_CAPACITACION;
                          const cubres = [
                            cambioCapacitacion.quien_cubre_id,
                            ...(cambioCapacitacion.quienes_cubren_ids || []),
                          ].filter(Boolean);
                          const nombres = cubres.map((cid) => {
                            const p = personal.find((x) => String(x.id) === String(cid));
                            return p ? [p.nombre, p.apellidos].filter(Boolean).join(" ") : null;
                          }).filter(Boolean);
                          cellTitle = nombres.length ? `Capacitación - Cubren ${nombres.join(", ")}` : `Capacitación`;
                        } else if (esCubreCapRow(cambioCapacitacion)) {
                          const solicita = personal.find((p) => p.id === cambioCapacitacion.quien_solicita_id) || cambioCapacitacion.quien_solicita;
                          valor = getTurnoEfectivoDelDia(cambioCapacitacion.quien_solicita_id, d, mes, ano, personal, asumes) || "—";
                          cellBg = COLOR_CAPACITACION;
                          const nombreSolicita = solicita ? [solicita.nombre, solicita.apellidos].filter(Boolean).join(" ") : "—";
                          cellTitle = `Cubre a ${nombreSolicita} - ${valor === "D" ? "Día" : valor === "N" ? "Noche" : ""}`;
                        }
                      } else if (cambioCumpleanos) {
                        if (cambioCumpleanos.quien_solicita_id === row.id) {
                          valor = "PC";
                          cellBg = COLOR_CUMPLEANOS;
                          const cubre = cambioCumpleanos.quien_cubre_id ? personal.find((p) => p.id === cambioCumpleanos.quien_cubre_id) : null;
                          cellTitle = cubre ? `Permiso Cumpleaños - Cubre ${[cubre.nombre, cubre.apellidos].filter(Boolean).join(" ")}` : `Permiso Cumpleaños`;
                        } else if (cambioCumpleanos.quien_cubre_id === row.id) {
                          const solicita = personal.find((p) => p.id === cambioCumpleanos.quien_solicita_id) || cambioCumpleanos.quien_solicita;
                          valor = getTurnoEfectivoDelDia(cambioCumpleanos.quien_solicita_id, d, mes, ano, personal, asumes) || "—";
                          cellBg = COLOR_CUMPLEANOS;
                          const nombreSolicita = solicita ? [solicita.nombre, solicita.apellidos].filter(Boolean).join(" ") : "—";
                          cellTitle = `Cubre a ${nombreSolicita} - ${valor === "D" ? "Día" : valor === "N" ? "Noche" : ""}`;
                        }
                      } else if (cambioConsiliacion) {
                        if (cambioConsiliacion.quien_solicita_id === row.id) {
                          valor = "CF";
                          cellBg = COLOR_CONSILIACION;
                          const cubre = cambioConsiliacion.quien_cubre_id ? personal.find((p) => p.id === cambioConsiliacion.quien_cubre_id) : null;
                          cellTitle = cubre ? `Consiliación Familiar - Cubre ${[cubre.nombre, cubre.apellidos].filter(Boolean).join(" ")}` : `Consiliación Familiar`;
                        } else if (cambioConsiliacion.quien_cubre_id === row.id) {
                          const solicita = personal.find((p) => p.id === cambioConsiliacion.quien_solicita_id) || cambioConsiliacion.quien_solicita;
                          valor = getTurnoEfectivoDelDia(cambioConsiliacion.quien_solicita_id, d, mes, ano, personal, asumes) || "—";
                          cellBg = COLOR_CONSILIACION;
                          const nombreSolicita = solicita ? [solicita.nombre, solicita.apellidos].filter(Boolean).join(" ") : "—";
                          cellTitle = `Cubre a ${nombreSolicita} - ${valor === "D" ? "Día" : valor === "N" ? "Noche" : ""}`;
                        }
                      } else if (asumes.length > 0) {
                        const asumeSuplencia = asumes.find(
                          (a) => String(a.suplencia_id) === String(row.id) && diaEnRangoAsume(d, mes, ano, a.fecha_inicio, a.fecha_fin)
                        );
                        if (asumeSuplencia) {
                          const titular = personal.find((p) => String(p.id) === String(asumeSuplencia.titular_id));
                          const tRaw = getTurnoEfectivoDelDia(asumeSuplencia.titular_id, d, mes, ano, personal, asumes);
                          asumeMotivo = asumeSuplencia.motivo;
                          valor = tRaw || "-";
                          const nombreTitular = titular ? [titular.nombre, titular.apellidos].filter(Boolean).join(" ") : "—";
                          const letraTurno = (titular?.turno || "").toString().toUpperCase().slice(0, 1) || "—";
                          const rangoAsume = `Del ${formatFechaCortaCal(asumeSuplencia.fecha_inicio)} al ${formatFechaCortaCal(asumeSuplencia.fecha_fin)}`;
                          cellTitle =
                            tRaw
                              ? `${rangoAsume} — Suple a ${nombreTitular} (turno titular ${letraTurno}, este día: ${tRaw} en ciclo)`
                              : `${rangoAsume} — Suple a ${nombreTitular} (este día: sin turno en ciclo, se muestra −)`;
                        } else {
                          const cj = (row.calidad_juridica || "").toLowerCase();
                          valor = cj === "suplencia" ? "—" : getTurnoDelDia(d, mes, ano, row.turno);
                        }
                        if (asumeMotivo && COLOR_POR_MOTIVO[asumeMotivo]) {
                          cellBg = COLOR_POR_MOTIVO[asumeMotivo];
                        } else if (esEspecial) {
                          cellBg = "bg-orange-200";
                        }
                      } else {
                        const cj = (row.calidad_juridica || "").toLowerCase();
                        valor = cj === "suplencia" ? "—" : getTurnoDelDia(d, mes, ano, row.turno);
                      }
                      const selected = isCellSelected(row.id, d);
                      const selectedCellClassName = selected ? "shadow-[inset_0_0_0_2px_rgba(10,132,255,0.55)]" : "";
                      const selectedTextClassName = selected ? "font-semibold" : "";
                      const buttonClassName = `flex min-h-5 w-full cursor-pointer items-center justify-center rounded-[6px] px-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/35 focus-visible:ring-offset-0 ${selectedTextClassName}`;
                      const button = (
                        <button
                          type="button"
                          onPointerDown={() => handlePointerStart(row, d)}
                          onPointerEnter={() => handlePointerEnter(row.id, d)}
                          aria-pressed={selected}
                          className={buttonClassName}
                        >
                          {valor}
                        </button>
                      );
                      const cellContent = (
                        <td
                          key={d}
                          className={`border-l border-gray-100/80 px-0.5 py-1 text-center text-[11px] font-medium tabular-nums leading-none sm:text-xs ${cellBg} ${selectedCellClassName} ${cellBg === COLOR_CAPACITACION || cellBg === COLOR_CUMPLEANOS || cellBg === COLOR_CONSILIACION || cellBg === COLOR_TURNO_EXTRA_D || cellBg === COLOR_TURNO_EXTRA_N ? "text-white" : "text-neutral-700"}`}
                          style={selected ? { backgroundColor: "rgba(0, 122, 255, 0.18)" } : undefined}
                        >
                          {cellTitle ? (
                            <Tooltip content={cellTitle} delay={300} closeDelay={0}>
                              {button}
                            </Tooltip>
                          ) : (
                            button
                          )}
                        </td>
                      );
                      return cellContent;
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="border-t border-gray-100 bg-neutral-50/75 px-3 py-2 text-[11px] font-medium text-neutral-600 sm:text-xs">
          {rangeLabel}
        </div>
      </div>
  );
}
