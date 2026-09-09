import { apiErrorCode, apiErrorMessage } from "../lib/apiError";
import { getAccessToken, refreshSession } from "../auth/session";

// Empty by default: the SPA and API share an origin (the backend serves the
// built app, and `vite dev` proxies the API paths). Set VITE_API_BASE_URL only
// when the API lives on a different origin.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// All backend domain endpoints live under /api/v1 (see backend/src/app.ts).
const API_PREFIX = "/api/v1";

/** Thrown by apiFetch for any non-2xx response. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiFetchOptions = RequestInit & {
  /**
   * Kept for call-site compatibility (every query hook still passes `ctx.token`),
   * but the real bearer now comes from the in-memory session store. When the
   * store is empty this falls back to the passed value.
   */
  token?: string;
  /** internal: set when this call is already a post-refresh retry */
  _retried?: boolean;
};

const REFRESHABLE_CODES = new Set(["TOKEN_STALE", "INVALID_TOKEN"]);

/**
 * The one place that calls `fetch` for the API. Sends the httpOnly refresh
 * cookie (`credentials: "include"`), attaches the in-memory access token as a
 * Bearer header, parses the `{ error: { code, message, details } }` envelope
 * into a typed ApiClientError, and on a refreshable 401 silently refreshes the
 * access token once and retries.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, _retried, headers, ...init } = options;
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Content-Type", "application/json");
  mergedHeaders.set("Accept", "application/json");
  const bearer = getAccessToken() ?? token;
  if (bearer) mergedHeaders.set("Authorization", `Bearer ${bearer}`);

  const response = await fetch(`${apiBaseUrl}${API_PREFIX}${path}`, {
    ...init,
    credentials: "include",
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const code = apiErrorCode(body);

    if (
      response.status === 401 &&
      !_retried &&
      !path.startsWith("/auth/") &&
      code &&
      REFRESHABLE_CODES.has(code)
    ) {
      const fresh = await refreshSession();
      if (fresh) return apiFetch<T>(path, { ...options, _retried: true });
    }

    throw new ApiClientError(
      response.status,
      apiErrorMessage(body) ?? response.statusText ?? "Request failed",
      code,
      body && typeof body === "object" && "error" in body
        ? (body as { error?: { details?: unknown } }).error?.details
        : undefined,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
