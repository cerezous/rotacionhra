import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

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

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthMatrix = (cursor) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingEmpty = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export default function CalendarioTurnosPicker({
  value,
  onChange = undefined,
  turnosPorFecha = {},
  compact = false,
  helperText = "Selecciona una fecha disponible",
  rangeStart = "",
  rangeEnd = "",
  onRangeChange = undefined,
}) {
  const initialCursor = React.useMemo(() => {
    const referenceDate = rangeStart || rangeEnd || value;
    if (!referenceDate) return new Date();
    const [year, month] = String(referenceDate).split("-").map(Number);
    if (!year || !month) return new Date();
    return new Date(year, month - 1, 1);
  }, [rangeEnd, rangeStart, value]);

  const [cursor, setCursor] = React.useState(initialCursor);

  React.useEffect(() => {
    setCursor(initialCursor);
  }, [initialCursor]);

  const normalizedRange = React.useMemo(() => {
    const start = String(rangeStart || "").slice(0, 10);
    const end = String(rangeEnd || rangeStart || "").slice(0, 10);
    if (!start && !end) return { start: "", end: "" };
    if (!start) return { start: end, end };
    if (!end) return { start, end: start };
    return start <= end ? { start, end } : { start: end, end: start };
  }, [rangeEnd, rangeStart]);

  const hasHighlightedRange = Boolean(normalizedRange.start || normalizedRange.end);
  const usesRangeClickHandler = typeof onRangeChange === "function";

  const cells = React.useMemo(() => getMonthMatrix(cursor), [cursor]);
  const wrapperClassName = compact
    ? "space-y-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
    : "space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]";
  const navButtonClassName = compact
    ? "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50"
    : "flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50";
  const gridClassName = compact ? "grid grid-cols-7 gap-1.5" : "grid grid-cols-7 gap-2";
  const emptyCellClassName = compact ? "h-14 rounded-xl bg-transparent" : "h-18 rounded-xl bg-transparent";

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className={navButtonClassName}
          aria-label="Mes anterior"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className={`${compact ? "text-[13px]" : "text-sm"} font-semibold text-neutral-900`}>
            {MESES[cursor.getMonth()]} {cursor.getFullYear()}
          </p>
          <p className={`${compact ? "text-[10px]" : "text-[11px]"} text-neutral-500`}>{helperText}</p>
        </div>
        <button
          type="button"
          onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className={navButtonClassName}
          aria-label="Mes siguiente"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className={gridClassName}>
        {DIAS_SEMANA.map((day) => (
          <div key={day} className={`${compact ? "pb-0.5 text-[10px]" : "pb-1 text-[11px]"} text-center font-semibold uppercase tracking-wide text-neutral-400`}>
            {day}
          </div>
        ))}

        {cells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className={emptyCellClassName} />;
          }

          const dateKey = toDateKey(cell);
          const turno = turnosPorFecha[dateKey] || "";
          const isSelectable = turno === "D" || turno === "N";
          const isInteractive = usesRangeClickHandler || isSelectable;
          const isInRange = hasHighlightedRange && normalizedRange.start && normalizedRange.end && dateKey >= normalizedRange.start && dateKey <= normalizedRange.end;
          const isRangeEdge = hasHighlightedRange && isInRange && (dateKey === normalizedRange.start || dateKey === normalizedRange.end);
          const isSelected = hasHighlightedRange ? isInRange : value === dateKey;

          const dayButtonClassName = compact ? "flex h-14 flex-col items-center justify-center rounded-xl border text-center transition" : "flex h-18 flex-col items-center justify-center rounded-xl border text-center transition";

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!isInteractive}
              onClick={() => {
                if (usesRangeClickHandler) {
                  onRangeChange?.(dateKey);
                  return;
                }
                onChange?.(dateKey);
              }}
              className={`${dayButtonClassName} ${
                isSelected
                  ? isRangeEdge
                    ? "border-[#007AFF] bg-[rgba(0,122,255,0.18)] text-[#0A84FF] shadow-[inset_0_0_0_1px_rgba(10,132,255,0.28)]"
                    : "border-[#007AFF]/20 bg-[rgba(0,122,255,0.1)] text-[#0A84FF]"
                  : isInteractive
                    ? "border-neutral-200 bg-white text-neutral-800 hover:border-[#007AFF]/35 hover:bg-[#007AFF]/4"
                    : "border-neutral-100 bg-neutral-50 text-neutral-300"
              }`}
            >
              <span className={`${compact ? "text-[13px]" : "text-sm"} font-semibold leading-none`}>{cell.getDate()}</span>
              <span className={`${compact ? "mt-1.5 text-[10px]" : "mt-2 text-[11px]"} font-semibold uppercase tracking-wide ${isSelectable ? "text-inherit" : hasHighlightedRange ? "text-neutral-400" : "text-neutral-300"}`}>
                {turno || "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}