import React from "react";

const MESES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MOTIVO_LABELS = {
  cambio_turno: "Cambio de Turno",
  inversion: "Inversión",
  permiso_administrativo: "Permiso Administrativo",
  permiso_cumpleanos: "Permiso Cumpleaños",
  capacitacion: "Capacitación",
  consilacion_familiar: "Consiliación Familiar",
  otro: "Otro",
};

const OFFSET_POR_TURNO = { A: 0, B: 2, C: 3, D: 1 };
const CICLO = ["D", "N", "S", "L"];
const TURNO_COBERTURA = { A: "N", B: "N", C: "D", D: "D" };

const getTurnoDelDia = (dia, mes, ano, turno) => {
  const raw = (turno || "").toString().toUpperCase();
  const t = raw.match(/[ABCD]/)?.[0] ?? raw.slice(0, 1);
  const offset = OFFSET_POR_TURNO[t];
  if (offset === undefined) return null;
  const fecha = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
  const abr1 = new Date(parseInt(ano, 10), 3, 1);
  const diffDias = Math.floor((fecha.getTime() - abr1.getTime()) / (24 * 60 * 60 * 1000));
  const idx = ((diffDias + offset) % 4 + 4) % 4;
  return CICLO[idx];
};

/** D → "8 a 20", N → "20 a 8", otro → "" */
const turnoToHorarioLabel = (t) =>
  t === "D" ? "8 a 20" : t === "N" ? "20 a 8" : "";
const turnoToHorarioRango = (t) =>
  t === "D" ? "08:00-20:00" : t === "N" ? "20:00-08:00" : "";

const turnoToBounds = (t) => {
  if (t === "D") return { start: 8 * 60, end: 20 * 60 };
  if (t === "N") return { start: 20 * 60, end: 32 * 60 };
  return null;
};

