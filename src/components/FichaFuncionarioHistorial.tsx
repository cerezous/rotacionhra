import React from "react";
import { Accordion, AccordionItem } from "@heroui/react";
import { supabase } from "../lib/supabase";

const MOTIVO_ASUME = {
  feriado_legal: "Feriado Legal",
  licencia_medica: "Licencia Médica",
  dias_compensatorios: "Días compensatorios (DC)",
  prenatal: "Prenatal",
  postnatal: "Postnatal",
};

const MOTIVO_CAMBIO = {
  cambio_turno: "Cambio de Turno",
  inversion: "Inversión",
  turno_extra: "Turno extra (DE/NE)",
  permiso_administrativo: "Permiso Administrativo",
  permiso_cumpleanos: "Permiso de Cumpleaños",
  capacitacion: "Capacitación",
  consilacion_familiar: "Consilación Familiar",
  otro: "Otro",
};

const COLOR_ASUME = {
  feriado_legal: "blue",
  licencia_medica: "blue",
  dias_compensatorios: "blue",
  prenatal: "pink",
  postnatal: "violet",
};

const COLOR_CAMBIO = {
  cambio_turno: "blue",
  inversion: "indigo",
  turno_extra: "rose",
  permiso_administrativo: "amber",
  permiso_cumpleanos: "rose",
  capacitacion: "teal",
  consilacion_familiar: "orange",
  otro: "gray",
};

const getAccordionClasses = (color) => {
  const borders = {
    emerald: "border-l-emerald-500 data-[hover=true]:bg-emerald-50/50",
    blue: "border-l-blue-500 data-[hover=true]:bg-blue-50/50",
    pink: "border-l-pink-500 data-[hover=true]:bg-pink-50/50",
    violet: "border-l-violet-500 data-[hover=true]:bg-violet-50/50",
    indigo: "border-l-indigo-500 data-[hover=true]:bg-indigo-50/50",
    amber: "border-l-amber-500 data-[hover=true]:bg-amber-50/50",
    rose: "border-l-rose-500 data-[hover=true]:bg-rose-50/50",
    teal: "border-l-teal-500 data-[hover=true]:bg-teal-50/50",
    orange: "border-l-orange-500 data-[hover=true]:bg-orange-50/50",
    gray: "border-l-gray-400 data-[hover=true]:bg-gray-50/50",
  };
  return `border-l-4 ${borders[color] || borders.gray}`;
};

const getCapsuleClasses = (color) => {
  const styles = {
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    pink: "bg-pink-100 text-pink-800",
    violet: "bg-violet-100 text-violet-800",
    indigo: "bg-indigo-100 text-indigo-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    teal: "bg-teal-100 text-teal-800",
    orange: "bg-orange-100 text-orange-800",
    gray: "bg-gray-200 text-gray-800",
  };
  return styles[color] || styles.gray;
};

const formatFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const getNombre = (p) => (p ? [p.nombre, p.apellidos].filter(Boolean).join(" ") : "—");

