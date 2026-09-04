import { apiErrorCode, apiErrorMessage } from "../lib/apiError";

// Empty by default: the SPA and API share an origin (the backend serves the
// built app, and `vite dev` proxies the API paths). Set VITE_API_BASE_URL only
// when the API lives on a different origin.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

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
  /** Bearer token for Authorization. Omit for unauthenticated calls. */
  token?: string;
};

/**
 * The one place that calls `fetch` for the API. Attaches Accept/Content-Type
 * and the bearer token, parses the `{ error: { code, message, details } }`
 * envelope on failure into a typed ApiClientError, and returns typed JSON.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...init } = options;
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Content-Type", "application/json");
  mergedHeaders.set("Accept", "application/json");
  if (token) mergedHeaders.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: mergedHeaders });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiClientError(
      response.status,
      apiErrorMessage(body) ?? response.statusText ?? "Request failed",
      apiErrorCode(body),
      body && typeof body === "object" && "error" in body
        ? (body as { error?: { details?: unknown } }).error?.details
        : undefined,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
