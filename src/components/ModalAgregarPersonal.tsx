import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Checkbox,
  Form,
} from "@heroui/react";

const CALIDAD_JURIDICA_OPCIONES = [
  { value: "titular", label: "Titular" },
  { value: "contrata", label: "Contrata" },
  { value: "suplencia", label: "Suplencia" },
  { value: "honorario", label: "Honorario" },
  { value: "externo", label: "Externo a Unidad" },
];

const TURNO_OPCIONES = ["A", "B", "C", "D"];

const inputClassNames = {
  inputWrapper: "border-0 shadow-none bg-default-100",
};

const selectClassNames = {
  trigger: "border-0 shadow-none bg-default-100",
};

const labelClass = "text-small text-foreground pb-1 block";

function formatRut(value) {
  const cleaned = value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (!cleaned) return "";
  const digits = cleaned.replace(/[^0-9]/g, "");
  const endsWithK = cleaned.endsWith("K");
  let body = digits.slice(0, 8);
  let dv = "";
  if (digits.length >= 8 && digits.length === 9) {
    dv = digits[8];
  } else if (digits.length === 8 && endsWithK) {
    dv = "K";
  }
  if (dv) body = digits.slice(0, 8);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dv ? `${formatted}-${dv}` : formatted;
}

const toSiNo = (v) => {
  const s = (v || "").toString().toLowerCase();
  return s === "sí" || s === "si" || s === "yes";
};

const toDateInput = (s) => {
  if (!s) return "";
  const d = new Date(s + "T12:00:00");
  return d.toISOString().slice(0, 10);
};

