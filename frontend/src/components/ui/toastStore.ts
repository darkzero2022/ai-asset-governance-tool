/**
 * A tiny external store for toasts, so mutation callbacks (including
 * TanStack Query's global MutationCache.onError, which runs outside React)
 * can push a toast from anywhere — same pattern as D2's onUnauthorized bus.
 */
export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

function push(variant: ToastVariant, title: string, description?: string) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
};
