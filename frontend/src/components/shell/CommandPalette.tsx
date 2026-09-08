import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { Boxes, FolderKanban, Search, ShieldAlert } from "lucide-react";
import { useSearchMutation } from "../../queries/dashboard";
import { navGroups } from "./navItems";

const STATIC_COMMANDS = navGroups.flatMap((group) => group.items);

const TYPE_ICON = { "AI System": Boxes, Project: FolderKanban, Risk: ShieldAlert };

export function CommandPalette({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const search = useSearchMutation(token);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    const handle = setTimeout(() => search.mutate(trimmed), 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  const results = search.data;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-subtle hover:bg-surface-alt hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-disabled sm:inline">⌘K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global search"
        overlayClassName="fixed inset-0 z-50 bg-black/50"
        contentClassName="fixed left-1/2 top-24 z-[60] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search AI systems, risks, projects, or jump to a page…"
            className="w-full bg-transparent py-3 text-sm text-text placeholder:text-disabled focus:outline-none"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-subtle">No results.</Command.Empty>

          {!query.trim() && (
            <Command.Group heading="Go to" className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-disabled">
              {STATIC_COMMANDS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
                <Command.Item
                  key={item.path}
                  onSelect={() => go(item.path)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-text data-[selected=true]:bg-surface-alt"
                >
                  <item.icon className="h-4 w-4 text-subtle" aria-hidden="true" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results && (
            <>
              {[...results.assets.map((item) => ({ ...item, type: "AI System" as const, path: `/ai-systems/${item.id}` })), ...results.projects.map((item) => ({ ...item, type: "Project" as const, path: `/projects/${item.id}` }))].map((item) => {
                const Icon = TYPE_ICON[item.type];
                return (
                  <Command.Item key={`${item.type}-${item.id}`} onSelect={() => go(item.path)} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-text data-[selected=true]:bg-surface-alt">
                    <span className="flex items-center gap-2 truncate"><Icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />{item.name}</span>
                    <span className="shrink-0 text-xs text-subtle">{item.type}</span>
                  </Command.Item>
                );
              })}
              {results.risks.map((risk) => (
                <Command.Item key={`Risk-${risk.id}`} onSelect={() => go(`/risks/${risk.id}`)} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-text data-[selected=true]:bg-surface-alt">
                  <span className="flex items-center gap-2 truncate"><ShieldAlert className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />{risk.description}</span>
                  <span className="shrink-0 text-xs text-subtle">Risk</span>
                </Command.Item>
              ))}
            </>
          )}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
