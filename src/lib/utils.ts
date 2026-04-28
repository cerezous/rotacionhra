/**
 * Indica si la persona es funcionario diurno.
 * Acepta: "sí", "si", "Sí", "SI", "yes", "1", "true" (con o sin acentos).
 */
export const esFuncionarioDiurno = (p) => {
  const val = (p?.funcionario_diurno ?? "").toString().trim().toLowerCase();
  const sinAcentos = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["si", "yes", "1", "true"].includes(sinAcentos);
};