export default function ModalAgregarPersonal({ isOpen, onClose, onSuccess, loading = false, editingPersonal = null }) {
  const [turno, setTurno] = React.useState("");
  const [calidadJuridica, setCalidadJuridica] = React.useState("");
  const [grado, setGrado] = React.useState("");
  const [cursoIaas, setCursoIaas] = React.useState(false);
  const [cursoRcp, setCursoRcp] = React.useState(false);
  const [jefeTurno, setJefeTurno] = React.useState(false);
  const [subrogante, setSubrogante] = React.useState(false);
  const [funcionarioDiurno, setFuncionarioDiurno] = React.useState(false);
  const [rut, setRut] = React.useState("");

  React.useEffect(() => {
    if (editingPersonal && isOpen) {
      setTurno(editingPersonal.turno || "");
      setCalidadJuridica(editingPersonal.calidad_juridica || "");
      setGrado(editingPersonal.grado || "");
      setRut(editingPersonal.rut || "");
      setCursoIaas(toSiNo(editingPersonal.curso_iaas));
      setCursoRcp(toSiNo(editingPersonal.curso_rcp));
      setJefeTurno(toSiNo(editingPersonal.jefe_turno));
      setSubrogante(toSiNo(editingPersonal.subrogante));
      setFuncionarioDiurno(toSiNo(editingPersonal.funcionario_diurno));
    } else if (!isOpen) {
      setTurno("");
      setCalidadJuridica("");
      setGrado("");
      setRut("");
      setCursoIaas(false);
      setCursoRcp(false);
      setJefeTurno(false);
      setSubrogante(false);
      setFuncionarioDiurno(false);
    }
  }, [editingPersonal, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    data.turno = turno;
    data.calidad_juridica = calidadJuridica;
    data.grado = grado?.trim() || null;
    data.curso_iaas = cursoIaas ? "sí" : "no";
    data.curso_rcp = cursoRcp ? "sí" : "no";
    data.jefe_turno = jefeTurno ? "sí" : "no";
    data.subrogante = subrogante ? "sí" : "no";
    data.funcionario_diurno = funcionarioDiurno ? "sí" : "no";
    if (editingPersonal?.id) data.id = editingPersonal.id;
    try {
      await onSuccess?.(data);
      handleClose();
    } catch (_) {
      // Error mostrado por el padre
    }
  };

  const handleClose = () => {
    setTurno("");
    setCalidadJuridica("");
    setGrado("");
    setRut("");
    setCursoIaas(false);
    setCursoRcp(false);
    setJefeTurno(false);
    setSubrogante(false);
    setFuncionarioDiurno(false);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-sm font-semibold">
          {editingPersonal ? "Editar personal" : "Agregar personal"}
        </ModalHeader>
        <ModalBody>
          <Form key={editingPersonal?.id ?? "new"} onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="flex w-full flex-col gap-4">
              <Input
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                label="Nombre"
                labelPlacement="outside"
                name="nombre"
                placeholder="Ingrese nombre"
                className="w-full"
                defaultValue={editingPersonal?.nombre ?? ""}
              />
              <Input
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                label="Apellidos"
                labelPlacement="outside"
                name="apellidos"
                placeholder="Ingrese apellidos"
                className="w-full"
                defaultValue={editingPersonal?.apellidos ?? ""}
              />
              <Input
                size="sm"
                variant="flat"
                radius="sm"
                classNames={inputClassNames}
                label="Rut"
                labelPlacement="outside"
                name="rut"
                placeholder="Ej: 12.345.678-9"
                className="w-full"
                value={rut}
                onValueChange={(v) => setRut(formatRut(v))}
              />
            </div>

            <Select
              size="sm"
              variant="flat"
              radius="sm"
              classNames={selectClassNames}
              label="Calidad jurídica"
              labelPlacement="outside"
              placeholder="Seleccione calidad jurídica"
              selectedKeys={calidadJuridica ? [calidadJuridica] : []}
              onSelectionChange={(keys) => setCalidadJuridica(String([...keys][0] ?? ""))}
              className="w-full"
            >
              {CALIDAD_JURIDICA_OPCIONES.map(({ value, label }) => (
                <SelectItem key={value}>{label}</SelectItem>
              ))}
            </Select>

            <Input
              size="sm"
              variant="flat"
              radius="sm"
              classNames={inputClassNames}
              label="Grado"
              labelPlacement="outside"
              name="grado"
              placeholder="Ej: 1°, 2°, etc."
              className="w-full"
              value={grado}
              onValueChange={setGrado}
            />

            <div className="flex w-full flex-col gap-2">
              <label className={labelClass}>Curso IAAS</label>
              <Checkbox
                size="sm"
                isSelected={cursoIaas}
                onValueChange={setCursoIaas}
                classNames={{ label: "text-xs" }}
              >
                Sí
              </Checkbox>
              {cursoIaas && (
                <Input
                  size="sm"
                  variant="flat"
                  radius="sm"
                  classNames={inputClassNames}
                  label="Fecha Curso IAAS"
                  labelPlacement="outside"
                  name="fecha_curso_iaas"
                  type="date"
                  placeholder="dd/mm/aaaa"
                  className="w-full"
                  defaultValue={toDateInput(editingPersonal?.fecha_curso_iaas)}
                />
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              <label className={labelClass}>Curso RCP</label>
              <Checkbox
                size="sm"
                isSelected={cursoRcp}
                onValueChange={setCursoRcp}
                classNames={{ label: "text-xs" }}
              >
                Sí
              </Checkbox>
              {cursoRcp && (
                <Input
                  size="sm"
                  variant="flat"
                  radius="sm"
                  classNames={inputClassNames}
                  label="Fecha Curso RCP"
                  labelPlacement="outside"
                  name="fecha_curso_rcp"
                  type="date"
                  placeholder="dd/mm/aaaa"
                  className="w-full"
                  defaultValue={toDateInput(editingPersonal?.fecha_curso_rcp)}
                />
              )}
            </div>

            <div className="w-full">
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass}>Turno</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {TURNO_OPCIONES.map((t) => {
                  const activo = turno === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTurno((prev) => (prev === t ? "" : t))}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                        activo
                          ? "border-primary bg-primary text-white"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Jefe/a de Turno</label>
                <Checkbox
                  size="sm"
                  isSelected={jefeTurno}
                  onValueChange={setJefeTurno}
                  classNames={{ label: "text-xs" }}
                >
                  Sí
                </Checkbox>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Subrogante</label>
                <Checkbox
                  size="sm"
                  isSelected={subrogante}
                  onValueChange={setSubrogante}
                  classNames={{ label: "text-xs" }}
                >
                  Sí
                </Checkbox>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Funcionario Diurno</label>
                <Checkbox
                  size="sm"
                  isSelected={funcionarioDiurno}
                  onValueChange={setFuncionarioDiurno}
                  classNames={{ label: "text-xs" }}
                >
                  Sí
                </Checkbox>
              </div>
            </div>

            <ModalFooter className="px-0">
              <Button size="sm" variant="flat" onPress={handleClose}>
                Cancelar
              </Button>
              <Button size="sm" color="primary" type="submit" isLoading={loading}>
                Guardar
              </Button>
            </ModalFooter>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
