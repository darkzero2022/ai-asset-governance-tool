import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiClientError } from "./client";
import { clearSession, getAccessToken } from "../auth/session";

afterEach(() => {
  vi.restoreAllMocks();
  clearSession();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch — silent token refresh", () => {
  it("refreshes once on a TOKEN_STALE 401, then retries the original request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "TOKEN_STALE", message: "stale" } }, 401),
      ) // original
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-token" }, 200)) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)); // retry

    const result = await apiFetch<{ ok: boolean }>("/risks");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/auth/refresh");
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("does not retry when the refresh itself fails", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "TOKEN_STALE", message: "stale" } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHENTICATED" } }, 401)); // refresh fails

    await expect(apiFetch("/risks")).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never tries to refresh for /auth/* calls", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "INVALID_CREDENTIALS", message: "no" } }, 401),
      );

    await expect(apiFetch("/auth/login", { method: "POST" })).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
