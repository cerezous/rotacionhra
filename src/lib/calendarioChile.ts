/**
 * Referencia de feriados legales Chile (fechas fijas habituales + Viernes Santo)
 * y utilidades para jornada diurna por defecto (lunes–viernes, descanso fines y feriados).
 * Las fechas fijas siguen el calendario típico de feriados irrenunciables; los “puentes”
 * no se modelan aquí.
 */

export type InfoDiaChile = {
  /** Día hábil según regla diurna por defecto (L–V que no sea feriado). */
  esLaboralDiurno: boolean;
  esFinDeSemana: boolean;
  esFeriado: boolean;
  nombreFeriado?: string;
};

const FERIADOS_FIJOS: { mes: number; dia: number; nombre: string }[] = [
  { mes: 1, dia: 1, nombre: "Año Nuevo" },
  { mes: 5, dia: 1, nombre: "Día del Trabajador" },
  { mes: 5, dia: 21, nombre: "Glorias Navales" },
  { mes: 6, dia: 29, nombre: "San Pedro y San Pablo" },
  { mes: 7, dia: 16, nombre: "Virgen del Carmen" },
  { mes: 8, dia: 15, nombre: "Asunción de la Virgen" },
  { mes: 9, dia: 18, nombre: "Independencia Nacional" },
  { mes: 9, dia: 19, nombre: "Día de las Glorias del Ejército" },
  { mes: 10, dia: 12, nombre: "Encuentro de Dos Mundos" },
  { mes: 10, dia: 31, nombre: "Día de las Iglesias Evangélicas y Protestantes" },
  { mes: 11, dia: 1, nombre: "Día de Todos los Santos" },
  { mes: 12, dia: 8, nombre: "Inmaculada Concepción" },
  { mes: 12, dia: 25, nombre: "Navidad" },
];

/** Domingo de Pascua (algoritmo Meeus/Jones/Butcher, calendario gregoriano). */
export function getDomingoPascua(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes: month, dia: day };
}

function addDaysYMD(ano: number, mes: number, dia: number, delta: number): { ano: number; mes: number; dia: number } {
  const t = new Date(ano, mes - 1, dia + delta);
  return { ano: t.getFullYear(), mes: t.getMonth() + 1, dia: t.getDate() };
}

export function getViernesSanto(ano: number): { mes: number; dia: number } {
  const p = getDomingoPascua(ano);
  return addDaysYMD(ano, p.mes, p.dia, -2);
}

function toNumMes(mes: string | number): number {
  return typeof mes === "number" ? mes : parseInt(String(mes), 10);
}

function toNumAno(ano: string | number): number {
  return typeof ano === "number" ? ano : parseInt(String(ano), 10);
}

export function getNombreFeriadoChile(dia: number, mes: string | number, ano: string | number): string | null {
  const m = toNumMes(mes);
  const y = toNumAno(ano);
  const fijo = FERIADOS_FIJOS.find((f) => f.mes === m && f.dia === dia);
  if (fijo) return fijo.nombre;
  const vs = getViernesSanto(y);
  if (vs.mes === m && vs.dia === dia) return "Viernes Santo";
  return null;
}

export function esFeriadoChile(dia: number, mes: string | number, ano: string | number): boolean {
  return getNombreFeriadoChile(dia, mes, ano) != null;
}

export function esFinDeSemana(dia: number, mes: string | number, ano: string | number): boolean {
  const m = toNumMes(mes);
  const y = toNumAno(ano);
  const fecha = new Date(y, m - 1, dia);
  const ds = fecha.getDay();
  return ds === 0 || ds === 6;
}

/** Sábado, domingo o feriado legal (incluye Viernes Santo). */
export function esFinDeSemanaOFeriado(dia: number, mes: string | number, ano: string | number): boolean {
  return esFinDeSemana(dia, mes, ano) || esFeriadoChile(dia, mes, ano);
}

/**
 * Día laboral para esquema diurno por defecto: lunes a viernes que no sea feriado.
 * Misma regla que antes en `esLunesAViernes` / `esLunesAViernesLaborable`.
 */
export function esDiaLaboralDiurnoChile(dia: number, mes: string | number, ano: string | number): boolean {
  const m = toNumMes(mes);
  const y = toNumAno(ano);
  const fecha = new Date(y, m - 1, dia);
  const diaSemana = fecha.getDay();
  if (diaSemana < 1 || diaSemana > 5) return false;
  return !esFeriadoChile(dia, mes, ano);
}

export function getInfoDiaChile(dia: number, mes: string | number, ano: string | number): InfoDiaChile {
  const nombre = getNombreFeriadoChile(dia, mes, ano);
  const feriado = nombre != null;
  const finDe = esFinDeSemana(dia, mes, ano);
  const laboral = esDiaLaboralDiurnoChile(dia, mes, ano);
  return {
    esLaboralDiurno: laboral,
    esFinDeSemana: finDe,
    esFeriado: feriado,
    nombreFeriado: nombre || undefined,
  };
}

