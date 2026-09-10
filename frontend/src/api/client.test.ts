import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiClientError, downloadFile } from "./client";
import { clearSession, getAccessToken, setAccessToken } from "../auth/session";

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

  it("does not set a JSON content-type for a FormData body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.txt");

    await apiFetch("/attachments", { method: "POST", body: form });

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });
});

describe("downloadFile", () => {
  // A minimal Response-shaped stub — jsdom's Response can't wrap a Blob.
  function fileResponse(disposition: string | null, status = 200) {
    const blob = { type: "application/pdf" } as Blob;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (h: string) => (h.toLowerCase() === "content-disposition" ? disposition : null),
      },
      blob: async () => blob,
      _blob: blob,
    } as unknown as Response & { _blob: Blob };
  }

  it("fetches with the bearer, names the file from Content-Disposition, and triggers a click", async () => {
    setAccessToken("tok-1");
    const res = fileResponse('attachment; filename="dpa.pdf"');
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res);
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicks: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });

    await downloadFile("/attachments/1/download", "fallback.bin");

    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-1",
    );
    expect(clicks).toEqual(["dpa.pdf"]);
    expect(createUrl).toHaveBeenCalledWith((res as unknown as { _blob: Blob })._blob);
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock");
    clickSpy.mockRestore();
  });

  it("falls back to the given name when there is no Content-Disposition", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(fileResponse(null));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicks: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    await downloadFile("/attachments/1/download", "fallback.bin");
    expect(clicks).toEqual(["fallback.bin"]);
    clickSpy.mockRestore();
  });

  it("throws an ApiClientError on a non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(fileResponse(null, 404));
    await expect(downloadFile("/attachments/x/download", "f.bin")).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });
});
