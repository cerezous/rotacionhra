import React from "react";
import SubmenuTopNav from "./SubmenuTopNav";
import PersonalEnfermeria from "./PersonalEnfermeria";
import RotacionEnfermeria from "./RotacionEnfermeria";
import GestionEnfermeria from "./GestionEnfermeria";
import { useSubmenuContentPaddingTop } from "../context/AppShellContext";

/** Rotación, personal y gestión auxiliares (mismo patrón que Enfermería / Kinesiología). */
export default function Auxiliares({ servicio = "uti", servicioId = "", hospitalId = "" }) {
  const [activeTab, setActiveTab] = React.useState("rotacion");
  const contentPadTop = useSubmenuContentPaddingTop();
  const svcLabel = servicio.split("_")[0].toUpperCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SubmenuTopNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingTop: contentPadTop }}
      >
        <div className="px-4 md:px-6">
          {activeTab === "rotacion" && (
            <RotacionEnfermeria titulo={`Rotación Auxiliares ${svcLabel}`} servicioId={servicioId} estamento="auxiliares" />
          )}
          {activeTab === "personal" && (
            <PersonalEnfermeria
              servicioId={servicioId}
              hospitalId={hospitalId}
              estamento="auxiliares"
              titulo={`Personal Auxiliares ${svcLabel}`}
            />
          )}
          {activeTab === "gestion" && (
            <GestionEnfermeria titulo={`Gestión Auxiliares ${svcLabel}`} servicioId={servicioId} estamento="auxiliares" />
          )}
        </div>
      </div>
    </div>
  );
}
