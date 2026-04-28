/** Fila típica de `public.personal` (campos usados en UI; el resto puede existir). */
export interface PersonalRow {
  id: string;
  nombre?: string | null;
  apellidos?: string | null;
  rut?: string | null;
  turno?: string | null;
  calidad_juridica?: string | null;
  grado?: string | null;
  servicio?: string | null;
  estamento?: string | null;
  jefe_turno?: string | null;
  subrogante?: string | null;
  funcionario_diurno?: string | null;
  curso_iaas?: string | null;
  fecha_curso_iaas?: string | null;
  curso_rcp?: string | null;
  fecha_curso_rcp?: string | null;
}

export interface AsumeRow {
  id: string;
  suplencia_id: string;
  titular_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
  servicio?: string;
  estamento?: string;
  suplencia?: Pick<PersonalRow, "nombre" | "apellidos"> | null;
  titular?: Pick<PersonalRow, "nombre" | "apellidos"> | null;
}

export interface CambioRow {
  id: string;
  hospital_id: string;
  servicio_id: string;
  estamento: string;
  solicitante_id: string;
  cubridor_id: string;
  turno_que_cambia: {
    fecha: string;
    turno: string;
  };
  turno_que_devuelve: {
    fecha: string;
    turno: string;
  };
  motivo: "cambio" | "inversion";
  observaciones?: string | null;
  solicitante?: Pick<PersonalRow, "id" | "nombre" | "apellidos" | "turno"> | null;
  cubridor?: Pick<PersonalRow, "id" | "nombre" | "apellidos" | "turno"> | null;
}

/** Fila agregada en la tabla de gestión de pagos */
export interface TablaPagoRow {
  id: string;
  nombre: string;
  calidad_juridica: string;
  fecha_inicio: string | string[] | null;
  fecha_final: string | string[] | null;
  personalId: string;
}

export type EstadoGestionFila = "en_gestion" | "ticket" | "eliminado";
