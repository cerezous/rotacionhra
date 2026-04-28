/** Formato observaciones para `cambios.motivo === "turno_extra"`: `dia_extra|codigo_motivo|Etiqueta legible` */

export function buildObservacionesTurnoExtra(
  slot: "D" | "N",
  motivoAusenciaCodigo: string,
  motivoAusenciaLabel: string
): string {
  const slotPart = slot === "D" ? "dia_extra" : "noche_extra";
  return `${slotPart}|${motivoAusenciaCodigo}|${motivoAusenciaLabel}`;
}

export function parseObservacionesTurnoExtra(obs: string | null | undefined): {
  slot: "D" | "N";
  motivoCodigo: string;
  motivoLabel?: string;
} | null {
  if (!obs || typeof obs !== "string") return null;
  const parts = obs.split("|");
  if (parts.length < 2) return null;
  const [a, b, ...rest] = parts;
  if (a === "dia_extra") return { slot: "D", motivoCodigo: b, motivoLabel: rest.join("|") || undefined };
  if (a === "noche_extra") return { slot: "N", motivoCodigo: b, motivoLabel: rest.join("|") || undefined };
  return null;
}
