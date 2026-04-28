import React from "react";
import { supabase } from "../lib/supabase";

type MovimientosSyncContextValue = {
  syncVersion: number;
  notifyMovimientosUpdated: () => void;
};

const MovimientosSyncContext = React.createContext<MovimientosSyncContextValue | null>(null);

export function MovimientosSyncProvider({
  children,
  servicioId,
  estamento,
}: {
  children: React.ReactNode;
  servicioId: string;
  estamento: string;
}) {
  const [syncVersion, setSyncVersion] = React.useState(0);

  const notifyMovimientosUpdated = React.useCallback(() => {
    setSyncVersion((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    if (!servicioId || !estamento) return undefined;

    const channel = supabase
      .channel(`movimientos-sync:${servicioId}:${estamento}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cambios", filter: `servicio_id=eq.${servicioId}` },
        () => notifyMovimientosUpdated(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "permisos", filter: `servicio_id=eq.${servicioId}` },
        () => notifyMovimientosUpdated(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "extras", filter: `servicio_id=eq.${servicioId}` },
        () => notifyMovimientosUpdated(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "asumes", filter: `servicio_id=eq.${servicioId}` },
        () => notifyMovimientosUpdated(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "salidas", filter: `servicio_id=eq.${servicioId}` },
        () => notifyMovimientosUpdated(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [estamento, notifyMovimientosUpdated, servicioId]);

  const value = React.useMemo(
    () => ({ syncVersion, notifyMovimientosUpdated }),
    [notifyMovimientosUpdated, syncVersion],
  );

  return <MovimientosSyncContext.Provider value={value}>{children}</MovimientosSyncContext.Provider>;
}

export function useMovimientosSync() {
  const ctx = React.useContext(MovimientosSyncContext);
  if (!ctx) {
    return {
      syncVersion: 0,
      notifyMovimientosUpdated: () => {},
    };
  }
  return ctx;
}

