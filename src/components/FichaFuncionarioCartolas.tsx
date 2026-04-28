import React from "react";
import { Button } from "@heroui/react";
import { PrinterIcon } from "@heroicons/react/24/solid";
import { supabase } from "../lib/supabase";
import CartolaFuncionario from "./CartolaFuncionario";
import { useMovimientosSync } from "../context/MovimientosSyncContext";

const MESES = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export default function FichaFuncionarioCartolas({ funcionario }) {
  const { syncVersion } = useMovimientosSync();
  const [loading, setLoading] = React.useState(true);
  const [cartolaData, setCartolaData] = React.useState({ personal: [], asumes: [], cambios: [], permisos: [], extras: [], salidas: [] });
  const [monthOptions, setMonthOptions] = React.useState([]);
  const [selectedMonth, setSelectedMonth] = React.useState("");
  const printRef = React.useRef(null);

  React.useEffect(() => {
    if (!funcionario?.id) return;

    const load = async () => {
      setLoading(true);
      const serviceId = funcionario.servicio_id ?? funcionario.servicio ?? "";
      const estamento = funcionario.estamento ?? "";
      const personId = String(funcionario.id);
      const now = new Date();
      const nowKey = monthKey(now.getFullYear(), now.getMonth() + 1);
      const baseFilter = (q) => (serviceId ? q.eq("servicio_id", serviceId) : q).eq("estamento", estamento);

      const [personalRes, asumesRes, cambiosSolicitaRes, cambiosCubreRes, permisosRes, extrasRes, salidasRes] =
        await Promise.all([
          baseFilter(supabase.from("personal").select("*")),
          baseFilter(supabase.from("asumes").select("*")),
          baseFilter(supabase.from("cambios").select("*").eq("solicitante_id", personId)),
          baseFilter(supabase.from("cambios").select("*").eq("cubridor_id", personId)),
          baseFilter(supabase.from("permisos").select("*").eq("solicitante_id", personId)),
          baseFilter(supabase.from("extras").select("*").eq("cubridor_extra_id", personId)),
          baseFilter(supabase.from("salidas").select("*").eq("solicitante_id", personId)),
        ]);

      const asumes = asumesRes.data || [];
      const cambios = [
        ...(cambiosSolicitaRes.data || []),
        ...(cambiosCubreRes.data || []),
      ];
      const monthMap = new Map();
      const touchMonth = (isoDate, source) => {
        const value = String(isoDate || "").slice(0, 10);
        if (!value) return;
        const [y, m] = value.split("-").map(Number);
        if (!y || !m) return;
        const key = monthKey(y, m);
        if (key > nowKey) return; // no permitir cartolas de meses futuros
        const current = monthMap.get(key) || {
          key,
          month: String(m),
          year: String(y),
          asumes: 0,
          cambios: 0,
          permisos: 0,
          extras: 0,
          salidas: 0,
        };
        current[source] += 1;
        monthMap.set(key, current);
      };

      for (const row of asumes) {
        touchMonth(row.fecha_inicio, "asumes");
        touchMonth(row.fecha_fin, "asumes");
      }
      for (const row of cambios) {
        touchMonth(row.turno_que_cambia?.fecha, "cambios");
        touchMonth(row.turno_que_devuelve?.fecha, "cambios");
      }
      for (const row of permisosRes.data || []) {
        touchMonth(row.turno_que_solicita?.fecha, "permisos");
      }
      for (const row of extrasRes.data || []) {
        touchMonth(row.fecha_extra?.fecha, "extras");
      }
      for (const row of salidasRes.data || []) {
        touchMonth(row.fecha_inicio, "salidas");
        touchMonth(row.fecha_fin, "salidas");
      }

      const options = Array.from(monthMap.values())
        .sort((a, b) => b.key.localeCompare(a.key))
        .map((item) => ({
          ...item,
          label: `${MESES[Number(item.month) - 1]?.label || item.month} ${item.year}`,
          total: item.asumes + item.cambios + item.permisos + item.extras + item.salidas,
        }));

      setCartolaData({
        personal: personalRes.data || [],
        asumes,
        cambios,
        permisos: permisosRes.data || [],
        extras: extrasRes.data || [],
        salidas: salidasRes.data || [],
      });
      setMonthOptions(options);
      setSelectedMonth((current) => current || options[0]?.key || "");
      setLoading(false);
    };

    load();
  }, [funcionario, syncVersion]);

  const selectedOption = monthOptions.find((m) => m.key === selectedMonth) || null;

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cartola Funcionario</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:1rem;color:#000;background:#fff}.cartola-funcionario{background:#fff;color:#000}.cartola-funcionario h1{font-size:16px;font-weight:bold;margin-bottom:1rem}.cartola-funcionario>div:first-of-type{display:grid;grid-template-columns:auto 1fr;gap:.25rem 1rem;margin-bottom:1rem;font-size:14px}.cartola-funcionario>div:first-of-type span:nth-child(odd){font-weight:500}.cartola-funcionario>div:first-of-type span:nth-child(even){border-bottom:1px solid #000}.cartola-funcionario table{width:100%;border-collapse:collapse;font-size:9px}.cartola-funcionario th,.cartola-funcionario td{border:1px solid #374151;padding:3px 6px;text-align:left}.cartola-funcionario th{background:#f3f4f6;font-weight:600}.cartola-funcionario tbody td{font-size:9px}.cartola-funcionario p{font-size:14px;margin-top:2rem;text-align:right;padding-right:5rem}.cartola-funcionario p span{display:block}</style></head><body>${el.innerHTML}</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando cartolas…</p>;
  if (!monthOptions.length) return <p className="text-sm text-gray-500">No hay cartolas registradas para meses vigentes.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-64 overflow-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Mes</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Asumes</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Cambios</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Permisos</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Extras</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Salidas</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Total</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthOptions.map((opt) => {
                const active = selectedMonth === opt.key;
                return (
                  <tr key={opt.key} className={active ? "bg-blue-50/50" : ""}>
                    <td className="px-2 py-2 text-xs text-gray-800">{opt.label}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">{opt.asumes}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">{opt.cambios}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">{opt.permisos}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">{opt.extras}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">{opt.salidas}</td>
                    <td className="px-2 py-2 text-center text-xs font-semibold text-gray-800">{opt.total}</td>
                    <td className="px-2 py-2 text-center">
                      <Button
                        size="sm"
                        variant={active ? "solid" : "flat"}
                        color={active ? "primary" : "default"}
                        onPress={() => setSelectedMonth(opt.key)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOption && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="flat" onPress={handlePrint} startContent={<PrinterIcon className="h-4 w-4" />}>
              Imprimir cartola {selectedOption.label}
            </Button>
          </div>
          <div className="max-h-112 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
          <div ref={printRef}>
            <CartolaFuncionario
              funcionario={funcionario}
              personal={cartolaData.personal}
              asumes={cartolaData.asumes}
              cambios={cartolaData.cambios}
              permisos={cartolaData.permisos}
              extras={cartolaData.extras}
              salidas={cartolaData.salidas}
              mes={selectedOption.month}
              ano={selectedOption.year}
              estamento={funcionario.estamento}
              servicio={funcionario.servicio_id ?? funcionario.servicio}
            />
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

