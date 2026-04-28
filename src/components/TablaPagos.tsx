import React from "react";
import { PrinterIcon, PaperAirplaneIcon, FolderIcon, XCircleIcon, CheckCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@heroui/react";
import { supabase } from "../lib/supabase";
import CartolaFuncionario from "./CartolaFuncionario";

const formatFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const asumeAbarcaMes = (a, mes, ano) => {
  if (!mes || !ano || !a.fecha_inicio || !a.fecha_fin) return false;
  const m = parseInt(mes, 10);
  const y = parseInt(ano, 10);
  const primerDia = new Date(y, m - 1, 1);
  const ultimoDia = new Date(y, m, 0);
  const inicio = new Date(a.fecha_inicio + "T12:00:00");
  const fin = new Date(a.fecha_fin + "T12:00:00");
  return inicio <= ultimoDia && fin >= primerDia;
};

const COLUMNS = [
  { key: "nombre", label: "Nombre funcionario" },
  { key: "calidad_juridica", label: "Calidad jurídica" },
  { key: "fecha_inicio", label: "Fecha inicio" },
  { key: "fecha_final", label: "Fecha final" },
  { key: "acciones", label: "Acciones" },
];

export default function TablaPagos({ servicioId = "", estamento = "enfermeria", mes, ano }) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [estadoPorFila, setEstadoPorFila] = React.useState({});
  const [cartolaOpen, setCartolaOpen] = React.useState(false);
  const [cartolaLoading, setCartolaLoading] = React.useState(false);
  const [cartolaData, setCartolaData] = React.useState({ funcionario: null, personal: [], asumes: [], cambios: [], permisos: [], extras: [], salidas: [] });
  const [busqueda, setBusqueda] = React.useState("");

  React.useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: personal } = await supabase
        .from("personal")
        .select("*")
        .eq("servicio_id", servicioId)
        .eq("estamento", estamento)
        .order("turno", { ascending: true })
        .order("nombre", { ascending: true });

      const { data: asumes } = await supabase
        .from("asumes")
        .select(`
          id, fecha_inicio, fecha_fin, suplencia_id, titular_id,
          suplencia:personal!suplencia_id(id, nombre, apellidos, calidad_juridica)
        `)
        .eq("servicio_id", servicioId)
        .eq("estamento", estamento)
        .order("fecha_inicio", { ascending: false });

      if (!personal?.length) {
        setData([]);
        setLoading(false);
        return;
      }

      const primerDia = mes && ano ? `${ano}-${String(mes).padStart(2, "0")}-01` : null;
      const ultimoDia = mes && ano
        ? new Date(parseInt(ano, 10), parseInt(mes, 10), 0)
        : null;
      const ultimoDiaStr = ultimoDia
        ? `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia.getDate()).padStart(2, "0")}`
        : null;

      const rows = [];
      const cargoStr = (c) => (c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : "—");
      const getNombre = (p) => (p ? [p.nombre, p.apellidos].filter(Boolean).join(" ") : "—");

      personal.forEach((p) => {
        const cj = (p.calidad_juridica || "").toLowerCase();
        if (cj === "suplencia") {
          const todosAsumes = (asumes || []).filter((a) => {
            const sup = a.suplencia as { id?: string } | { id?: string }[] | null | undefined;
            const sid = Array.isArray(sup) ? undefined : sup?.id;
            return String(a.suplencia_id || sid || "") === String(p.id);
          });
          const asumesEnMes = mes && ano ? todosAsumes.filter((a) => asumeAbarcaMes(a, mes, ano)) : todosAsumes;
          if (asumesEnMes.length === 0) return;
          const fechasInicio = asumesEnMes.map((a) => a.fecha_inicio).filter(Boolean);
          const fechasFinal = asumesEnMes.map((a) => a.fecha_fin).filter(Boolean);
          rows.push({
            id: p.id,
            nombre: getNombre(p) || "—",
            calidad_juridica: cargoStr(p.calidad_juridica),
            fecha_inicio: fechasInicio.length ? fechasInicio : null,
            fecha_final: fechasFinal.length ? fechasFinal : null,
            personalId: p.id,
          });
        } else {
          rows.push({
            id: p.id,
            nombre: getNombre(p) || "—",
            calidad_juridica: cargoStr(p.calidad_juridica),
            fecha_inicio: primerDia || "—",
            fecha_final: ultimoDiaStr || "—",
            personalId: p.id,
          });
        }
      });

      const seenIds = new Set();
      const seenNombres = new Set();
      const uniqueRows = rows.filter((r) => {
        const key = (r.nombre || "").trim().toLowerCase();
        if (seenIds.has(r.id)) return false;
        if (key && seenNombres.has(key)) return false;
        seenIds.add(r.id);
        if (key) seenNombres.add(key);
        return true;
      });
      setData(uniqueRows);
      setEstadoPorFila((prev) => {
        const next = {};
        uniqueRows.forEach((r) => { next[r.id] = prev[r.id] ?? "en_gestion"; });
        return next;
      });
      setLoading(false);
    };

    fetch();
  }, [servicioId, estamento, mes, ano]);

  const setEstado = (rowId, estado) => {
    setEstadoPorFila((prev) => ({ ...prev, [rowId]: estado }));
  };

  const handleTicket = (row) => setEstado(row.id, "ticket");
  const handleEnGestion = (row) => setEstado(row.id, "en_gestion");
  const handleEliminar = (row) => setEstado(row.id, "eliminado");

  const handleEnviar = (row) => {
    // TODO: implementar envío
  };

  const handleImprimir = React.useCallback(async (row) => {
    setCartolaOpen(true);
    setCartolaLoading(true);
    setCartolaData({ funcionario: null, personal: [], asumes: [], cambios: [], permisos: [], extras: [], salidas: [] });
    try {
      const personaId = row.personalId || row.id;
      const [resPersonal, resAsumes, resCambios, resPermisos, resExtras, resSalidas] = await Promise.all([
        supabase.from("personal").select("*").eq("id", personaId).single(),
        supabase.from("asumes").select(`
          *,
          suplencia:personal!suplencia_id(id, nombre, apellidos)
        `).eq("servicio_id", servicioId).eq("estamento", estamento),
        supabase.from("cambios").select("*").eq("servicio_id", servicioId).eq("estamento", estamento),
        supabase.from("permisos").select("*").eq("servicio_id", servicioId).eq("estamento", estamento).eq("solicitante_id", personaId),
        supabase.from("extras").select("*").eq("servicio_id", servicioId).eq("estamento", estamento),
        supabase.from("salidas").select("*").eq("servicio_id", servicioId).eq("estamento", estamento).eq("solicitante_id", personaId),
      ]);
      const { data: personalAll } = await supabase
        .from("personal")
        .select("*")
        .eq("servicio_id", servicioId)
        .eq("estamento", estamento);
      const funcionario = resPersonal?.data;
      setCartolaData({
        funcionario,
        personal: personalAll || [],
        asumes: resAsumes?.data || [],
        cambios: resCambios?.data || [],
        permisos: resPermisos?.data || [],
        extras: resExtras?.data || [],
        salidas: resSalidas?.data || [],
      });
    } finally {
      setCartolaLoading(false);
    }
  }, [servicioId, estamento]);

  const cartolaPrintRef = React.useRef(null);

  const handlePrintCartola = () => {
    const el = cartolaPrintRef.current;
    if (!el) return;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cartola Funcionario</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 1rem; color: #000; background: #fff; }
    .cartola-funcionario { background: #fff; color: #000; }
    .cartola-funcionario h1 { font-size: 16px; font-weight: bold; margin-bottom: 1rem; }
    .cartola-funcionario > div:first-of-type { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; margin-bottom: 1rem; font-size: 14px; }
    .cartola-funcionario > div:first-of-type span:nth-child(odd) { font-weight: 500; }
    .cartola-funcionario > div:first-of-type span:nth-child(even) { border-bottom: 1px solid #000; }
    .cartola-funcionario table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .cartola-funcionario th, .cartola-funcionario td { border: 1px solid #374151; padding: 3px 6px; text-align: left; }
    .cartola-funcionario th { background: #f3f4f6; font-weight: 600; }
    .cartola-funcionario tbody td { font-size: 9px; }
    .cartola-funcionario p { font-size: 14px; margin-top: 2rem; text-align: right; padding-right: 5rem; }
    .cartola-funcionario p span { display: block; }
  </style>
</head>
<body>
  ${el.innerHTML}
</body>
</html>`;
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

  const renderCell = (row, col) => {
    if (col.key === "nombre") return row.nombre;
    if (col.key === "calidad_juridica") return row.calidad_juridica;
    if (col.key === "fecha_inicio") {
      if (Array.isArray(row.fecha_inicio)) {
        return (
          <div className="flex flex-col gap-0.5">
            {row.fecha_inicio.map((f, i) => (
              <span key={i}>{formatFecha(f)}</span>
            ))}
          </div>
        );
      }
      return formatFecha(row.fecha_inicio);
    }
    if (col.key === "fecha_final") {
      if (Array.isArray(row.fecha_final)) {
        return (
          <div className="flex flex-col gap-0.5">
            {row.fecha_final.map((f, i) => (
              <span key={i}>{formatFecha(f)}</span>
            ))}
          </div>
        );
      }
      return formatFecha(row.fecha_final);
    }
    if (col.key === "acciones") {
      const estado = estadoPorFila[row.id] ?? "en_gestion";
      return (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleTicket(row); }}
            className={`p-2 rounded transition-colors ${estado === "ticket" ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-300"}`}
            title="Ticket"
            aria-label="Ticket"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEnGestion(row); }}
            className={`p-2 rounded transition-colors ${estado === "en_gestion" ? "text-yellow-600 hover:bg-yellow-50" : "text-gray-300"}`}
            title="En gestión"
            aria-label="En gestión"
          >
            <FolderIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEliminar(row); }}
            className={`p-2 rounded transition-colors ${estado === "eliminado" ? "text-red-600 hover:bg-red-50" : "text-gray-300"}`}
            title="Eliminar"
            aria-label="Eliminar"
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEnviar(row); }}
            className="p-2 hover:bg-blue-50 rounded transition-colors"
            title="Enviar"
            aria-label="Enviar"
          >
            <PaperAirplaneIcon className="h-4 w-4 text-blue-500 -rotate-45" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleImprimir(row); }}
            className="p-2 hover:bg-gray-50 rounded transition-colors"
            title="Imprimir"
            aria-label="Imprimir"
          >
            <PrinterIcon className="h-4 w-4 text-gray-900" />
          </button>
        </div>
      );
    }
    return "—";
  };

  const textoBusqueda = (busqueda || "").trim().toLowerCase();
  const dataFiltrada = textoBusqueda
    ? data.filter((row) => {
        const nombre = (row.nombre || "").toLowerCase();
        const calidad = (row.calidad_juridica || "").toLowerCase();
        const fechaIni = Array.isArray(row.fecha_inicio)
          ? (row.fecha_inicio || []).map((f) => (f ? formatFecha(f) : "")).join(" ").toLowerCase()
          : (row.fecha_inicio ? formatFecha(row.fecha_inicio) : "").toLowerCase();
        const fechaFin = Array.isArray(row.fecha_final)
          ? (row.fecha_final || []).map((f) => (f ? formatFecha(f) : "")).join(" ").toLowerCase()
          : (row.fecha_final ? formatFecha(row.fecha_final) : "").toLowerCase();
        return (
          nombre.includes(textoBusqueda) ||
          calidad.includes(textoBusqueda) ||
          fechaIni.includes(textoBusqueda) ||
          fechaFin.includes(textoBusqueda)
        );
      })
    : data;

  return (
    <>
    <div className="space-y-4">
      <div className="flex justify-start">
        <Input
          type="search"
          placeholder="Buscar por nombre, calidad jurídica, fechas..."
          value={busqueda}
          onValueChange={setBusqueda}
          size="sm"
          classNames={{ input: "text-sm" }}
          className="max-w-sm"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />}
          isClearable
          onClear={() => setBusqueda("")}
          aria-label="Buscar en tabla de gestión"
        />
      </div>
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <table className="w-full table-fixed">
        <thead>
          <tr className="bg-gray-50/80 border-b border-gray-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-[9px] font-medium text-gray-500 uppercase tracking-wider text-center"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-4 text-[10px] text-gray-400 text-center">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-4 text-[10px] text-gray-400 text-center">
                No hay registros
              </td>
            </tr>
          ) : dataFiltrada.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-4 text-[10px] text-gray-400 text-center">
                No hay resultados para la búsqueda
              </td>
            </tr>
          ) : (
            dataFiltrada.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 text-[10px] text-gray-700 text-center"
                  >
                    {renderCell(row, col)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>

    <Modal
      isOpen={cartolaOpen}
      onOpenChange={setCartolaOpen}
      size="3xl"
      scrollBehavior="inside"
      classNames={{ base: "max-h-[90vh]" }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 no-print">Cartola Funcionario</ModalHeader>
        <ModalBody>
          <div ref={cartolaPrintRef} className="cartola-print-area">
            {cartolaLoading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : cartolaData.funcionario ? (
              <CartolaFuncionario
                funcionario={cartolaData.funcionario}
                personal={cartolaData.personal}
                asumes={cartolaData.asumes}
                cambios={cartolaData.cambios}
                permisos={cartolaData.permisos}
                extras={cartolaData.extras}
                salidas={cartolaData.salidas}
                mes={mes}
                ano={ano}
                estamento={estamento}
                servicio={servicioId}
              />
            ) : (
              <p className="text-sm text-gray-500">No se encontró el funcionario</p>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="no-print">
          <Button variant="flat" onPress={() => setCartolaOpen(false)}>
            Cerrar
          </Button>
          <Button
            color="primary"
            onPress={handlePrintCartola}
            startContent={<PrinterIcon className="h-4 w-4" />}
            isDisabled={!cartolaData.funcionario}
          >
            Imprimir
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
}
