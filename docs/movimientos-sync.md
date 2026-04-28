# Sincronización de Movimientos

Este proyecto usa una fuente de sincronización común para que los cambios de rotación se reflejen en toda la UI sin lógica duplicada.

## Objetivo

- Mantener consistencia entre `Rotación`, `Modales`, `Cartola` y `Panel de Movimientos`.
- Reducir retrabajo y evitar que un cambio se vea en una pantalla y en otra no.

## Implementación

- Contexto: `src/context/MovimientosSyncContext.tsx`
  - Expone `syncVersion` y `notifyMovimientosUpdated()`.
  - Escucha en tiempo real tablas: `cambios`, `permisos`, `extras`, `asumes`, `salidas` (Supabase Realtime).
- Provider activo en `src/components/Enfermeria.tsx` para compartir estado entre pestañas.
- `src/components/RotacionEnfermeria.tsx`
  - Refresca datos al cambiar `syncVersion`.
  - Después de guardar/eliminar movimientos usa `notifyMovimientosUpdated()` para propagación inmediata.
- `src/components/FichaFuncionarioCartolas.tsx`
  - Reconsulta datos de cartola cuando `syncVersion` cambia.

## Regla de desarrollo

Cuando se agregue un flujo nuevo que modifique movimientos:

1. Guardar en BD.
2. Refrescar datos locales del módulo.
3. Llamar `notifyMovimientosUpdated()`.
4. Si el cambio usa nuevas tablas de movimientos, agregarlas al canal del context.

