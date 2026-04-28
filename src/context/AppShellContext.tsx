import React from "react";
import type { User } from "@supabase/supabase-js";
import type { UsuarioProfile } from "../types";

export const MOBILE_APP_HEADER_PX = 56;
export const SUBMENU_TOP_NAV_PX = 56;

export type AppShellContextValue = {
  sidebarWidth: number;
  isMd: boolean;
  mobileHeaderHeight: number;
  authUser: User | null;
  currentUser: UsuarioProfile | null;
};

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function AppShellProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppShellContextValue;
}) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell debe usarse dentro de AppShellProvider");
  }
  return ctx;
}

/** Padding superior del área scrollable bajo la nav fija de submenús */
export function useSubmenuContentPaddingTop() {
  const { isMd, mobileHeaderHeight } = useAppShell();
  return isMd ? SUBMENU_TOP_NAV_PX : mobileHeaderHeight + SUBMENU_TOP_NAV_PX;
}
