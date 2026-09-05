import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "../api/client";

// A 401 from any query or mutation should log the user out, same as the old
// central api() wrapper did — but query/mutation hooks call apiFetch directly
// from wherever they're used, not through one App-owned function. This is a
// tiny event bus so App can still react to it in one place without the
// QueryClient (created once, outside React) needing to hold React state.
type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListener = listener;
  return () => {
    if (unauthorizedListener === listener) unauthorizedListener = null;
  };
}

function handleError(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) {
    unauthorizedListener?.();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    // Matches the previous behaviour (no client-side retries — a failed
    // fetch surfaced immediately). Revisit per-query if flaky endpoints
    // turn up.
    queries: { retry: false },
  },
});
