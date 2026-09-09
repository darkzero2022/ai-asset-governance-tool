// Same origin as api/client.ts's apiBaseUrl; inlined to avoid an import cycle.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * The access token lives here (a module variable) — never in localStorage, so it
 * doesn't survive a tab close and isn't sittable at a well-known key for an
 * injected script to grab. The httpOnly `refresh_token` cookie (set by the
 * backend, invisible to JS) is what persists a session across reloads:
 * `refresh()` trades it for a fresh access token.
 *
 * Same subscribable-store shape as components/ui/toastStore.ts so App can keep
 * `ctx.token` in sync without this module holding React state.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();
let inFlightRefresh: Promise<string | null> | null = null;

function emit() {
  for (const listener of listeners) listener(accessToken);
}

export function subscribeSession(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  listener(accessToken);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  emit();
}

export function clearSession(): void {
  accessToken = null;
  emit();
}

/**
 * Trade the httpOnly refresh cookie for a new access token. De-duped: concurrent
 * callers share one in-flight request. Returns the new token, or null when the
 * refresh cookie is missing/expired (→ the caller should show the login screen).
 */
export function refreshSession(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Requested-With": "fetch" },
      });
      if (!response.ok) {
        clearSession();
        return null;
      }
      const body = (await response.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return body.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}
