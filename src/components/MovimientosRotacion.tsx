import React from "react";
import { esFuncionarioDiurno } from "../lib/utils";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const formatFechaLarga = (fecha) => {
  const value = String(fecha || "").slice(0, 10);
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "—";
  return `${day}-${month}-${year}`;
};

const formatRango = (inicio, fin) => {
  const desde = formatFechaLarga(inicio);
  const hasta = formatFechaLarga(fin);
  if (desde === "—" && hasta === "—") return "—";
  if (desde === hasta) return desde;
  return `${desde} al ${hasta}`;
};

const fechaPerteneceAMes = (fecha, mes, ano) => {
  const value = String(fecha || "").slice(0, 10);
  if (!value) return false;
  const [year, month] = value.split("-");
  return Number(year) === Number(ano) && Number(month) === Number(mes);
};

const nombrePersona = (persona) => {
  if (!persona) return "—";
  return [persona.nombre, persona.apellidos].filter(Boolean).join(" ") || "—";
};

const sumarDiasIso = (fecha, dias) => {
  const [year, month, day] = String(fecha || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const nextDate = new Date(Date.UTC(year, month - 1, day + dias));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
};

const turnoExtraLabel = (turno) => {
  const value = String(turno || "").toUpperCase();
  if (value === "D") return "Día";
  if (value === "N") return "Noche";
  return value || "—";
};

const horarioExtraLabel = (extra) => {
  const inicio = String(extra?.fecha_extra?.hora_inicio || "").trim();
  const fin = String(extra?.fecha_extra?.hora_fin || "").trim();
  return inicio && fin ? `${inicio}-${fin}` : "";
};

const isExtraAutonomoTurnoLibre = (permiso, extra) => {
  const motivo = String(permiso?.motivo || "").toLowerCase();
  const turnoBase = String(permiso?.turno_permiso || permiso?.turno_que_solicita?.turno || "").toUpperCase();
  const mismoFuncionario = String(permiso?.quien_solicita_id || permiso?.solicitante_id || "") === String(extra?.quien_cubre_id || extra?.cubridor_extra_id || "");
  return (motivo === "extra" || motivo === "permiso_administrativo") && (turnoBase === "S" || turnoBase === "L") && mismoFuncionario;
};

const motivoLabel = (motivo) => {
  if (motivo === "inversion") return "Inversión";
  if (motivo === "cambio_turno" || motivo === "cambio") return "Cambio";
  if (motivo === "permiso_administrativo") return "Permiso administrativo";
  if (motivo === "solo_extras") return "Solo extras";
  if (motivo === "suplencia_y_extras") return "Suplencia y extras";
  if (motivo === "una_suplencia") return "1 suplencia";
  if (motivo === "multiples_suplencias") return "2 o más suplencias";
  if (motivo === "feriado_legal") return "Feriado legal";
  if (motivo === "licencia_medica") return "Licencia médica";
  if (motivo === "permiso_capacitacion") return "Permiso capacitación";
  if (motivo === "permiso_fallecimiento") return "Permiso fallecimiento";
  if (motivo === "dias_compensatorios") return "Días compensatorios";
  if (motivo === "prenatal") return "Prenatal";
  if (motivo === "postnatal") return "Post natal";
  if (motivo === "extra") return "Extra";
  if (motivo === "ausencia_diurna") return "Ausencia diurna";
  if (motivo === "ausencia_sin_cobertura") return "Ausencia sin cobertura";
  const fallback = String(motivo || "Movimiento").replace(/_/g, " ").trim();
  if (!fallback) return "Movimiento";
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
};

/** Salida ya listada vía fila de permiso + extras (mismo solicitante y fechas de extra dentro del rango de la salida). */
const salidaCubiertaPorPermisoExtras = (salida, permisos, extras) => {
  const sid = String(salida.solicitante_id || "");
  const fi = String(salida.fecha_inicio || "").slice(0, 10);
  const ff = String(salida.fecha_fin || salida.fecha_inicio || "").slice(0, 10);
  if (!sid || !fi || !ff) return false;
  for (const permiso of permisos || []) {
    if (String(permiso.quien_solicita_id || "") !== sid) continue;
    const extRel = (extras || []).filter((e) => String(e.permiso_id) === String(permiso.id));
    if (extRel.length === 0) continue;
    for (const ex of extRel) {
      const fe = String(ex.fecha_extra_dia || "").slice(0, 10);
      if (fe && fe >= fi && fe <= ff) return true;
    }
  }
  return false;
};

export default function MovimientosRotacion({ cambios = [], permisos = [], extras = [], salidas = [], asumes = [], personal = [], mes, ano }) {
  const tituloMes = `${MESES[Math.max(0, Number(mes) - 1)] || "Mes"} ${ano}`;
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState("todos");

  const movimientosDelMes = React.useMemo(() => {
    const movimientosCambios = [...(cambios || [])];
    const personalPorId = new Map((personal || []).map((persona) => [String(persona.id), persona]));
    const salidasPorId = new Map((salidas || []).map((salida) => [String(salida.id), salida]));
    const permisosPorId = new Map((permisos || []).map((permiso) => [String(permiso.id), permiso]));

    const movimientosSuplencias = [];
    const movimientosMixtos = [];
    const permisoIdsMixtos = new Set();

    for (const asume of asumes || []) {
      if (String(asume.tipo_cobertura || "") === "una_suplencia") {
        const salida = salidasPorId.get(String(asume.salida_id || ""));
        if (!salida) continue;

        movimientosSuplencias.push({
          id: `suplencia-${asume.id}`,
          tipo: "una_suplencia",
          motivo: salida.motivo || asume.motivo || "una_suplencia",
          quien_solicita: personalPorId.get(String(salida.solicitante_id || "")) || null,
          quien_cubre: personalPorId.get(String(asume.suplencia_id || "")) || null,
          fecha_cambio: salida.fecha_inicio,
          fecha_que_cubre_trabajara: salida.fecha_fin,
          observaciones: salida.observaciones || asume.observaciones,
          suplencia: {
            persona: personalPorId.get(String(asume.suplencia_id || "")) || null,
            fechaInicio: asume.fecha_inicio,
            fechaFin: asume.fecha_fin,
          },
        });
        continue;
      }

      if (String(asume.tipo_cobertura || "") !== "suplencia_y_extras") continue;

      const salida = salidasPorId.get(String(asume.salida_id || ""));
      if (!salida) continue;

      const extrasRelacionados = [...(extras || [])]
        .filter((item) => {
          const permiso = permisosPorId.get(String(item.permiso_id || ""));
          return String(permiso?.quien_solicita_id || "") === String(salida.solicitante_id || "");
        })
        .sort((left, right) => String(left.fecha_extra_dia || "9999-12-31").localeCompare(String(right.fecha_extra_dia || "9999-12-31")));

      if (!extrasRelacionados.length) continue;

      const primerExtra = String(extrasRelacionados[0]?.fecha_extra_dia || "").slice(0, 10);
      if (!primerExtra || primerExtra !== sumarDiasIso(asume.fecha_fin, 1)) continue;

      const permiso = permisosPorId.get(String(extrasRelacionados[0]?.permiso_id || ""));
      if (!permiso) continue;

      permisoIdsMixtos.add(String(permiso.id));
      movimientosMixtos.push({
        id: `mixto-${salida.id}`,
        tipo: "suplencia_y_extras",
        motivo: salida.motivo || asume.motivo || "suplencia_y_extras",
        quien_solicita: personalPorId.get(String(salida.solicitante_id || "")) || permiso.quien_solicita || null,
        quien_cubre: personalPorId.get(String(asume.suplencia_id || "")) || null,
        fecha_cambio: salida.fecha_inicio,
        fecha_que_cubre_trabajara: salida.fecha_fin,
        observaciones: salida.observaciones || asume.observaciones || permiso.observaciones,
        suplencia: {
          persona: personalPorId.get(String(asume.suplencia_id || "")) || null,
          fechaInicio: asume.fecha_inicio,
          fechaFin: asume.fecha_fin,
        },
        extras: extrasRelacionados,
      });
    }

    const movimientosPermisos = [...(permisos || [])].map((permiso) => {
      const extrasRelacionados = [...(extras || [])]
        .filter((item) => String(item.permiso_id) === String(permiso.id))
        .sort((left, right) => String(left.fecha_extra_dia || "9999-12-31").localeCompare(String(right.fecha_extra_dia || "9999-12-31")));
      const extra = extrasRelacionados[0] ?? null;
      const motivo = isExtraAutonomoTurnoLibre(permiso, extra) ? "extra" : permiso.motivo;
      return {
        id: permiso.id,
        motivo,
        quien_solicita: permiso.quien_solicita,
        quien_cubre: extra?.quien_cubre ?? null,
        fecha_cambio: permiso.fecha_permiso,
        turno_cambio: permiso.turno_permiso,
        fecha_que_cubre_trabajara: extra?.fecha_extra_dia ?? permiso.fecha_permiso,
        turno_devuelve: extra?.turno_extra ?? null,
        observaciones: permiso.observaciones,
        extras: extrasRelacionados,
      };
    }).filter((permiso) => !permisoIdsMixtos.has(String(permiso.id)));

    const movimientosSalidasSinAsume = [];
    for (const salida of salidas || []) {
      const tieneAsume = (asumes || []).some((item) => String(item.salida_id || "") === String(salida.id));
      if (tieneAsume) continue;
      if (salidaCubiertaPorPermisoExtras(salida, permisos, extras)) continue;

      const solicitante = personalPorId.get(String(salida.solicitante_id || "")) || null;
      const esDiurno = esFuncionarioDiurno(solicitante);
      movimientosSalidasSinAsume.push({
        id: `salida-sin-asume-${salida.id}`,
        tipo: esDiurno ? "ausencia_diurna" : "ausencia_sin_cobertura",
        motivo: String(salida.motivo || "feriado_legal").trim() || "feriado_legal",
        quien_solicita: solicitante,
        quien_cubre: null,
        fecha_cambio: salida.fecha_inicio,
        fecha_que_cubre_trabajara: salida.fecha_fin,
        turno_cambio: null,
        turno_devuelve: null,
        observaciones: salida.observaciones,
        extras: [],
      });
    }

    return [...movimientosCambios, ...movimientosSuplencias, ...movimientosMixtos, ...movimientosPermisos, ...movimientosSalidasSinAsume]
      .filter((item) =>
        fechaPerteneceAMes(item.fecha_cambio, mes, ano) ||
        fechaPerteneceAMes(item.fecha_que_cubre_trabajara, mes, ano),
      )
      .sort((left, right) => {
        const fechaLeft = String(left.fecha_cambio || left.fecha_que_cubre_trabajara || "9999-12-31");
        const fechaRight = String(right.fecha_cambio || right.fecha_que_cubre_trabajara || "9999-12-31");
        return fechaLeft.localeCompare(fechaRight);
      });
  }, [ano, asumes, cambios, extras, mes, permisos, personal, salidas]);

  const movimientosFiltrados = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return movimientosDelMes.filter((movimiento) => {
      const movementType = String(movimiento.tipo || movimiento.motivo || "");
      if (filterType !== "todos" && movementType !== filterType) return false;

      const detalleExtras = (movimiento.extras || [])
        .map((extra) => `${formatFechaLarga(extra.fecha_extra_dia)} ${extra.turno_extra || ""} ${turnoExtraLabel(extra.turno_extra)} ${nombrePersona(extra.quien_cubre)}`)
        .join(" ");
      const detalleSuplencia = movimiento.suplencia
        ? `${nombrePersona(movimiento.suplencia.persona)} ${formatFechaLarga(movimiento.suplencia.fechaInicio)} ${formatFechaLarga(movimiento.suplencia.fechaFin)}`
        : "";

      if (!query) return true;

      const searchableText = [
        motivoLabel(movimiento.tipo || movimiento.motivo),
        motivoLabel(movimiento.motivo),
        nombrePersona(movimiento.quien_solicita),
        nombrePersona(movimiento.quien_cubre),
        formatRango(movimiento.fecha_cambio, movimiento.fecha_que_cubre_trabajara),
        formatFechaLarga(movimiento.fecha_cambio),
        formatFechaLarga(movimiento.fecha_que_cubre_trabajara),
        movimiento.turno_cambio || "",
        movimiento.turno_devuelve || "",
        movimiento.observaciones || "",
        detalleExtras,
        detalleSuplencia,
      ].join(" ").toLowerCase();

      return searchableText.includes(query);
    });
  }, [filterType, movimientosDelMes, searchTerm]);

  const filterOptions = React.useMemo(() => {
    const seen = new Set();
    const options = [{ value: "todos", label: "Todos" }];

    for (const movimiento of movimientosDelMes) {
      const value = String(movimiento.tipo || movimiento.motivo || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push({ value, label: motivoLabel(value) });
    }

    return options;
  }, [movimientosDelMes]);

  const resumenMovimientos = React.useMemo(() => {
    const total = movimientosFiltrados.length;
    const permisos = movimientosFiltrados.filter((m) => String(m.tipo || m.motivo || "") === "permiso_administrativo").length;
    const cambiosTurno = movimientosFiltrados.filter((m) => {
      const tipo = String(m.tipo || m.motivo || "");
      return tipo === "cambio_turno" || tipo === "inversion";
    }).length;
    const extras = movimientosFiltrados.filter((m) => {
      const tipo = String(m.tipo || m.motivo || "");
      return tipo === "extra" || (m.extras?.length ?? 0) > 0;
    }).length;
    const suplencias = movimientosFiltrados.filter((m) => {
      const tipo = String(m.tipo || m.motivo || "");
      return tipo === "una_suplencia" || tipo === "suplencia_y_extras";
    }).length;
    const ausencias = movimientosFiltrados.filter((m) => {
      const tipo = String(m.tipo || m.motivo || "");
      return tipo === "ausencia_diurna" || tipo === "ausencia_sin_cobertura";
    }).length;
    return { total, permisos, cambiosTurno, extras, suplencias, ausencias };
  }, [movimientosFiltrados]);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] ring-1 ring-neutral-200/55">
      <div className="border-b border-neutral-200/70 px-4 py-4 sm:px-5">
        <h3 className="text-[0.95rem] font-semibold leading-tight text-neutral-900">
          Movimientos de {tituloMes}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Cambios de turno, permisos con extra, suplencias, y ausencias sin reemplazo (incluye personal diurno: feriado, licencias, PA, etc.).
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por funcionario, motivo, cobertura u observación"
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
          />
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="h-10 min-w-52 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
            Total: {resumenMovimientos.total}
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-800">
            Cambios: {resumenMovimientos.cambiosTurno}
          </span>
          <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 font-semibold text-fuchsia-800">
            Extras: {resumenMovimientos.extras}
          </span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-800">
            Permisos PA (reales): {resumenMovimientos.permisos}
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
            Suplencias: {resumenMovimientos.suplencias}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
            Ausencias: {resumenMovimientos.ausencias}
          </span>
        </div>
      </div>

      {movimientosDelMes.length === 0 ? (
        <div className="px-4 py-5 text-sm text-neutral-500 sm:px-5">
          No hay movimientos registrados para este período.
        </div>
      ) : movimientosFiltrados.length === 0 ? (
        <div className="px-4 py-5 text-sm text-neutral-500 sm:px-5">
          No hay resultados para esa búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <th className="border-b border-neutral-200 px-4 py-3 sm:px-5">Tipo</th>
                <th className="border-b border-neutral-200 px-4 py-3">Solicita</th>
                <th className="border-b border-neutral-200 px-4 py-3">Motivo</th>
                <th className="border-b border-neutral-200 px-4 py-3">Rango</th>
                <th className="border-b border-neutral-200 px-4 py-3">Cobertura</th>
                <th className="border-b border-neutral-200 px-4 py-3 sm:px-5">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((movimiento) => (
                <tr key={movimiento.id} className="align-top text-neutral-700">
                  <td className="border-b border-neutral-100 px-4 py-4 sm:px-5">
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                      {motivoLabel(movimiento.tipo || movimiento.motivo)}
                    </span>
                  </td>
                  <td className="border-b border-neutral-100 px-4 py-4 font-medium text-neutral-900">
                    {nombrePersona(movimiento.quien_solicita)}
                  </td>
                  <td className="border-b border-neutral-100 px-4 py-4 text-neutral-600">
                    {motivoLabel(movimiento.motivo)}
                  </td>
                  <td className="border-b border-neutral-100 px-4 py-4 text-neutral-600">
                    {movimiento.tipo === "una_suplencia"
                      ? formatRango(movimiento.suplencia?.fechaInicio, movimiento.suplencia?.fechaFin)
                      : movimiento.tipo === "suplencia_y_extras"
                        ? formatRango(movimiento.fecha_cambio, movimiento.fecha_que_cubre_trabajara)
                        : movimiento.extras?.length > 0 && movimiento.motivo !== "permiso_administrativo"
                          ? formatRango(movimiento.fecha_cambio, movimiento.fecha_que_cubre_trabajara)
                          : formatRango(movimiento.fecha_cambio, movimiento.fecha_que_cubre_trabajara)}
                  </td>
                  <td className="border-b border-neutral-100 px-4 py-4 text-neutral-600">
                    {movimiento.tipo === "ausencia_diurna" || movimiento.tipo === "ausencia_sin_cobertura" ? (
                      <span className="text-neutral-500">Sin reemplazo asignado</span>
                    ) : movimiento.motivo === "permiso_administrativo" ? (
                      <span>
                        {nombrePersona(movimiento.quien_cubre)} con turno extra
                      </span>
                    ) : movimiento.tipo === "una_suplencia" ? (
                      <span>{nombrePersona(movimiento.suplencia?.persona)}</span>
                    ) : movimiento.tipo === "suplencia_y_extras" ? (
                      <div className="space-y-1">
                        <p>Suplencia: {nombrePersona(movimiento.suplencia?.persona)}</p>
                        <p>Extras: {movimiento.extras.length}</p>
                      </div>
                    ) : movimiento.extras?.length > 0 && movimiento.motivo !== "permiso_administrativo" ? (
                      <span>{movimiento.extras.length} {movimiento.extras.length === 1 ? "extra" : "extras"}</span>
                    ) : (
                      <span>{nombrePersona(movimiento.quien_cubre)}</span>
                    )}
                  </td>
                  <td className="border-b border-neutral-100 px-4 py-4 sm:px-5">
                    <div className="space-y-2 text-neutral-600">
                      {movimiento.tipo === "ausencia_diurna" ? (
                        <div className="rounded-lg border border-violet-200/70 bg-violet-50/70 px-3 py-2">
                          <p className="text-sm font-medium text-neutral-900">Personal diurno</p>
                          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                            Sin cobertura de extras debido a que el permiso corresponde a un funcionario diurno.
                          </p>
                        </div>
                      ) : movimiento.tipo === "ausencia_sin_cobertura" ? (
                        <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2">
                          <p className="text-sm font-medium text-neutral-900">Sin cobertura en rotación</p>
                          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                            Salida registrada sin asignación de suplencia ni turno extra vinculada a este registro.
                          </p>
                        </div>
                      ) : movimiento.tipo === "una_suplencia" ? (
                        <div className="rounded-lg bg-sky-50/70 px-3 py-2">
                          Cubre <span className="font-medium text-neutral-900">{nombrePersona(movimiento.suplencia?.persona)}</span>
                          {" "}del {formatFechaLarga(movimiento.suplencia?.fechaInicio)} al {formatFechaLarga(movimiento.suplencia?.fechaFin)}.
                        </div>
                      ) : movimiento.tipo === "suplencia_y_extras" ? (
                        <>
                          <div className="rounded-lg bg-sky-50/70 px-3 py-2">
                            <span className="font-medium text-neutral-900">Suplencia:</span>
                            {" "}{nombrePersona(movimiento.suplencia?.persona)}
                            {" "}del {formatFechaLarga(movimiento.suplencia?.fechaInicio)} al {formatFechaLarga(movimiento.suplencia?.fechaFin)}.
                          </div>
                          <div className="space-y-1 rounded-lg bg-neutral-50 px-3 py-2">
                            <p className="font-medium text-neutral-900">Extras:</p>
                            {movimiento.extras.map((extra) => (
                              <p key={extra.id}>
                                {formatFechaLarga(extra.fecha_extra_dia)} · {extra.turno_extra || "—"} ({turnoExtraLabel(extra.turno_extra)})
                                {horarioExtraLabel(extra) ? ` · ${horarioExtraLabel(extra)}` : ""}
                                {" "}— cubre {nombrePersona(extra.quien_cubre)}
                              </p>
                            ))}
                          </div>
                        </>
                      ) : movimiento.extras?.length > 0 && movimiento.motivo !== "permiso_administrativo" ? (
                        <div className="space-y-1 rounded-lg bg-neutral-50 px-3 py-2">
                          {movimiento.extras.map((extra) => (
                            <p key={extra.id}>
                              {formatFechaLarga(extra.fecha_extra_dia)} · {extra.turno_extra || "—"} ({turnoExtraLabel(extra.turno_extra)})
                              {horarioExtraLabel(extra) ? ` · ${horarioExtraLabel(extra)}` : ""}
                              {" "}— cubre {nombrePersona(extra.quien_cubre)}
                            </p>
                          ))}
                        </div>
                      ) : movimiento.motivo === "permiso_administrativo" ? (
                        <div className="space-y-1 rounded-lg bg-neutral-50 px-3 py-2">
                          <p>Permiso: {formatFechaLarga(movimiento.fecha_cambio)} · {movimiento.turno_cambio || "—"}</p>
                          <p>
                            Extra: {formatFechaLarga(movimiento.fecha_que_cubre_trabajara)} · {movimiento.turno_devuelve || movimiento.turno_cambio || "—"}
                            {movimiento.extras?.[0] && horarioExtraLabel(movimiento.extras[0]) ? ` · ${horarioExtraLabel(movimiento.extras[0])}` : ""}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 rounded-lg bg-neutral-50 px-3 py-2">
                          <p>Entrega: {formatFechaLarga(movimiento.fecha_cambio)} · {movimiento.turno_cambio || "—"}</p>
                          <p>Devuelve: {formatFechaLarga(movimiento.fecha_que_cubre_trabajara)} · {movimiento.turno_devuelve || "—"}</p>
                        </div>
                      )}
                      {movimiento.observaciones ? (
                        <p className="text-xs text-neutral-500">Obs: {movimiento.observaciones}</p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}