import React from "react";
import SubmenuTopNav from "./SubmenuTopNav";
import PersonalEnfermeria from "./PersonalEnfermeria";
import RotacionEnfermeria from "./RotacionEnfermeria";
import GestionEnfermeria from "./GestionEnfermeria";
import { useSubmenuContentPaddingTop } from "../context/AppShellContext";

/** Rotación, personal y gestión TENS (mismo patrón que Enfermería / Kinesiología). */
export default function Tens({ servicio = "uti", servicioId = "", hospitalId = "", activeTab: activeTabProp = "rotacion", onTabChange }) {
  const [activeTabLocal, setActiveTabLocal] = React.useState(activeTabProp || "rotacion");
  const activeTab = activeTabProp || activeTabLocal;
  const setActiveTab = onTabChange || setActiveTabLocal;
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
            <RotacionEnfermeria titulo={`Rotación TENS ${svcLabel}`} servicioId={servicioId} estamento="tens" />
          )}
          {activeTab === "personal" && (
            <PersonalEnfermeria servicioId={servicioId} hospitalId={hospitalId} estamento="tens" titulo={`Personal TENS ${svcLabel}`} />
          )}
          {activeTab === "gestion" && (
            <GestionEnfermeria titulo={`Gestión TENS ${svcLabel}`} servicioId={servicioId} estamento="tens" />
          )}
        </div>
      </div>
    </div>
  );
}
