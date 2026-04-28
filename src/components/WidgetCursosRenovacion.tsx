import React from "react";

const DIAS_ANO = 365.25;
const MES_EN_DIAS = 30;

const toSiNo = (v) => {
  const s = (v || "").toString().toLowerCase();
  return s === "sí" || s === "si" || s === "yes";
};

const formatFecha = (d) =>
  d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

function getDiasRestantes(fechaStr) {
  if (!fechaStr) return null;
  const inicio = new Date(fechaStr + "T12:00:00");
  const vence = new Date(inicio);
  vence.setFullYear(vence.getFullYear() + 2);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  vence.setHours(0, 0, 0, 0);
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function getTextoRestante(dias) {
  if (dias < 0) return { texto: "Vencido", alerta: true };
  if (dias === 0) return { texto: "Vence hoy", alerta: true };
  if (dias < MES_EN_DIAS) return { texto: `${dias} día${dias !== 1 ? "s" : ""}`, alerta: true };
  if (dias < DIAS_ANO) {
    const meses = Math.floor(dias / MES_EN_DIAS);
    return { texto: `${meses} mes${meses !== 1 ? "es" : ""}`, alerta: false };
  }
  const anos = Math.floor(dias / DIAS_ANO);
  const resto = Math.floor((dias % DIAS_ANO) / MES_EN_DIAS);
  if (resto > 0) {
    return { texto: `${anos}a ${resto}m`, alerta: false };
  }
  return { texto: `${anos} año${anos !== 1 ? "s" : ""}`, alerta: false };
}

const TarjetaCurso = ({ titulo, fechaStr }) => {
  const dias = getDiasRestantes(fechaStr);
  const { texto, alerta } = dias !== null ? getTextoRestante(dias) : { texto: "Sin fecha", alerta: false };

  let fechaVence = null;
  if (fechaStr) {
    const d = new Date(fechaStr + "T12:00:00");
    d.setFullYear(d.getFullYear() + 2);
    fechaVence = formatFecha(d);
  }

  return (
    <div
      className={`rounded-2xl px-4 py-3 border shadow-sm ${
        alerta ? "bg-amber-50 border-amber-200/80" : "bg-blue-600 border-blue-700"
      }`}
    >
      <p className={`text-[10px] font-medium uppercase tracking-wide mb-0.5 ${alerta ? "text-gray-500" : "text-blue-100"}`}>{titulo}</p>
      <p className={`text-lg font-semibold ${alerta ? "text-amber-700" : "text-white"}`}>{texto}</p>
      {fechaVence && (
        <p className={`text-[10px] mt-0.5 ${alerta ? "text-gray-500" : "text-blue-100"}`}>Renueva {fechaVence}</p>
      )}
    </div>
  );
};

export default function WidgetCursosRenovacion({ funcionario }) {
  if (!funcionario) return null;

  const tieneIaas = toSiNo(funcionario.curso_iaas) && funcionario.fecha_curso_iaas;
  const tieneRcp = toSiNo(funcionario.curso_rcp) && funcionario.fecha_curso_rcp;

  if (!tieneIaas && !tieneRcp) {
    return (
      <div className="rounded-2xl px-4 py-4 border border-gray-200/80 shadow-sm bg-white/80 w-44">
        <p className="text-xs text-gray-500">Sin cursos con fecha registrada</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-44 shrink-0">
      {tieneIaas && (
        <TarjetaCurso titulo="Curso IAAS" fechaStr={funcionario.fecha_curso_iaas} />
      )}
      {tieneRcp && (
        <TarjetaCurso titulo="Curso RCP" fechaStr={funcionario.fecha_curso_rcp} />
      )}
    </div>
  );
}
