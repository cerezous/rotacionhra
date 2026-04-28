import React from "react";
import { Button } from "@heroui/react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import FichaFuncionarioSecciones from "./FichaFuncionarioSecciones";

export default function FichaFuncionario({ funcionario, onVolver }) {
  const nombreCompleto = [funcionario?.nombre, funcionario?.apellidos].filter(Boolean).join(" ") || "Funcionario";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          radius="full"
          onPress={onVolver}
          aria-label="Volver"
          className="min-w-8 w-8 h-8"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">{nombreCompleto}</h2>
      </div>

      <FichaFuncionarioSecciones funcionario={funcionario} />
    </div>
  );
}