const parseHHMMToShiftMinutes = (hhmm, turno) => {
  const match = String(hhmm || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (turno === "N") return total < 20 * 60 ? total + 24 * 60 : total;
  if (turno === "D") return total;
  return null;
};

const formatShiftMinutes = (value) => {
  const wrapped = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const mergeRanges = (ranges) => {
  const ordered = [...(ranges || [])]
    .filter((r) => Number.isFinite(r?.start) && Number.isFinite(r?.end) && r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (ordered.length === 0) return [];
  const merged = [ordered[0]];
  for (let i = 1; i < ordered.length; i += 1) {
    const curr = ordered[i];
    const last = merged[merged.length - 1];
    if (curr.start <= last.end) last.end = Math.max(last.end, curr.end);
    else merged.push({ ...curr });
  }
  return merged;
};

const subtractRange = (baseRanges, cut) => {
  if (!Number.isFinite(cut?.start) || !Number.isFinite(cut?.end) || cut.end <= cut.start) return baseRanges;
  const next = [];
  for (const r of baseRanges) {
    if (cut.end <= r.start || cut.start >= r.end) {
      next.push(r);
      continue;
    }
    if (cut.start > r.start) next.push({ start: r.start, end: Math.min(cut.start, r.end) });
    if (cut.end < r.end) next.push({ start: Math.max(cut.end, r.start), end: r.end });
  }
  return mergeRanges(next);
};

const rangesToLabel = (ranges) => {
  const merged = mergeRanges(ranges);
  if (!merged.length) return "";
  return merged.map((r) => `${formatShiftMinutes(r.start)}-${formatShiftMinutes(r.end)}`).join(", ");
};

const parseRangoParcialObservacion = (obs, turno) => {
  const m = String(obs || "").match(/Turno12h:\s*([0-2]\d:[0-5]\d)\s*-\s*([0-2]\d:[0-5]\d)/i);
  if (!m || !turno) return null;
  const start = parseHHMMToShiftMinutes(m[1], turno);
  const end = parseHHMMToShiftMinutes(m[2], turno);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const bounds = turnoToBounds(turno);
  if (!bounds || start < bounds.start || end > bounds.end) return null;
  return { start, end };
};

const diaEnRangoAsume = (dia, mes, ano, fechaInicio, fechaFin) => {
  const y = parseInt(ano, 10);
  const m = parseInt(mes, 10);
  const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const ini = String(fechaInicio || "").slice(0, 10);
  const fin = String(fechaFin || "").slice(0, 10);
  return ini && fin && dStr >= ini && dStr <= fin;
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

const getNombre = (p) => (p ? [p.nombre, p.apellidos].filter(Boolean).join(" ") : "—");

/** Normaliza motivo para comparar: minúsculas, espacios → _, ñ→n */
const normalizarMotivo = (m) =>
  (m || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/ñ/g, "n");

const motivoCoincide = (c, ...valores) => {
  const n = normalizarMotivo(c.motivo);
  return valores.some((v) => normalizarMotivo(v) === n);
};

/** Obtiene etiqueta legible del motivo aunque venga con espacios/acentos del backend */
const getMotivoLabel = (m) => {
  if (!m) return "Otro";
  const n = normalizarMotivo(m);
  const key = Object.keys(MOTIVO_LABELS).find((k) => normalizarMotivo(k) === n);
  return key ? MOTIVO_LABELS[key] : m;
};

const normalizeCambioCartola = (row) => ({
  ...row,
  quien_solicita_id: row?.quien_solicita_id ?? row?.solicitante_id ?? null,
  quien_cubre_id: row?.quien_cubre_id ?? row?.cubridor_id ?? null,
  quien_solicita: row?.quien_solicita ?? row?.solicitante ?? null,
  quien_cubre: row?.quien_cubre ?? row?.cubridor ?? null,
  fecha_cambio: row?.fecha_cambio ?? row?.turno_que_cambia?.fecha ?? null,
  fecha_que_cubre_trabajara: row?.fecha_que_cubre_trabajara ?? row?.turno_que_devuelve?.fecha ?? null,
  motivo: row?.motivo === "cambio" ? "cambio_turno" : row?.motivo,
});

const normalizePermisoCartola = (row) => ({
  ...row,
  quien_solicita_id: row?.quien_solicita_id ?? row?.solicitante_id ?? null,
  fecha_permiso: row?.fecha_permiso ?? row?.turno_que_solicita?.fecha ?? null,
});

const normalizeExtraCartola = (row) => ({
  ...row,
  quien_cubre_id: row?.quien_cubre_id ?? row?.cubridor_extra_id ?? null,
  fecha_extra_dia: row?.fecha_extra_dia ?? row?.fecha_extra?.fecha ?? null,
  turno_extra: row?.turno_extra ?? row?.fecha_extra?.turno ?? null,
});

const isExtraAutonomoTurnoLibre = (permiso, extra) => {
  const motivo = normalizarMotivo(permiso?.motivo || "");
  const turnoBase = String(permiso?.turno_permiso || permiso?.turno_que_solicita?.turno || "").toUpperCase();
  const mismoFuncionario = String(permiso?.quien_solicita_id || permiso?.solicitante_id || "") === String(extra?.quien_cubre_id || extra?.cubridor_extra_id || "");
  return (motivo === "extra" || motivo === "permiso_administrativo") && (turnoBase === "S" || turnoBase === "L") && mismoFuncionario;
};

const getCeldaCartola = (row, dia, mes, ano, personal, asumes, cambios, permisos, extras, salidas) => {
  const pid = row.id;
  const cambiosNorm = (cambios || []).map(normalizeCambioCartola);
  const permisosNorm = (permisos || []).map(normalizePermisoCartola);
  const extrasNorm = (extras || []).map(normalizeExtraCartola);
  const turnoProgramado = getTurnoDelDia(dia, mes, ano, row.turno);
  let intervalosRealizados = turnoToBounds(turnoProgramado) ? [turnoToBounds(turnoProgramado)] : [];
  const detallesBreves = [];

  const permisosDia = permisosNorm.filter((p) =>
    diaCoincideConCambio(dia, mes, ano, p?.fecha_permiso) && String(p?.quien_solicita_id) === String(pid));
  for (const permiso of permisosDia) {
    const extrasPermisoDia = extrasNorm
      .filter((e) => String(e?.permiso_id || "") === String(permiso?.id || "") && diaCoincideConCambio(dia, mes, ano, e?.fecha_extra_dia));
    if (extrasPermisoDia.some((extra) => isExtraAutonomoTurnoLibre(permiso, extra))) {
      continue;
    }
    const coberturas = extrasPermisoDia
      .map((e) => {
        const cubre = personal.find((p) => String(p.id) === String(e?.quien_cubre_id));
        return getNombre(cubre);
      })
      .filter(Boolean);
    const cubrioTxt = coberturas.length ? `; cubrió ${coberturas.join(", ")}` : "";
    const parcial = parseRangoParcialObservacion(permiso?.observaciones, turnoProgramado);
    if (parcial) {
      intervalosRealizados = subtractRange(intervalosRealizados, parcial);
      detallesBreves.push(`PA ${formatShiftMinutes(parcial.start)}-${formatShiftMinutes(parcial.end)}${cubrioTxt}`);
    } else {
      intervalosRealizados = [];
      detallesBreves.push(`PA jornada completa${cubrioTxt}`);
    }
  }

  const salidasDia = (salidas || []).filter((s) =>
    String(s?.solicitante_id) === String(pid) && diaEnRangoCambio(dia, mes, ano, s?.fecha_inicio, s?.fecha_fin));
  for (const salida of salidasDia) {
    const parcial = parseRangoParcialObservacion(salida?.observaciones, turnoProgramado);
    if (parcial) {
      intervalosRealizados = subtractRange(intervalosRealizados, parcial);
      detallesBreves.push(`${getMotivoLabel(salida?.motivo)} ${formatShiftMinutes(parcial.start)}-${formatShiftMinutes(parcial.end)}`);
    } else {
      intervalosRealizados = [];
      detallesBreves.push(getMotivoLabel(salida?.motivo));
    }
  }

  const extrasDia = extrasNorm.filter(
    (e) => String(e?.quien_cubre_id) === String(pid) && diaCoincideConCambio(dia, mes, ano, e?.fecha_extra_dia),
  );
  for (const extra of extrasDia) {
    const turnoExtra = String(extra?.turno_extra || extra?.fecha_extra?.turno || turnoProgramado || "").toUpperCase();
    const inicio = parseHHMMToShiftMinutes(extra?.fecha_extra?.hora_inicio, turnoExtra);
    const fin = parseHHMMToShiftMinutes(extra?.fecha_extra?.hora_fin, turnoExtra);
    if (Number.isFinite(inicio) && Number.isFinite(fin) && fin > inicio) {
      intervalosRealizados = mergeRanges([...intervalosRealizados, { start: inicio, end: fin }]);
      detallesBreves.push(`Extra ${formatShiftMinutes(inicio)}-${formatShiftMinutes(fin)}`);
    } else {
      const full = turnoToBounds(turnoExtra);
      if (full) {
        intervalosRealizados = mergeRanges([...intervalosRealizados, full]);
        detallesBreves.push(`Extra ${turnoToHorarioRango(turnoExtra)}`);
      }
    }
  }
  const buildResult = (turno, observacion = "") => {
    const turnoNormalizado = turno === "D" || turno === "N" ? turno : "";
    const horarioDesdeTurno = turnoToHorarioRango(turnoNormalizado);
    const horarioDesdeIntervalos = rangesToLabel(intervalosRealizados);
    const detalle = [observacion, ...detallesBreves].filter(Boolean).join(" · ");
    const hayDetalleHorario = detallesBreves.length > 0;
    let horarioRealizo = "";
    if (hayDetalleHorario) {
      // Si hubo movimientos del día, manda el resultado real por intervalos;
      // si quedó sin intervalos, es ausencia efectiva del turno.
      horarioRealizo = horarioDesdeIntervalos || "-";
    } else if (turnoNormalizado) {
      horarioRealizo = horarioDesdeTurno || "";
    } else if (detalle) {
      horarioRealizo = "-";
    }
    return {
      turno: turnoNormalizado,
      horarioRealizo,
      observacion: detalle,
    };
  };

  const cambioTurno = cambiosNorm.find(
    (c) => motivoCoincide(c, "cambio_turno", "inversion") &&
      (diaCoincideConCambio(dia, mes, ano, c.fecha_cambio) || (c.fecha_que_cubre_trabajara && diaCoincideConCambio(dia, mes, ano, c.fecha_que_cubre_trabajara))) &&
      (String(c.quien_solicita_id) === String(pid) || String(c.quien_cubre_id) === String(pid))
  );
  const cambioPA = !cambioTurno && cambiosNorm.find(
    (c) => motivoCoincide(c, "permiso_administrativo") &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio) &&
      (String(c.quien_solicita_id) === String(pid) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(pid)))
  );
  const esCubreCapacitacion = (c) => {
    if (String(c.quien_cubre_id) === String(pid)) return true;
    return (c.quienes_cubren_ids || []).some((cid) => String(cid) === String(pid));
  };
  const cambioCapacitacion = !cambioTurno && !cambioPA && cambiosNorm.find(
    (c) => motivoCoincide(c, "capacitacion") &&
      diaEnRangoCambio(dia, mes, ano, c.fecha_cambio, c.fecha_que_cubre_trabajara) &&
      (String(c.quien_solicita_id) === String(pid) || esCubreCapacitacion(c))
  );
  const cambioCumpleanos = !cambioTurno && !cambioPA && !cambioCapacitacion && cambiosNorm.find(
    (c) => motivoCoincide(c, "permiso_cumpleanos") &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio) &&
      (String(c.quien_solicita_id) === String(pid) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(pid)))
  );
  const cambioConsiliacion = !cambioTurno && !cambioPA && !cambioCapacitacion && !cambioCumpleanos && cambiosNorm.find(
    (c) => motivoCoincide(c, "consilacion_familiar") &&
      diaCoincideConCambio(dia, mes, ano, c.fecha_cambio) &&
      (String(c.quien_solicita_id) === String(pid) || (c.quien_cubre_id && String(c.quien_cubre_id) === String(pid)))
  );
  const esCubreEnCambio = (c) =>
    (c.quien_cubre_id && String(c.quien_cubre_id) === String(pid)) ||
    (c.quienes_cubren_ids || []).some((cid) => String(cid) === String(pid));
  const cambioOtro = !cambioTurno && !cambioPA && !cambioCapacitacion && !cambioCumpleanos && !cambioConsiliacion && cambiosNorm.find(
    (c) => !motivoCoincide(c, "cambio_turno", "inversion", "permiso_administrativo", "capacitacion", "permiso_cumpleanos", "consilacion_familiar") &&
      (diaCoincideConCambio(dia, mes, ano, c.fecha_cambio) || diaEnRangoCambio(dia, mes, ano, c.fecha_cambio, c.fecha_que_cubre_trabajara)) &&
      (String(c.quien_solicita_id) === String(pid) || esCubreEnCambio(c))
  );

  const getCubres = (c) => {
    const ids = [...new Set([c.quien_cubre_id, ...(c.quienes_cubren_ids || [])].filter(Boolean))];
    return ids.map((id) => {
      const p = personal.find((x) => String(x.id) === String(id)) || c.quien_cubre;
      return getNombre(p);
    }).filter(Boolean).join(", ");
  };

  if (cambioTurno) {
    const esInversion = motivoCoincide(cambioTurno, "inversion");
    const cubre = personal.find((p) => p.id === cambioTurno.quien_cubre_id) || cambioTurno.quien_cubre;
    const solicitante = personal.find((p) => p.id === cambioTurno.quien_solicita_id) || cambioTurno.quien_solicita;
    const esMismoDiaInv = esInversion && cambioTurno.fecha_que_cubre_trabajara && String(cambioTurno.fecha_cambio).slice(0, 10) === String(cambioTurno.fecha_que_cubre_trabajara).slice(0, 10);
    const motivoLabel = getMotivoLabel(cambioTurno.motivo);
    let turno = null;
    let obs = "";
    if (diaCoincideConCambio(dia, mes, ano, cambioTurno.fecha_cambio)) {
      if (String(cambioTurno.quien_solicita_id) === String(pid)) {
        turno = esInversion && esMismoDiaInv ? getTurnoDelDia(dia, mes, ano, cubre?.turno) : null;
        obs = turno ? "" : `No asistió: ${motivoLabel}. Cubrió: ${getNombre(cubre)}`;
      } else {
        turno = esInversion && esMismoDiaInv ? getTurnoDelDia(dia, mes, ano, solicitante?.turno) : (TURNO_COBERTURA[(cubre?.turno || "").toString().toUpperCase().slice(0, 1)] || null);
        obs = getNombre(solicitante) ? `${motivoLabel}. Cubrió a: ${getNombre(solicitante)}` : motivoLabel;
      }
    } else if (cambioTurno.fecha_que_cubre_trabajara && diaCoincideConCambio(dia, mes, ano, cambioTurno.fecha_que_cubre_trabajara)) {
      if (String(cambioTurno.quien_cubre_id) === String(pid)) {
        turno = null;
        obs = `${motivoLabel}. Cubrió a: ${getNombre(solicitante)}`;
      } else {
        turno = getTurnoDelDia(dia, mes, ano, cubre?.turno);
        obs = "";
      }
    }
    if (obs || turno !== undefined) return buildResult(turno, obs);
  }

  if (cambioPA) {
    const solicitantePA = personal.find((p) => p.id === cambioPA.quien_solicita_id) || cambioPA.quien_solicita;
    if (String(cambioPA.quien_solicita_id) === String(pid)) {
      const cubres = getCubres(cambioPA);
      return buildResult("", `No asistió: Permiso administrativo. ${cubres ? `Cubrió: ${cubres}` : ""}`.trim());
    }
    return buildResult(getTurnoDelDia(dia, mes, ano, solicitantePA?.turno) || "", getNombre(solicitantePA) ? `Permiso administrativo. Cubrió a: ${getNombre(solicitantePA)}` : "Permiso administrativo. Cubrió");
  }
  if (cambioCapacitacion) {
    const solicitanteCap = personal.find((p) => p.id === cambioCapacitacion.quien_solicita_id) || cambioCapacitacion.quien_solicita;
    if (String(cambioCapacitacion.quien_solicita_id) === String(pid)) {
      const cubres = getCubres(cambioCapacitacion);
      return buildResult("", `No asistió: Capacitación. ${cubres ? `Cubrió: ${cubres}` : ""}`.trim());
    }
    return buildResult(getTurnoDelDia(dia, mes, ano, solicitanteCap?.turno) || "", getNombre(solicitanteCap) ? `Capacitación. Cubrió a: ${getNombre(solicitanteCap)}` : "Capacitación. Cubrió");
  }
  if (cambioCumpleanos) {
    const solicitanteCum = personal.find((p) => p.id === cambioCumpleanos.quien_solicita_id) || cambioCumpleanos.quien_solicita;
    if (String(cambioCumpleanos.quien_solicita_id) === String(pid)) {
      const cubre = personal.find((p) => p.id === cambioCumpleanos.quien_cubre_id) || cambioCumpleanos.quien_cubre;
      return buildResult("", cubre ? `No asistió: Permiso cumpleaños. Cubrió: ${getNombre(cubre)}` : "No asistió: Permiso cumpleaños");
    }
    return buildResult(getTurnoDelDia(dia, mes, ano, solicitanteCum?.turno) || "", getNombre(solicitanteCum) ? `Permiso cumpleaños. Cubrió a: ${getNombre(solicitanteCum)}` : "Permiso cumpleaños. Cubrió");
  }
  if (cambioConsiliacion) {
    const solicitanteCons = personal.find((p) => p.id === cambioConsiliacion.quien_solicita_id) || cambioConsiliacion.quien_solicita;
    if (String(cambioConsiliacion.quien_solicita_id) === String(pid)) {
      const cubre = personal.find((p) => p.id === cambioConsiliacion.quien_cubre_id) || cambioConsiliacion.quien_cubre;
      return buildResult("", cubre ? `No asistió: Consiliación familiar. Cubrió: ${getNombre(cubre)}` : "No asistió: Consiliación familiar");
    }
    return buildResult(getTurnoDelDia(dia, mes, ano, solicitanteCons?.turno) || "", getNombre(solicitanteCons) ? `Consiliación familiar. Cubrió a: ${getNombre(solicitanteCons)}` : "Consiliación familiar. Cubrió");
  }
  if (cambioOtro) {
    const solicitanteOtro = personal.find((p) => p.id === cambioOtro.quien_solicita_id) || cambioOtro.quien_solicita;
    const motivoOtro = getMotivoLabel(cambioOtro.motivo);
    if (String(cambioOtro.quien_solicita_id) === String(pid)) {
      const cubres = getCubres(cambioOtro);
      return buildResult("", cubres ? `No asistió: ${motivoOtro}. Cubrió: ${cubres}` : `No asistió: ${motivoOtro}`);
    }
    return buildResult(getTurnoDelDia(dia, mes, ano, solicitanteOtro?.turno) || "", getNombre(solicitanteOtro) ? `${motivoOtro}. Cubrió a: ${getNombre(solicitanteOtro)}` : `${motivoOtro}. Cubrió`);
  }

  const asumeSuplencia = asumes.find((a) => String(a.suplencia_id) === String(pid) && diaEnRangoAsume(dia, mes, ano, a.fecha_inicio, a.fecha_fin));
  const asumeTitular = asumes.find((a) => String(a.titular_id) === String(pid) && diaEnRangoAsume(dia, mes, ano, a.fecha_inicio, a.fecha_fin));

  if (asumeSuplencia) {
    const titular = personal.find((p) => p.id === asumeSuplencia.titular_id) || asumeSuplencia.titular;
    const v = getTurnoDelDia(dia, mes, ano, titular?.turno);
    const nomTitular = getNombre(titular);
    return buildResult(v === "D" || v === "N" ? v : "", nomTitular ? `Suple a: ${nomTitular}` : "");
  }
  if (asumeTitular) {
    const s = asumes.find((a) => String(a.titular_id) === String(pid) && diaEnRangoAsume(dia, mes, ano, a.fecha_inicio, a.fecha_fin));
    const sup = s ? (personal.find((p) => p.id === s.suplencia_id) || s.suplencia) : null;
    return buildResult("", sup ? `Suplencia. Cubrió: ${getNombre(sup)}` : "Suplencia");
  }

  const calidadJuridica = (row.calidad_juridica || "").toLowerCase();
  if (calidadJuridica === "suplencia") return buildResult("", "");
  const v = getTurnoDelDia(dia, mes, ano, row.turno);
  return buildResult(v === "D" || v === "N" ? v : "", "");
};

