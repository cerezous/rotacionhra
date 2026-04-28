/**
 * Reglas para listar fechas y candidatos al cubrir con PA, alineadas con la lógica de rotación (TablaRotacion).
 */
import type { DateValue } from "@internationalized/date";
import { esFuncionarioDiurno } from "./utils";
import { esDiaLaboralDiurnoChile } from "./calendarioChile";

/** Convierte un `DateValue` del calendario a `YYYY-MM-DD`. */
export function dateValueToYMD(d: DateValue): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

const OFFSET_POR_TURNO: Record<string, number> = { A: 0, B: 2, C: 3, D: 1 };
const CICLO = ["D", "N", "L", "L"];

export const getTurnoDelDia = (dia: number, mes: number, ano: number, turno: string | null | undefined) => {
  const raw = (turno || "").toString().toUpperCase();
  const t = raw.match(/[ABCD]/)?.[0] ?? raw.slice(0, 1);
  const offset = OFFSET_POR_TURNO[t];
  if (offset === undefined) return "—";
  const fecha = new Date(ano, mes - 1, dia);
  const mar1 = new Date(ano, 2, 1);
  const diffMs = fecha.getTime() - mar1.getTime();
  const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const idx = ((diffDias + offset) % 4 + 4) % 4;
  return CICLO[idx];
};

export const diaEnRangoAsume = (
  dia: number,
  mes: number,
  ano: number,
  fechaInicio: string | null | undefined,
  fechaFin: string | null | undefined
) => {
  if (!fechaInicio || !fechaFin) return false;
  const y = ano;
  const m = mes;
  const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const ini = String(fechaInicio).slice(0, 10);
  const fin = String(fechaFin).slice(0, 10);
  return ini && fin && dStr >= ini && dStr <= fin;
};

export const getTurnoEfectivoDelDia = (
  personaId: string,
  dia: number,
  mes: number,
  ano: number,
  personal: { id: string; calidad_juridica?: string | null; turno?: string | null }[],
  asumes: { suplencia_id: string; titular_id: string; fecha_inicio: string; fecha_fin: string }[]
) => {
  const persona = personal.find((p) => String(p.id) === String(personaId));
  if (!persona) return null;
  const calidadJuridica = (persona.calidad_juridica || "").toLowerCase();
  if (calidadJuridica === "suplencia" && asumes?.length) {
    const asume = asumes.find(
      (a) => String(a.suplencia_id) === String(personaId) && diaEnRangoAsume(dia, mes, ano, a.fecha_inicio, a.fecha_fin)
    );
    if (asume) {
      const titular = personal.find((p) => String(p.id) === String(asume.titular_id));
      const v = getTurnoDelDia(dia, mes, ano, titular?.turno);
      return v === "D" || v === "N" ? v : null;
    }
  }
  const v = getTurnoDelDia(dia, mes, ano, persona.turno);
  return v === "D" || v === "N" ? v : null;
};

/** Lunes a viernes laborable (excluye feriados Chile), misma regla que la grilla de funcionarios diurnos. */
export const esLunesAViernesLaborable = (dia: number, mes: number, ano: number) =>
  esDiaLaboralDiurnoChile(dia, mes, ano);

export const splitFechaISO = (fechaStr: string) => {
  const [y, m, d] = String(fechaStr).slice(0, 10).split("-").map(Number);
  return { ano: y, mes: m, dia: d };
};

/** El titular/contrata que sale tiene turno D/N (4to) o día laboral diurno ese día. */
export function titularTieneTurnoDnOdiurnoEseDia(
  titular: { turno?: string | null; funcionario_diurno?: string | null },
  fechaStr: string
): boolean {
  const { ano, mes, dia } = splitFechaISO(fechaStr);
  if (esFuncionarioDiurno(titular)) {
    return esLunesAViernesLaborable(dia, mes, ano);
  }
  const t = getTurnoDelDia(dia, mes, ano, titular.turno);
  return t === "D" || t === "N";
}

const diaCoincideConCambio = (dia: number, mes: number, ano: number, fechaCambio: string | null | undefined) => {
  if (!fechaCambio) return false;
  const [y, m, d] = String(fechaCambio).slice(0, 10).split("-").map(Number);
  return d === dia && m === mes && y === ano;
};

const diaEnRangoCambio = (dia: number, mes: number, ano: number, fechaDesde: string | null | undefined, fechaHasta: string | null | undefined) => {
  if (!fechaDesde) return false;
  const dStr = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const desde = String(fechaDesde).slice(0, 10);
  const hasta = String(fechaHasta || fechaDesde || "").slice(0, 10);
  return desde && hasta && dStr >= desde && dStr <= hasta;
};

