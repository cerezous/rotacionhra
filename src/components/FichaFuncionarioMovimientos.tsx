import React from "react";
import { supabase } from "../lib/supabase";

const formatFecha = (s) => {
  if (!s) return "—";
  const d = new Date(String(s).slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const keyFecha = (mov) => String(mov.fechaInicio || mov.fecha || "9999-12-31");
const humanize = (value) => {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return "—";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function FichaFuncionarioMovimientos({ funcionario }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!funcionario?.id) return;

    const run = async () => {
      setLoading(true);
      const serviceId = funcionario.servicio_id ?? funcionario.servicio ?? "";
      const estamento = funcionario.estamento ?? "";
      const personId = String(funcionario.id);

      const baseFilter = (q) =>
        (serviceId ? q.eq("servicio_id", serviceId) : q).eq("estamento", estamento);

      const [asumesTitular, asumesSuplencia, cambiosSolicita, cambiosCubre, permisosSolicita, extrasCubre, salidasSolicita] =
        await Promise.all([
          baseFilter(supabase.from("asumes").select("id, motivo, fecha_inicio, fecha_fin, titular_id, suplencia_id").eq("titular_id", personId)),
          baseFilter(supabase.from("asumes").select("id, motivo, fecha_inicio, fecha_fin, titular_id, suplencia_id").eq("suplencia_id", personId)),
          baseFilter(
            supabase
              .from("cambios")
              .select("id, motivo, observaciones, solicitante_id, cubridor_id, turno_que_cambia, turno_que_devuelve")
              .eq("solicitante_id", personId),
          ),
          baseFilter(
            supabase
              .from("cambios")
              .select("id, motivo, observaciones, solicitante_id, cubridor_id, turno_que_cambia, turno_que_devuelve")
              .eq("cubridor_id", personId),
          ),
          baseFilter(
            supabase
              .from("permisos")
              .select("id, motivo, observaciones, solicitante_id, turno_que_solicita")
              .eq("solicitante_id", personId),
          ),
          baseFilter(
            supabase
              .from("extras")
              .select("id, observaciones, cubridor_extra_id, fecha_extra")
              .eq("cubridor_extra_id", personId),
          ),
          baseFilter(
            supabase
              .from("salidas")
              .select("id, motivo, observaciones, solicitante_id, fecha_inicio, fecha_fin")
              .eq("solicitante_id", personId),
          ),
        ]);

      const data = [
        ...((asumesTitular.data || []).map((a) => ({
          id: `asume-titular-${a.id}`,
          tipo: "Asume (ausencia propia)",
          descripcion: `${String(a.motivo || "").replace(/_/g, " ")}`,
          fechaInicio: a.fecha_inicio,
          fechaFin: a.fecha_fin,
        }))),
        ...((asumesSuplencia.data || []).map((a) => ({
          id: `asume-suplencia-${a.id}`,
          tipo: "Asume (como suplencia)",
          descripcion: `${String(a.motivo || "").replace(/_/g, " ")}`,
          fechaInicio: a.fecha_inicio,
          fechaFin: a.fecha_fin,
        }))),
        ...((cambiosSolicita.data || []).map((c) => ({
          id: `cambio-solicita-${c.id}`,
          tipo: "Cambio / Inversión (solicita)",
          descripcion: String(c.motivo || "").replace(/_/g, " "),
          fecha: c.turno_que_cambia?.fecha || null,
          fechaInicio: c.turno_que_cambia?.fecha || null,
          fechaFin: c.turno_que_devuelve?.fecha || null,
        }))),
        ...((cambiosCubre.data || []).map((c) => ({
          id: `cambio-cubre-${c.id}`,
          tipo: "Cambio / Inversión (cubre)",
          descripcion: String(c.motivo || "").replace(/_/g, " "),
          fecha: c.turno_que_cambia?.fecha || null,
          fechaInicio: c.turno_que_cambia?.fecha || null,
          fechaFin: c.turno_que_devuelve?.fecha || null,
        }))),
        ...((permisosSolicita.data || []).map((p) => ({
          id: `permiso-${p.id}`,
          tipo: "Permiso",
          descripcion: String(p.motivo || "").replace(/_/g, " "),
          fecha: p.turno_que_solicita?.fecha || null,
          fechaInicio: p.turno_que_solicita?.fecha || null,
        }))),
        ...((extrasCubre.data || []).map((e) => ({
          id: `extra-${e.id}`,
          tipo: "Turno extra",
          descripcion: `Cobertura como extra${e.fecha_extra?.turno ? ` (${e.fecha_extra.turno})` : ""}`,
          fecha: e.fecha_extra?.fecha || null,
          fechaInicio: e.fecha_extra?.fecha || null,
        }))),
        ...((salidasSolicita.data || []).map((s) => ({
          id: `salida-${s.id}`,
          tipo: "Salida",
          descripcion: String(s.motivo || "").replace(/_/g, " "),
          fechaInicio: s.fecha_inicio,
          fechaFin: s.fecha_fin,
        }))),
      ];

      const dedup = Array.from(new Map(data.map((m) => [m.id, m])).values()).sort((a, b) =>
        keyFecha(a).localeCompare(keyFecha(b)),
      );
      setRows(dedup);
      setLoading(false);
    };

    run();
  }, [funcionario]);

  if (loading) return <p className="text-sm text-gray-500">Cargando movimientos…</p>;
  if (!rows.length) return <p className="text-sm text-gray-500">No hay movimientos registrados.</p>;

  const query = search.trim().toLowerCase();
  const rowsFiltered = !query
    ? rows
    : rows.filter((mov) =>
      [mov.tipo, mov.descripcion, mov.observaciones, mov.fechaInicio, mov.fechaFin, mov.fecha]
        .map((item) => String(item || "").toLowerCase())
        .some((value) => value.includes(query)));

  return (
    <div className="space-y-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-2 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por tipo, motivo, fecha u observación"
          className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#007AFF]/40 focus:ring-2 focus:ring-[#007AFF]/15"
        />
      </div>
      <div className="max-h-112 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Motivo</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Desde</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Hasta</th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rowsFiltered.map((mov, idx) => (
              <tr key={mov.id} className={`align-top ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                <td className="px-2 py-2 text-xs text-gray-800">{mov.tipo}</td>
                <td className="px-2 py-2 text-xs text-gray-700">{humanize(mov.descripcion)}</td>
                <td className="px-2 py-2 text-xs text-gray-700">{formatFecha(mov.fechaInicio || mov.fecha)}</td>
                <td className="px-2 py-2 text-xs text-gray-700">{mov.fechaFin ? formatFecha(mov.fechaFin) : "—"}</td>
                <td className="px-2 py-2 text-xs text-gray-600">{mov.observaciones?.trim() || "Sin observaciones"}</td>
              </tr>
            ))}
            {rowsFiltered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-xs text-gray-500">
                  No hay resultados para la búsqueda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

