import React from "react";
import WidgetCursosRenovacion from "./WidgetCursosRenovacion";

const formatFecha = (s) => {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const toSiNo = (v) => {
  const s = (v || "").toString().toLowerCase();
  return s === "sí" || s === "si" || s === "yes" ? "Sí" : "No";
};

const Fila = ({ label, value }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-600 block">{label}</label>
    <div className="min-h-4 w-full rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-900">
      {value ?? "—"}
    </div>
  </div>
);

export default function FichaFuncionarioDatosPersonales({ funcionario }) {
  if (!funcionario) return null;

  const cursoIaas = toSiNo(funcionario.curso_iaas);
  const cursoRcp = toSiNo(funcionario.curso_rcp);
  const fechaIaas = cursoIaas === "Sí" ? formatFecha(funcionario.fecha_curso_iaas) : null;
  const fechaRcp = cursoRcp === "Sí" ? formatFecha(funcionario.fecha_curso_rcp) : null;
  const cursoIaasStr = cursoIaas === "Sí" ? (fechaIaas ? `Sí (${fechaIaas})` : "Sí") : "No";
  const cursoRcpStr = cursoRcp === "Sí" ? (fechaRcp ? `Sí (${fechaRcp})` : "Sí") : "No";

  const calidadJuridicaStr = funcionario.calidad_juridica
    ? funcionario.calidad_juridica.charAt(0).toUpperCase() + funcionario.calidad_juridica.slice(1).toLowerCase()
    : null;

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-3 gap-y-3 xl:grid-cols-2">
        <Fila label="Nombre" value={funcionario.nombre} />
        <Fila label="Apellidos" value={funcionario.apellidos} />
        <Fila label="Rut" value={funcionario.rut} />
        <Fila label="Calidad jurídica" value={calidadJuridicaStr} />
        <Fila label="Grado" value={funcionario.grado} />
        <Fila label="Turno" value={funcionario.turno} />
        <Fila label="Jefe/a de Turno" value={toSiNo(funcionario.jefe_turno)} />
        <Fila label="Subrogante" value={toSiNo(funcionario.subrogante)} />
        <Fila label="Funcionario Diurno" value={toSiNo(funcionario.funcionario_diurno)} />
        <Fila label="Curso IAAS" value={cursoIaasStr} />
        <Fila label="Curso RCP" value={cursoRcpStr} />
      </div>
      <WidgetCursosRenovacion funcionario={funcionario} />
    </div>
  );
}
