import React from "react";
import FichaFuncionarioDatosPersonales from "./FichaFuncionarioDatosPersonales";
import FichaFuncionarioMovimientos from "./FichaFuncionarioMovimientos";
import FichaFuncionarioCartolas from "./FichaFuncionarioCartolas";

export default function FichaFuncionarioSecciones({ funcionario }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Datos Personales</h3>
        <FichaFuncionarioDatosPersonales funcionario={funcionario} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Movimientos</h3>
        <FichaFuncionarioMovimientos funcionario={funcionario} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Cartolas</h3>
        <FichaFuncionarioCartolas funcionario={funcionario} />
      </div>
    </div>
  );
}