export default function CartolaFuncionario({
  funcionario,
  personal = [],
  asumes = [],
  cambios = [],
  permisos = [],
  extras = [],
  salidas = [],
  mes,
  ano,
  estamento = "enfermeria",
  servicio = "uti",
  className = "",
}) {
  const diasDelMes = mes && ano ? new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate() : 31;

  const filasNuevoFormato = React.useMemo(() => {
    const filasRaw = Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
      const celda = funcionario
        ? getCeldaCartola(funcionario, dia, mes, ano, personal, asumes, cambios, permisos, extras, salidas)
        : { turno: "", horarioRealizo: "", observacion: "" };
      // Turno programado: horario inicial del mes (según su turno A/B/C/D)
      const turnoProgramado = funcionario
        ? getTurnoDelDia(dia, mes, ano, funcionario.turno)
        : null;
      return {
        dia,
        horarioProgramado: turnoToHorarioLabel(turnoProgramado || ""),
        horarioRealizo: celda.horarioRealizo || turnoToHorarioLabel(celda.turno),
        justificacion: celda.observacion,
      };
    });
    const filasConHorarioConcreto = filasRaw.map((fila) => {
      const sinNovedad = !String(fila.justificacion || "").trim() && String(fila.horarioProgramado || "") === String(fila.horarioRealizo || "");
      return sinNovedad ? { ...fila, horarioRealizo: "" } : fila;
    });
    // Evita repetir textos idénticos en días consecutivos para mantener la cartola concisa.
    return filasConHorarioConcreto.map((fila, idx) => {
      if (idx === 0) return fila;
      const prev = filasConHorarioConcreto[idx - 1];
      const mismaJustificacion =
        String(fila.justificacion || "").trim() &&
        String(fila.justificacion || "").trim() === String(prev.justificacion || "").trim();
      return mismaJustificacion ? { ...fila, justificacion: "" } : fila;
    });
  }, [funcionario, personal, asumes, cambios, permisos, extras, salidas, mes, ano]);

  if (!funcionario) return null;

  return (
    <div className={`cartola-funcionario bg-white text-black ${className}`} style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Título */}
      <h1 className="text-xl font-bold mb-2 text-center">CARTOLA FUNCIONARIO</h1>
      <div className="mb-4" />

      {/* Destinatario */}
      <p className="text-sm mb-1">
        <strong>A:</strong>{" "}
        <span className="border-b border-black border-dotted inline-block min-w-[280px]">
          CR DESARROLLO DE LAS PERSONAS
        </span>
      </p>

      {/* Nombre funcionario */}
      <p className="text-sm mb-1">
        <strong>NOMBRE FUNCIONARIO:</strong>{" "}
        <span className="border-b border-black inline-block min-w-[320px]">{getNombre(funcionario)}</span>
      </p>

      {/* Calidad jurídica y Grado en la misma línea */}
      <p className="text-sm mb-4">
        <strong>CALIDAD JURÍDICA:</strong>{" "}
        <span className="border-b border-black inline-block min-w-[180px]">
          {(funcionario.calidad_juridica || "").charAt(0).toUpperCase() + (funcionario.calidad_juridica || "").slice(1).toLowerCase()}
        </span>
        {" .   "}
        <strong>GRADO:</strong>{" "}
        <span className="border-b border-black inline-block min-w-[200px]">{funcionario.grado ?? ""}</span>
      </p>

      {/* Tabla: 4° TURNO PROGRAMADO | 4° TURNO REALIZO */}
      <table className="w-full border-collapse border border-gray-700 text-xs">
        <thead>
          <tr>
            <th
              colSpan={3}
              className="border border-gray-700 px-2 py-2 text-center font-bold bg-[#F6C5AC]"
            >
              4° TURNO PROGRAMADO
            </th>
            <th colSpan={2} className="border border-gray-700 px-2 py-2 text-center font-bold bg-[#F6C5AC]">
              4° TURNO REALIZO
            </th>
          </tr>
          <tr className="bg-gray-100">
            <th className="border border-gray-700 px-2 py-1.5 w-10 text-center font-semibold"></th>
            <th className="border border-gray-700 px-2 py-1.5 text-center font-semibold">HORARIO</th>
            <th className="border border-gray-700 px-2 py-1.5 w-10 text-center font-semibold"></th>
            <th className="border border-gray-700 px-2 py-1.5 text-center font-semibold">HORARIO</th>
            <th className="border border-gray-700 px-2 py-1.5 text-center font-semibold">JUSTIFICACIÓN</th>
          </tr>
        </thead>
        <tbody>
          {filasNuevoFormato.map(({ dia, horarioProgramado, horarioRealizo, justificacion }) => {
            const huboCambio = justificacion || horarioRealizo !== horarioProgramado;
            return (
              <tr key={dia}>
                <td className="border border-gray-700 px-2 py-1 text-center">{dia}</td>
                <td className="border border-gray-700 px-2 py-1 text-center">{horarioProgramado}</td>
                <td className="border border-gray-700 px-2 py-1 text-center">{dia}</td>
                <td
                  className={`border border-gray-700 px-2 py-1 text-center ${huboCambio ? "bg-red-100 text-red-600" : ""}`}
                >
                  {horarioRealizo}
                </td>
                <td className="border border-gray-700 px-2 py-1 text-center">{justificacion}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Firma */}
      <div className="mt-8 text-right">
        <p className="border-b border-black inline-block min-w-[240px] mb-2">&nbsp;</p>
        <p className="font-bold text-sm">FIRMA JEFE DIRECTO</p>
      </div>
    </div>
  );
}
