import { useState, type ReactNode } from "react";
import type { CurrentUser } from "@aibom/shared";
import type { Theme } from "../../theme/useTheme";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

const COLLAPSE_KEY = "aibom-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({
  currentUser,
  token,
  theme,
  onToggleTheme,
  onSignOut,
  children,
}: {
  currentUser: CurrentUser | null;
  token: string;
  theme: Theme;
  onToggleTheme: () => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <SideNav
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        isAdmin={currentUser?.role === "ADMIN"}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          currentUser={currentUser}
          token={token}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSignOut={onSignOut}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
