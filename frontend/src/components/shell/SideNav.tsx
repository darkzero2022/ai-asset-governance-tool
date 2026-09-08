import { ChevronsLeft, ChevronsRight, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Tooltip } from "../ui/Tooltip";
import { navGroups } from "./navItems";

export function SideNav({
  collapsed,
  onToggleCollapsed,
  isAdmin,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isAdmin: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const content = (
    <nav className="flex h-full flex-col" aria-label="Primary">
      <div className={cn("flex h-14 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <ShieldCheck className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        {!collapsed && <span className="truncate text-sm font-semibold text-text">AI-BOM Governance</span>}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-4 px-2">
              {!collapsed && <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-disabled">{group.label}</p>}
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <NavLinkItem item={item} collapsed={collapsed} onNavigate={onCloseMobile} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <button
          onClick={onToggleCollapsed}
          className="hidden w-full items-center justify-center gap-2 rounded-md p-2 text-subtle hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <aside
        className={cn("hidden shrink-0 border-r border-border bg-surface transition-[width] duration-150 lg:block", collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded")}
      >
        {content}
      </aside>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/50" onClick={onCloseMobile} />
          <aside className="relative h-full w-sidebar-expanded animate-in slide-in-from-left bg-surface shadow-card">{content}</aside>
        </div>
      )}
    </>
  );
}

function NavLinkItem({ item, collapsed, onNavigate }: { item: (typeof navGroups)[number]["items"][number]; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-subtle transition-colors hover:bg-surface-alt hover:text-text",
          collapsed && "justify-center px-0",
          isActive && "bg-primary/12 text-primary hover:bg-primary/12 hover:text-primary",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;
  return <Tooltip label={item.label}>{link}</Tooltip>;
}