export type CambioLike = {
  motivo?: string | null;
  quien_solicita_id?: string | null;
  fecha_cambio?: string | null;
  fecha_que_cubre_trabajara?: string | null;
};

export type AsumeTitularRango = {
  id?: string;
  titular_id: string;
  fecha_inicio: string;
  fecha_fin: string;
};

/**
 * Si el titular/contrata ya figura ausente ese día: asume donde es titular (opcionalmente excluye un registro al editar)
 * o cambios de permiso (PA, capacitación, etc.), misma lógica que la tabla de rotación.
 */
export function titularAusenteRegistradoEnFecha(
  titularId: string,
  fechaStr: string,
  asumes: AsumeTitularRango[],
  cambios: CambioLike[],
  excludeAsumeId?: string | null
): boolean {
  const { ano, mes, dia } = splitFechaISO(fechaStr);
  const pid = String(titularId);
  if (
    asumes.some((a) => {
      if (String(a.titular_id) !== pid) return false;
      if (excludeAsumeId != null && String(a.id ?? "") === String(excludeAsumeId)) return false;
      return diaEnRangoAsume(dia, mes, ano, a.fecha_inicio, a.fecha_fin);
    })
  ) {
    return true;
  }
  for (const c of cambios || []) {
    const motivo = (c.motivo || "").toLowerCase();
    if (
      (motivo === "permiso_administrativo" || motivo === "turno_extra") &&
      String(c.quien_solicita_id) === pid &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio)
    ) {
      return true;
    }
    if (motivo === "capacitacion" && String(c.quien_solicita_id) === pid && diaEnRangoCambio(dia, mes, ano, c.fecha_cambio, c.fecha_que_cubre_trabajara)) {
      return true;
    }
    if (motivo === "permiso_cumpleanos" && String(c.quien_solicita_id) === pid && diaCoincideConCambio(dia, mes, ano, c.fecha_cambio)) {
      return true;
    }
    if (
      (motivo === "consilacion_familiar" || motivo === "consiliacion_familiar") &&
      String(c.quien_solicita_id) === pid &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio)
    ) {
      return true;
    }
    if (
      (motivo === "cambio_turno" || motivo === "inversion") &&
      String(c.quien_solicita_id) === pid &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio)
    ) {
      return true;
    }
  }
  return false;
}

/** Titular/contrata no disponible para cubrir: asume propio o permisos/cambios como solicitante. */
function titularContrataAusenteNoPuedeCubrir(
  personaId: string,
  dia: number,
  mes: number,
  ano: number,
  asumes: { titular_id: string; fecha_inicio: string; fecha_fin: string }[],
  cambios: CambioLike[]
): boolean {
  const dStr = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return titularAusenteRegistradoEnFecha(personaId, dStr, asumes, cambios, undefined);
}

export type PersonalLike = {
  id: string;
  calidad_juridica?: string | null;
  turno?: string | null;
  funcionario_diurno?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
};

export type AsumeLike = {
  suplencia_id: string;
  titular_id: string;
  fecha_inicio: string;
  fecha_fin: string;
};

/**
 * Quienes pueden cubrir el PA / turno extra ese día:
 * - Titulares/contratas del servicio (diurnos: solo día laborable), excluye al titular ausente y a quien ya figura ausente.
 * - Todas las suplencias del listado (activas en planta).
 * No se restringe a quienes tienen solo D/N ese día: se listan todos los candidatos viables en la fecha.
 */
export function candidatosCoberturaPaParaFecha(
  fechaStr: string,
  titularId: string,
  personal: PersonalLike[],
  asumes: AsumeLike[],
  cambios: CambioLike[]
): PersonalLike[] {
  const { ano, mes, dia } = splitFechaISO(fechaStr);
  const out: PersonalLike[] = [];

  for (const p of personal) {
    if (String(p.id) === String(titularId)) continue;
    const cj = (p.calidad_juridica || "").toLowerCase();

    if (cj === "suplencia") {
      out.push(p);
    } else if (cj === "titular" || cj === "contrata") {
      if (esFuncionarioDiurno(p)) {
        if (!esLunesAViernesLaborable(dia, mes, ano)) continue;
      }
      if (titularContrataAusenteNoPuedeCubrir(p.id, dia, mes, ano, asumes, cambios)) continue;
      out.push(p);
    }
  }

  return out.sort((a, b) => {
    const na = [a.nombre, a.apellidos].filter(Boolean).join(" ");
    const nb = [b.nombre, b.apellidos].filter(Boolean).join(" ");
    return na.localeCompare(nb, "es");
  });
}