export default function FichaFuncionarioHistorial({ funcionario }) {
  const [asumes, setAsumes] = React.useState([]);
  const [cambios, setCambios] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!funcionario?.id || !funcionario?.servicio || !funcionario?.estamento) return;

    const fetch = async () => {
      setLoading(true);
      const s = funcionario.servicio;
      const e = funcionario.estamento;
      const id = funcionario.id;

      const { data: asumesTitular } = await supabase
        .from("asumes")
        .select(`
          *,
          suplencia:personal!suplencia_id(nombre, apellidos),
          titular:personal!titular_id(nombre, apellidos)
        `)
        .eq("titular_id", id)
        .eq("servicio", s)
        .eq("estamento", e)
        .order("fecha_inicio", { ascending: false });

      const { data: asumesSuplencia } = await supabase
        .from("asumes")
        .select(`
          *,
          suplencia:personal!suplencia_id(nombre, apellidos),
          titular:personal!titular_id(nombre, apellidos)
        `)
        .eq("suplencia_id", id)
        .eq("servicio", s)
        .eq("estamento", e)
        .order("fecha_inicio", { ascending: false });

      const { data: cambiosData } = await supabase
        .from("cambios")
        .select(`
          *,
          quien_solicita:personal!quien_solicita_id(id, nombre, apellidos, turno),
          quien_cubre:personal!quien_cubre_id(id, nombre, apellidos)
        `)
        .eq("quien_solicita_id", id)
        .eq("servicio", s)
        .eq("estamento", e)
        .order("fecha_cambio", { ascending: false });

      setAsumes([...(asumesTitular || []), ...(asumesSuplencia || [])].sort(
        (a, b) =>
          new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
      ));
      setCambios(cambiosData || []);
      setLoading(false);
    };

    fetch();
  }, [funcionario?.id, funcionario?.servicio, funcionario?.estamento]);

  const getCubreLabel = (c) => (c.quien_cubre ? getNombre(c.quien_cubre) : "Nadie cubre");

  if (loading) {
    return <p className="text-xs text-gray-500 mt-4">Cargando historial…</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Feriados legales, licencias médicas, etc.</h2>
        <div className="rounded-xl bg-white overflow-hidden">
          {asumes.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">No hay asumes relacionados</p>
          ) : (
            <Accordion selectionMode="multiple" className="px-0">
              {asumes.map((a) => {
                const color = COLOR_ASUME[a.motivo] ?? "gray";
                return (
                <AccordionItem
                  key={a.id}
                  className={getAccordionClasses(color)}
                  aria-label={`${MOTIVO_ASUME[a.motivo] ?? a.motivo} - ${getNombre(a.suplencia)}`}
                  title={
                    <div className="flex flex-col gap-1 pl-4 py-0.5">
                      <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-[10px] font-medium ${getCapsuleClasses(color)}`}>
                        {MOTIVO_ASUME[a.motivo] ?? a.motivo}
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        {formatFecha(a.fecha_inicio)} – {formatFecha(a.fecha_fin)}
                      </span>
                      <span className="text-xs text-gray-700">
                        {a.suplencia_id === funcionario.id ? `Suple a: ${getNombre(a.titular)}` : `Suple: ${getNombre(a.suplencia)}`}
                      </span>
                    </div>
                  }
                >
                  <div className="pl-4 text-[10px] text-gray-600 space-y-0.5 pb-2">
                    <p><strong>Suplencia:</strong> {getNombre(a.suplencia)}</p>
                    <p><strong>Titular/Contrata:</strong> {getNombre(a.titular)}</p>
                    <p><strong>Motivo:</strong> {MOTIVO_ASUME[a.motivo] ?? a.motivo}</p>
                    <p><strong>Período:</strong> {formatFecha(a.fecha_inicio)} al {formatFecha(a.fecha_fin)}</p>
                  </div>
                </AccordionItem>
              );
              })}
            </Accordion>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Extras, Cambios y Permisos especiales</h2>
        <div className="rounded-xl bg-white overflow-hidden">
          {cambios.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">No hay cambios o permisos relacionados</p>
          ) : (
            <Accordion selectionMode="multiple" className="px-0">
              {cambios.map((c) => {
                const color = COLOR_CAMBIO[c.motivo] ?? "gray";
                return (
                <AccordionItem
                  key={c.id}
                  className={getAccordionClasses(color)}
                  aria-label={`${MOTIVO_CAMBIO[c.motivo] ?? c.motivo} - ${getCubreLabel(c)}`}
                  title={
                    <div className="flex flex-col gap-1 pl-4 py-0.5">
                      <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-[10px] font-medium ${getCapsuleClasses(color)}`}>
                        {MOTIVO_CAMBIO[c.motivo] ?? c.motivo}
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        {formatFecha(c.fecha_cambio)}
                      </span>
                      <span className="text-xs text-gray-700">Cubre: {getCubreLabel(c)}</span>
                    </div>
                  }
                >
                  <div className="pl-4 text-[10px] text-gray-600 space-y-0.5 pb-2">
                    <p><strong>Quién solicita:</strong> {getNombre(c.quien_solicita)}</p>
                    <p><strong>Quién cubre:</strong> {getCubreLabel(c)}</p>
                    <p><strong>Motivo:</strong> {MOTIVO_CAMBIO[c.motivo] ?? c.motivo}</p>
                    {c.motivo === "cambio_turno" && c.fecha_que_cubre_trabajara ? (
                      <>
                        <p><strong>Fecha de turno solicitado:</strong> {formatFecha(c.fecha_cambio)}</p>
                        <p><strong>Fecha de devolución:</strong> {formatFecha(c.fecha_que_cubre_trabajara)}</p>
                      </>
                    ) : c.motivo === "inversion" ? (
                      (() => {
                        const esMismoDia = c.fecha_que_cubre_trabajara && String(c.fecha_cambio).slice(0, 10) === String(c.fecha_que_cubre_trabajara).slice(0, 10);
                        const getD = (p, f) => {
                          if (!p?.turno || !f) return "?";
                          const [y, m, d] = String(f).slice(0, 10).split("-").map(Number);
                          const raw = (p.turno || "").toString().toUpperCase();
                          const t = raw.match(/[ABCD]/)?.[0];
                          const OFFSET = { A: 0, B: 2, C: 3, D: 1 };
                          const CICLO = ["D", "N", "L", "L"];
                          const offset = OFFSET[t as keyof typeof OFFSET];
                          if (offset === undefined) return "?";
                          const fecha = new Date(y, m - 1, d);
                          const mar1 = new Date(y, 2, 1);
                          const idx =
                            ((Math.floor((fecha.getTime() - mar1.getTime()) / 86400000) + offset) % 4 + 4) % 4;
                          return CICLO[idx];
                        };
                        const solDia = getD(c.quien_solicita, c.fecha_cambio);
                        const cubreDia = getD(c.quien_cubre, c.fecha_que_cubre_trabajara || c.fecha_cambio);
                        return (
                          <>
                            <p><strong>Fecha solicitante cede:</strong> {formatFecha(c.fecha_cambio)}</p>
                            <p><strong>Movimiento:</strong> {getNombre(c.quien_solicita)} tenía <strong>{solDia}</strong> → recibe <strong>{cubreDia}</strong>. {getNombre(c.quien_cubre)} tenía <strong>{cubreDia}</strong> → recibe <strong>{solDia}</strong>.{esMismoDia ? " Mismo día." : ` Fechas: ${formatFecha(c.fecha_cambio)} y ${formatFecha(c.fecha_que_cubre_trabajara)}.`}</p>
                          </>
                        );
                      })()
                    ) : (c.motivo || "").toLowerCase() === "capacitacion" && c.fecha_que_cubre_trabajara ? (
                      <p><strong>Período:</strong> {formatFecha(c.fecha_cambio)} – {formatFecha(c.fecha_que_cubre_trabajara)}</p>
                    ) : (
                      <p><strong>Fecha:</strong> {formatFecha(c.fecha_cambio)}</p>
                    )}
                    {c.observaciones && <p><strong>Observaciones:</strong> {c.observaciones}</p>}
                  </div>
                </AccordionItem>
              );
              })}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}
