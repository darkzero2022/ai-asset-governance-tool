import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const controlClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text">
      {children}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, hint, id, className, ...props }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <input ref={ref} id={fieldId} className={cn(controlClass, className)} {...props} />
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
});
Input.displayName = "Input";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ label, id, className, ...props }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <textarea ref={ref} id={fieldId} className={cn(controlClass, "min-h-24", className)} {...props} />
    </div>
  );
});
TextArea.displayName = "TextArea";

// A plain, styled native <select>, not a Radix primitive: a native select is
// already fully keyboard/screen-reader accessible on its own, so wrapping it
// in a custom listbox would trade away platform behavior (native mobile
// pickers, type-ahead) for no accessibility gain — Radix is reserved for
// widgets (Dialog, DropdownMenu, Tooltip, Toast) where the native element has
// no equivalent.
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, id, className, children, ...props }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <select ref={ref} id={fieldId} className={cn(controlClass, className)} {...props}>
        {children}
      </select>
    </div>
  );
});
Select.displayName = "Select";
