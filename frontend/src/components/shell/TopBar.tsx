import type { CurrentUser } from "@aibom/shared";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { Badge } from "../ui/Badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/DropdownMenu";
import type { Theme } from "../../theme/useTheme";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";

export function TopBar({
  currentUser,
  token,
  theme,
  onToggleTheme,
  onSignOut,
  onOpenMobileNav,
}: {
  currentUser: CurrentUser | null;
  token: string;
  theme: Theme;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        onClick={onOpenMobileNav}
        className="rounded-md p-1.5 text-subtle hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette token={token} isAdmin={currentUser?.role === "ADMIN"} />

        <button
          onClick={onToggleTheme}
          className="rounded-md p-2 text-subtle hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                {(currentUser?.name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[10rem] truncate sm:inline">{currentUser?.name ?? "Account"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span className="truncate text-sm font-medium normal-case text-text">{currentUser?.name}</span>
                <span className="truncate text-xs normal-case text-subtle">{currentUser?.email}</span>
                {currentUser?.role && <Badge variant="primary" className="w-fit">{currentUser.role}</Badge>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut} className="text-danger focus:bg-danger/10">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
