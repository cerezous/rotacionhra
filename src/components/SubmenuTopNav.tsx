import React from "react";
import { useAppShell } from "../context/AppShellContext";

const TABS = [
  { id: "rotacion", label: "Rotación" },
  { id: "personal", label: "Personal" },
  { id: "gestion", label: "Gestión" },
] as const;

function getInitials(currentUser: { nombre?: string | null; apellidos?: string | null } | null, email: string | null | undefined) {
  if (currentUser?.nombre || currentUser?.apellidos) {
    const n = (currentUser.nombre || "").trim();
    const a = (currentUser.apellidos || "").trim();
    const i1 = n.charAt(0);
    const i2 = a.split(/\s+/).filter(Boolean)[0]?.charAt(0) || a.charAt(0) || "";
    const s = `${i1}${i2}`.toUpperCase();
    if (s) return s.slice(0, 2);
  }
  if (email) {
    const local = email.split("@")[0] || "";
    return local.slice(0, 2).toUpperCase() || "?";
  }
  return "?";
}

type SubmenuTopNavProps = {
  activeTab: string;
  onTabChange: (id: string) => void;
};

export default function SubmenuTopNav({ activeTab, onTabChange }: SubmenuTopNavProps) {
  const { sidebarWidth, isMd, mobileHeaderHeight, currentUser, authUser } = useAppShell();
  const top = isMd ? 0 : mobileHeaderHeight;
  const initials = getInitials(currentUser, authUser?.email ?? null);

  return (
    <nav
      className="fixed z-35 grid h-14 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-neutral-200 bg-white/95 px-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-backdrop-filter:bg-white/85 md:px-4"
      style={{
        left: isMd ? sidebarWidth : 0,
        right: 0,
        top,
      }}
      aria-label="Subsecciones"
    >
      <span className="min-w-0" aria-hidden />
      <div className="flex max-w-full justify-center gap-1 overflow-x-auto py-1 md:gap-2">
        {TABS.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 justify-end pr-0.5 md:pr-0">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold tracking-tight text-neutral-900"
          title={
            currentUser
              ? `${currentUser.nombre ?? ""} ${currentUser.apellidos ?? ""}`.trim() || authUser?.email || ""
              : authUser?.email || ""
          }
        >
          {initials}
        </div>
      </div>
    </nav>
  );
}
