import React from "react";
import { Tooltip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@heroui/react";
import { PlusIcon, CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon, PrinterIcon } from "@heroicons/react/24/solid";
import { EyeIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import ModalAgregarPersonal from "./ModalAgregarPersonal";
import FichaFuncionario from "./FichaFuncionario";
import CartolaFuncionario from "./CartolaFuncionario";
import { supabase } from "../lib/supabase";

const formatFecha = (s) => {
  if (!s) return null;
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const COLUMNS_ALL = [
  { key: "turno", label: "Turno" },
  { key: "nombre", label: "Nombre" },
  { key: "rut", label: "RUT" },
  { key: "calidad_juridica", label: "Calidad jurídica" },
  { key: "grado", label: "Grado" },
  { key: "jefe_turno", label: "Jefe/a turno" },
  { key: "subrogante", label: "Subrogante" },
  { key: "funcionario_diurno", label: "Func. diurno" },
  { key: "curso_iaas", label: "IAAS" },
  { key: "curso_rcp", label: "RCP" },
  { key: "acciones", label: "Acciones" },
] as const;

const TH_BASE = "px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 sm:text-xs";
const TD_BASE = "align-middle px-2 py-2 text-xs leading-snug text-neutral-800 sm:text-sm";

/** Layout automático: columnas ceñidas al contenido; nombre con espacio flexible; una sola línea por fila. */
const cellLayout = (key: (typeof COLUMNS_ALL)[number]["key"]) => {
  const nowrap = "whitespace-nowrap";
  switch (key) {
    case "turno":
      return {
        th: `${TH_BASE} ${nowrap} min-w-[4rem] text-center`,
        td: `${TD_BASE} ${nowrap} min-w-[4rem] text-center tabular-nums`,
      };
    case "nombre":
      return {
        th: `${TH_BASE} text-left min-w-[7.5rem]`,
        td: `${TD_BASE} min-w-[8.5rem] max-w-[min(18rem,40vw)] text-left`,
      };
    case "rut":
      return { th: `${TH_BASE} ${nowrap} w-px text-center`, td: `${TD_BASE} ${nowrap} text-center tabular-nums` };
    case "calidad_juridica":
      return { th: `${TH_BASE} ${nowrap} w-px text-center`, td: `${TD_BASE} ${nowrap} text-center` };
    case "grado":
      return { th: `${TH_BASE} ${nowrap} w-px text-center`, td: `${TD_BASE} ${nowrap} text-center` };
    case "jefe_turno":
    case "subrogante":
    case "funcionario_diurno":
      return { th: `${TH_BASE} ${nowrap} w-px text-center`, td: `${TD_BASE} ${nowrap} text-center` };
    case "curso_iaas":
    case "curso_rcp":
      return {
        th: `${TH_BASE} ${nowrap} min-w-[4rem] text-center`,
        td: `${TD_BASE} ${nowrap} min-w-[4rem] text-center`,
      };
    case "acciones":
      return { th: `${TH_BASE} ${nowrap} min-w-[9rem] w-[9rem] text-center`, td: `${TD_BASE} ${nowrap} min-w-[9rem] w-[9rem] text-center` };
    default:
      return { th: `${TH_BASE} ${nowrap} text-center`, td: `${TD_BASE} ${nowrap} text-center` };
  }
};

export default function PersonalEnfermeria({
  servicio = "uti",
  servicioId = "",
  hospitalId = "",
  estamento = "enfermeria",
  titulo = "Personal Enfermería",
  mes: mesCartolaProp,
  ano: anoCartolaProp,
}) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingPersonal, setEditingPersonal] = React.useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [personToDelete, setPersonToDelete] = React.useState(null);
  const [viewingFuncionario, setViewingFuncionario] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [personal, setPersonal] = React.useState([]);
  const [busqueda, setBusqueda] = React.useState("");
  const [cartolaOpen, setCartolaOpen] = React.useState(false);
  const [cartolaLoading, setCartolaLoading] = React.useState(false);
  const [cartolaData, setCartolaData] = React.useState({ funcionario: null, personal: [], asumes: [], cambios: [], permisos: [], extras: [], salidas: [] });
  const [cartolaMesAno, setCartolaMesAno] = React.useState({ mes: "1", ano: String(new Date().getFullYear()) });
  const cartolaPrintRef = React.useRef(null);

  const fetchPersonal = React.useCallback(async () => {
    const { data, error: err } = await supabase
      .from("personal")
      .select("*")
      .eq("servicio_id", servicioId)
      .eq("estamento", estamento)
      .order("turno", { ascending: true })
      .order("jefe_turno", { ascending: false })
      .order("subrogante", { ascending: false });
    if (!err) setPersonal(data || []);
  }, [servicioId, estamento]);

  React.useEffect(() => {
    fetchPersonal();
  }, [fetchPersonal]);

  const handleAgregar = () => {
    setEditingPersonal(null);
    setModalOpen(true);
  };

  const handleVer = (row) => {
    setViewingFuncionario(row);
  };
  const handleEditar = (row) => {
    setEditingPersonal(row);
    setModalOpen(true);
  };
  const handleEliminarClick = (row) => {
    setPersonToDelete(row);
    setConfirmDeleteOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!personToDelete) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.from("personal").delete().eq("id", personToDelete.id);
      if (err) throw new Error(err.message);
      setConfirmDeleteOpen(false);
      setPersonToDelete(null);
      await fetchPersonal();
    } catch (e) {
      setError(e?.message || "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarSuccess = async (data) => {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        nombre: data.nombre?.trim() || null,
        apellidos: data.apellidos?.trim() || null,
        rut: data.rut?.trim() || null,
        calidad_juridica: data.calidad_juridica || null,
        grado: data.grado?.trim() || null,
        turno: data.turno || null,
        jefe_turno: data.jefe_turno || null,
        subrogante: data.subrogante || null,
        funcionario_diurno: data.funcionario_diurno || null,
        curso_iaas: data.curso_iaas || null,
        fecha_curso_iaas: data.fecha_curso_iaas || null,
        curso_rcp: data.curso_rcp || null,
        fecha_curso_rcp: data.fecha_curso_rcp || null,
      };
      if (data.id) {
        const { error: err } = await supabase.from("personal").update(payload).eq("id", data.id);
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await supabase.from("personal").insert({ ...payload, hospital_id: hospitalId, servicio_id: servicioId, estamento });
        if (err) throw new Error(err.message);
      }
      setModalOpen(false);
      setEditingPersonal(null);
      await fetchPersonal();
    } catch (e) {
      setError(e?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = React.useCallback(
    async (row) => {
      const d = new Date();
      const mesUse = mesCartolaProp ?? String(d.getMonth() + 1);
      const anoUse = anoCartolaProp ?? String(d.getFullYear());
      setCartolaMesAno({ mes: mesUse, ano: anoUse });
      setCartolaOpen(true);
      setCartolaLoading(true);
      setCartolaData({ funcionario: null, personal: [], asumes: [], cambios: [], permisos: [], extras: [], salidas: [] });
      try {
        const personaId = row.id;
        const [resPersonal, resAsumes, resCambios, resPermisos, resExtras, resSalidas] = await Promise.all([
          supabase.from("personal").select("*").eq("id", personaId).single(),
          supabase
            .from("asumes")
            .select(`
          *,
          suplencia:personal!suplencia_id(id, nombre, apellidos)
        `)
            .eq("servicio_id", servicioId)
            .eq("estamento", estamento),
          supabase
            .from("cambios")
            .select("*")
            .eq("servicio_id", servicioId)
            .eq("estamento", estamento),
          supabase
            .from("permisos")
            .select("*")
            .eq("servicio_id", servicioId)
            .eq("estamento", estamento)
            .eq("solicitante_id", personaId),
          supabase
            .from("extras")
            .select("*")
            .eq("servicio_id", servicioId)
            .eq("estamento", estamento),
          supabase
            .from("salidas")
            .select("*")
            .eq("servicio_id", servicioId)
            .eq("estamento", estamento)
            .eq("solicitante_id", personaId),
        ]);
        const { data: personalAll } = await supabase.from("personal").select("*").eq("servicio_id", servicioId).eq("estamento", estamento);
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
    },
    [servicioId, estamento, mesCartolaProp, anoCartolaProp],
  );

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

  const SI_NO_KEYS = ["jefe_turno", "subrogante", "funcionario_diurno", "curso_iaas", "curso_rcp"];

  const columns = React.useMemo(
    () =>
      estamento === "kinesiologia"
        ? COLUMNS_ALL.filter((c) => c.key !== "funcionario_diurno")
        : [...COLUMNS_ALL],
    [estamento],
  );

  const textoBusqueda = (busqueda || "").trim().toLowerCase();
  const personalFiltrado = textoBusqueda
    ? personal.filter((row) => {
        const nombreCompleto = [row.nombre, row.apellidos].filter(Boolean).join(" ").toLowerCase();
        const rut = (row.rut || "").toLowerCase();
        const turno = (row.turno || "").toLowerCase();
        const calidad = (row.calidad_juridica || "").toLowerCase();
        const grado = (row.grado || "").toString().toLowerCase();
        return (
          nombreCompleto.includes(textoBusqueda) ||
          rut.includes(textoBusqueda) ||
          turno.includes(textoBusqueda) ||
          calidad.includes(textoBusqueda) ||
          grado.includes(textoBusqueda)
        );
      })
    : personal;

  const renderCell = (row, col) => {
    if (col.key === "nombre") {
      const val = [row.nombre, row.apellidos].filter(Boolean).join(" ") || "—";
      return (
        <span className="inline-block min-w-0 max-w-full truncate font-medium text-neutral-900" title={val}>
          {val}
        </span>
      );
    }
    if (SI_NO_KEYS.includes(col.key)) {
      const val = (row[col.key] || "").toLowerCase();
      const isSi = val === "sí" || val === "si" || val === "yes";
      const isCurso = col.key === "curso_iaas" || col.key === "curso_rcp";
      const fechaKey = col.key === "curso_iaas" ? "fecha_curso_iaas" : col.key === "curso_rcp" ? "fecha_curso_rcp" : null;
      const fechaStr = fechaKey && row[fechaKey] ? formatFecha(row[fechaKey]) : null;
      const icon = isSi ? (
        <CheckCircleIcon className="inline-block h-4 w-4 text-emerald-500 sm:h-5 sm:w-5" aria-hidden />
      ) : (
        <XCircleIcon
          className={`inline-block h-4 w-4 sm:h-5 sm:w-5 ${isCurso ? "text-red-500" : "text-gray-300"}`}
          aria-hidden
        />
      );
      if (isCurso) {
        const content = isSi ? (fechaStr ? `Fecha: ${fechaStr}` : "Sin fecha registrada") : "No tiene curso";
        return (
          <Tooltip content={content} delay={200} closeDelay={0}>
            <span className="inline-block cursor-default">{icon}</span>
          </Tooltip>
        );
      }
      return icon;
    }
    if (col.key === "calidad_juridica") {
      const v = (row[col.key] || "").trim();
      return v ? (
        <span className="text-neutral-800">{v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()}</span>
      ) : (
        "—"
      );
    }
    if (col.key === "grado") return <span className="text-neutral-800">{row.grado ?? "—"}</span>;
    if (col.key === "rut") return <span className="tabular-nums text-neutral-800">{row.rut?.trim() || "—"}</span>;
    if (col.key === "turno") return <span className="font-medium text-neutral-900">{row.turno ?? "—"}</span>;
    if (col.key === "acciones") {
      return (
        <div className="inline-flex flex-nowrap items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleVer(row); }}
            className="shrink-0 rounded p-1 text-blue-600 transition-colors hover:bg-blue-50"
            title="Ver"
            aria-label="Ver"
          >
            <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEditar(row); }}
            className="shrink-0 rounded p-1 text-amber-600 transition-colors hover:bg-amber-50"
            title="Editar"
            aria-label="Editar"
          >
            <PencilSquareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEliminarClick(row); }}
            className="shrink-0 rounded p-1 text-red-600 transition-colors hover:bg-red-50"
            title="Eliminar"
            aria-label="Eliminar"
          >
            <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleImprimir(row); }}
            className="shrink-0 rounded p-1 text-neutral-800 transition-colors hover:bg-neutral-100"
            title="Imprimir cartola funcionario"
            aria-label="Imprimir cartola funcionario"
          >
            <PrinterIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      );
    }
    const raw = row[col.key];
    return raw != null && String(raw).trim() !== "" ? (
      <span className="text-neutral-800">{String(raw)}</span>
    ) : (
      "—"
    );
  };

  if (viewingFuncionario) {
    return (
      <FichaFuncionario
        funcionario={viewingFuncionario}
        onVolver={() => setViewingFuncionario(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-[1.2] tracking-tight text-neutral-900 sm:text-[1.625rem]">{titulo}</h2>
        <button
          type="button"
          onClick={handleAgregar}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors shrink-0"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="flex justify-start">
        <Input
          type="search"
          placeholder="Buscar por nombre, RUT, turno..."
          value={busqueda}
          onValueChange={setBusqueda}
          size="sm"
          classNames={{ input: "text-sm sm:text-base" }}
          className="max-w-md"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />}
          isClearable
          onClear={() => setBusqueda("")}
          aria-label="Buscar en la tabla"
        />
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/90">
              {columns.map((col) => {
                const align = col.key === "nombre" ? "text-left" : "text-center";
                const w =
                  col.key === "turno"
                    ? "min-w-[4rem] w-[4rem]"
                    : col.key === "nombre"
                      ? "min-w-0 w-[18%]"
                      : col.key === "rut"
                        ? "w-[6.5rem]"
                        : col.key === "calidad_juridica"
                          ? "w-[11%]"
                          : col.key === "grado"
                            ? "w-[8%]"
                            : col.key === "acciones"
                              ? "w-[9rem]"
                              : col.key === "curso_iaas" || col.key === "curso_rcp"
                                ? "min-w-[4rem] w-[4rem]"
                                : "";
                return (
                  <th
                    key={col.key}
                    className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 ${align} ${w}`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {personalFiltrado.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-neutral-400">
                  {personal.length === 0 ? "No hay personal registrado" : "No hay resultados para la búsqueda"}
                </td>
              </tr>
            ) : (
              personalFiltrado.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-neutral-50/80">
                  {columns.map((col) => {
                    const align = col.key === "nombre" ? "text-left" : "text-center";
                    const w =
                      col.key === "turno"
                        ? "min-w-[4rem] w-[4rem]"
                        : col.key === "nombre"
                          ? "min-w-0"
                          : col.key === "rut"
                            ? "w-[6.5rem] tabular-nums"
                            : col.key === "curso_iaas" || col.key === "curso_rcp"
                              ? "min-w-[4rem] w-[4rem]"
                              : col.key === "acciones"
                                ? "w-[9rem]"
                                : "";
                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-2 align-middle text-xs leading-snug text-neutral-800 sm:text-sm ${align} ${w}`}
                      >
                        {renderCell(row, col)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <ModalAgregarPersonal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPersonal(null); }}
        onSuccess={handleAgregarSuccess}
        loading={loading}
        editingPersonal={editingPersonal}
      />
      <Modal isOpen={confirmDeleteOpen} onClose={() => { setConfirmDeleteOpen(false); setPersonToDelete(null); }} size="sm">
        <ModalContent>
          <ModalHeader className="text-sm font-semibold">¿Eliminar personal?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              ¿Está seguro que desea eliminar a{" "}
              <strong>{personToDelete ? [personToDelete.nombre, personToDelete.apellidos].filter(Boolean).join(" ") : ""}</strong>?
              Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="flat" onPress={() => { setConfirmDeleteOpen(false); setPersonToDelete(null); }}>
              Cancelar
            </Button>
            <Button size="sm" color="danger" onPress={handleConfirmDelete} isLoading={loading}>
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
                  mes={cartolaMesAno.mes}
                  ano={cartolaMesAno.ano}
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
    </div>
  );
}
