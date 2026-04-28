import React from "react";
import { Tooltip } from "@heroui/react";
import { esDiaLaboralDiurnoChile, getInfoDiaChile } from "../lib/calendarioChile";
import { JORNADA_DIURNO_FIN, JORNADA_DIURNO_INICIO } from "../lib/jornadaDiurno";

type SalidaRow = {
  id: string;
  solicitante_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
};

type AsumeRow = { salida_id?: string | null };

const diaEnRango = (dia: number, mes: string, ano: string, fechaInicio: string | null | undefined, fechaFin: string | null | undefined) => {
  const y = parseInt(ano, 10);
  const m = parseInt(mes, 10);
  const dStr = `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const ini = String(fechaInicio || "").slice(0, 10);
  const fin = String(fechaFin || "").slice(0, 10);
  return Boolean(ini && fin && dStr >= ini && dStr <= fin);
};

const CELDA_AUSENCIA: Record<string, string> = {
  feriado_legal: "FL",
  licencia_medica: "LM",
  dias_compensatorios: "DC",
  permiso_capacitacion: "PC",
  permiso_administrativo: "PA",
  prenatal: "PRE",
  postnatal: "POS",
};

const COLOR_AUSENCIA: Record<string, string> = {
  feriado_legal: "bg-yellow-300",
  licencia_medica: "bg-green-300",
  dias_compensatorios: "bg-yellow-300",
  permiso_capacitacion: "bg-amber-300",
  permiso_administrativo: "bg-red-400",
  prenatal: "bg-violet-300",
  postnatal: "bg-purple-300",
};

function getSalidaSinCoberturaDelDia(
  rowId: string,
  dia: number,
  mes: string,
  ano: string,
  salidas: SalidaRow[] | undefined,
  asumes: AsumeRow[] | undefined,
): SalidaRow | null {
  for (const salida of salidas || []) {
    if (String(salida.solicitante_id) !== String(rowId)) continue;
    if (!diaEnRango(dia, mes, ano, salida.fecha_inicio, salida.fecha_fin)) continue;
    const tieneAsume = (asumes || []).some((a) => String(a.salida_id) === String(salida.id));
    if (!tieneAsume) return salida;
  }
  return null;
}

const formatFechaSeleccion = (dia: number, mes: string, ano: string) => {
  const fecha = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, dia);
  return fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
};

function getHeaderClass(d: number, mes: string, ano: string) {
  const info = getInfoDiaChile(d, mes, ano);
  if (info.esFeriado) return "bg-amber-100 text-amber-950";
  if (info.esFinDeSemana) return "bg-slate-200/90 text-neutral-800";
  return "bg-white text-neutral-700";
}

function getBodyCellClass(d: number, mes: string, ano: string) {
  const info = getInfoDiaChile(d, mes, ano);
  if (info.esLaboralDiurno) return "bg-emerald-50/95 text-emerald-950";
  if (info.esFeriado) return "bg-amber-50/95 text-amber-950";
  return "bg-slate-100/90 text-neutral-600";
}

function getCellTitle(d: number, mes: string, ano: string) {
  const info = getInfoDiaChile(d, mes, ano);
  if (info.esLaboralDiurno) return `Día laboral diurno (${JORNADA_DIURNO_INICIO}–${JORNADA_DIURNO_FIN})`;
  if (info.nombreFeriado) return `No laboral: ${info.nombreFeriado}`;
  if (info.esFinDeSemana) return "No laboral: fin de semana";
  return "No laboral";
}

type Row = { id: string; nombre?: string | null; apellidos?: string | null };

type TablaRotacionFuncionarioDiurnoProps = {
  personal: Row[];
  salidas?: SalidaRow[];
  asumes?: AsumeRow[];
  diasDelMes: number;
  mes: string;
  ano: string;
  tituloColumna?: string;
  getNombreCell: (row: Row) => React.ReactNode;
  onSelectionComplete?: (selection: {
    rowId: string;
    rowLabel: string;
    startDay: number;
    endDay: number;
    modoDiurno: boolean;
  }) => void;
};

/**
 * Tabla mensual para funcionarios diurnos: por defecto **DI** en días laborables Chile (lun–vie sin feriado)
 * y **—** en fines de semana y feriados. La fila de cabecera usa el mismo criterio de color que las celdas.
 */
export default function TablaRotacionFuncionarioDiurno({
  personal,
  salidas = [],
  asumes = [],
  diasDelMes,
  mes,
  ano,
  tituloColumna = "Funcionario diurno",
  getNombreCell,
  onSelectionComplete,
}: TablaRotacionFuncionarioDiurnoProps) {
  const [selectedRange, setSelectedRange] = React.useState<{
    rowId: string;
    rowLabel: string;
    startDay: number;
    endDay: number;
  } | null>(null);
  const [dragSelection, setDragSelection] = React.useState<{
    rowId: string;
    rowLabel: string;
    startDay: number;
    currentDay: number;
  } | null>(null);

  const handlePointerStart = React.useCallback((row: Row, day: number) => {
    setDragSelection({
      rowId: row.id,
      rowLabel: [row.nombre, row.apellidos].filter(Boolean).join(" ") || "—",
      startDay: day,
      currentDay: day,
    });
  }, []);

  const handlePointerEnter = React.useCallback((rowId: string, day: number) => {
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
      const nextSelection = { rowId: prev.rowId, rowLabel: prev.rowLabel, startDay, endDay };
      setSelectedRange(nextSelection);
      onSelectionComplete?.({ ...nextSelection, modoDiurno: true });
      return null;
    });
  }, [onSelectionComplete]);

  const isCellSelected = React.useCallback(
    (rowId: string, day: number) => {
      const activeRange = dragSelection
        ? {
            rowId: dragSelection.rowId,
            startDay: Math.min(dragSelection.startDay, dragSelection.currentDay),
            endDay: Math.max(dragSelection.startDay, dragSelection.currentDay),
          }
        : selectedRange;
      if (!activeRange || activeRange.rowId !== rowId) return false;
      return day >= activeRange.startDay && day <= activeRange.endDay;
    },
    [dragSelection, selectedRange],
  );

  const rangeLabel = React.useMemo(() => {
    const activeRange = dragSelection
      ? {
          rowLabel: dragSelection.rowLabel,
          startDay: Math.min(dragSelection.startDay, dragSelection.currentDay),
          endDay: Math.max(dragSelection.startDay, dragSelection.currentDay),
        }
      : selectedRange;
    if (!activeRange) {
      return "Mantén el clic presionado y arrastra sobre las fechas del mismo funcionario para seleccionar un rango.";
    }
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
      <table className="w-full table-fixed border-collapse">
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
              const head = getHeaderClass(d, mes, ano);
              const title = getCellTitle(d, mes, ano);
              return (
                <th
                  key={`n-${d}`}
                  title={title}
                  className={`border-l border-gray-100/80 px-0.5 py-1 text-center text-[11px] font-semibold tabular-nums leading-none ${head}`}
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
                No hay funcionarios diurnos
              </td>
            </tr>
          ) : (
            personal.map((row) => (
              <tr key={row.id} className="group transition-colors hover:bg-gray-50/30">
                <td className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[10px] font-medium leading-snug text-neutral-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] sm:text-[11px]">
                  <span className="line-clamp-2">{getNombreCell(row)}</span>
                </td>
                {Array.from({ length: diasDelMes }, (_, i) => {
                  const d = i + 1;
                  const salidaSolo = getSalidaSinCoberturaDelDia(row.id, d, mes, ano, salidas, asumes);
                  const laboral = esDiaLaboralDiurnoChile(d, mes, ano);
                  const motivoKey = String(salidaSolo?.motivo || "").trim();
                  const valor = salidaSolo
                    ? CELDA_AUSENCIA[motivoKey] ??
                      (motivoKey ? motivoKey.replace(/_/g, " ").slice(0, 3).toUpperCase() : "AU")
                    : laboral
                      ? "DI"
                      : "—";
                  const bodyBg = salidaSolo
                    ? COLOR_AUSENCIA[motivoKey] || "bg-orange-200"
                    : getBodyCellClass(d, mes, ano);
                  const selected = isCellSelected(row.id, d);
                  const selectedCellClassName = selected ? "shadow-[inset_0_0_0_2px_rgba(10,132,255,0.55)]" : "";
                  const selectedTextClassName = selected ? "font-semibold" : "";
                  const buttonClassName = `flex min-h-5 w-full cursor-pointer items-center justify-center rounded-[6px] px-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/35 focus-visible:ring-offset-0 ${selectedTextClassName}`;
                  const cellTitle = salidaSolo
                    ? `Ausencia (${motivoKey.replace(/_/g, " ")}) — sin cobertura. Del ${String(salidaSolo.fecha_inicio || "").slice(0, 10)} al ${String(salidaSolo.fecha_fin || "").slice(0, 10)}${salidaSolo.observaciones ? `. ${salidaSolo.observaciones}` : ""}`
                    : getCellTitle(d, mes, ano);
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
                  return (
                    <td
                      key={d}
                      className={`border-l border-gray-100/80 px-0.5 py-1 text-center text-[11px] font-medium tabular-nums leading-none sm:text-xs ${bodyBg} ${selectedCellClassName} ${salidaSolo && (motivoKey === "permiso_administrativo" || motivoKey === "permiso_capacitacion") ? "text-white" : "text-neutral-800"}`}
                      style={selected ? { backgroundColor: "rgba(0, 122, 255, 0.16)" } : undefined}
                    >
                      <Tooltip content={cellTitle} delay={300} closeDelay={0}>
                        {button}
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex flex-col gap-2 border-t border-gray-100 bg-neutral-50/75 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-600 sm:text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 shrink-0 rounded bg-emerald-100 ring-1 ring-emerald-200/60" />{" "}
            <strong>DI</strong> laboral ({JORNADA_DIURNO_INICIO}–{JORNADA_DIURNO_FIN}, lun–vie sin feriado)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 shrink-0 rounded bg-slate-100 ring-1 ring-slate-200/60" />{" "}
            <strong>—</strong> fin de semana
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 shrink-0 rounded bg-amber-50 ring-1 ring-amber-200/60" />{" "}
            <strong>—</strong> feriado legal
          </span>
          <span className="text-neutral-500">· Códigos FL/LM/… = ausencia registrada (sin reemplazo)</span>
        </div>
        <p className="text-[11px] font-medium text-neutral-600 sm:max-w-[min(100%,20rem)] sm:text-right">{rangeLabel}</p>
      </div>
    </div>
  );
}
