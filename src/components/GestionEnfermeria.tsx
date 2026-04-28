import React from "react";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import TablaPagos from "./TablaPagos";

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

const getFechaActual = () => {
  const d = new Date();
  return { mes: String(d.getMonth() + 1), ano: String(d.getFullYear()) };
};

const getAnos = () => {
  const y = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => y - 1 + i);
};

export default function GestionEnfermeria({
  titulo = "Gestión Enfermería",
  servicioId = "",
  estamento = "enfermeria",
}) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [{ mes, ano }, setFecha] = React.useState(getFechaActual);

  const mesLabel = MESES.find((m) => m.value === mes)?.label ?? mes;

  const handleAplicar = () => setPopoverOpen(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.375rem] font-semibold leading-[1.2] tracking-tight text-neutral-900 sm:text-[1.5rem]">{titulo}</h2>
        <Popover isOpen={popoverOpen} onOpenChange={setPopoverOpen} placement="bottom-end">
          <PopoverTrigger>
            <Button
              size="sm"
              variant="flat"
              className="min-w-0 px-3"
              startContent={<CalendarDaysIcon className="h-4 w-4" />}
            >
              <span className="text-xs">{mesLabel} {ano}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 min-w-40 p-2">
            <div className="flex flex-col gap-2 w-full">
              <div>
                <label className="text-small text-foreground block mb-1">Mes</label>
                <select
                  value={mes}
                  onChange={(e) => setFecha((prev) => ({ ...prev, mes: e.target.value }))}
                  className="w-full h-8 px-2 rounded-small bg-default-100 text-small border-0 outline-none focus:ring-1 focus:ring-default-400"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-small text-foreground block mb-1">Año</label>
                <select
                  value={ano}
                  onChange={(e) => setFecha((prev) => ({ ...prev, ano: e.target.value }))}
                  className="w-full h-8 px-2 rounded-small bg-default-100 text-small border-0 outline-none focus:ring-1 focus:ring-default-400"
                >
                  {getAnos().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" onPress={handleAplicar}>Aplicar</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <TablaPagos servicioId={servicioId} estamento={estamento} mes={mes} ano={ano} />
    </div>
  );
}
