import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";

export type ComboboxOption = { value: string; label: string };

/** A searchable single-select — for pickers with too many options to scan a plain <select>. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyText = "No matches.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm text-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <span className={cn("truncate", !selected && "text-disabled")}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[--radix-popover-trigger-width] overflow-hidden rounded-md border border-border bg-surface shadow-card"
        >
          <Command loop>
            <Command.Input
              placeholder="Search…"
              className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-disabled focus:outline-none"
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-4 text-center text-sm text-subtle">{emptyText}</Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm text-text",
                    "data-[selected=true]:bg-surface-alt",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
