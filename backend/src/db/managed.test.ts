import { afterEach, describe, expect, it } from "vitest";
import { binariesPackage, resolvePort } from "./managed.js";

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("resolvePort", () => {
  it("prefers MANAGED_PG_PORT", () => {
    expect(resolvePort({ MANAGED_PG_PORT: "6000", DATABASE_URL: "postgresql://u:p@127.0.0.1:5555/db" })).toBe(6000);
  });
  it("falls back to the port in DATABASE_URL", () => {
    expect(resolvePort({ DATABASE_URL: "postgresql://u:p@127.0.0.1:55432/aibom?schema=public" })).toBe(55432);
  });
  it("defaults to 55432", () => {
    expect(resolvePort({})).toBe(55432);
  });
});

describe("binariesPackage", () => {
  it("maps win32 to the windows package", () => {
    expect(binariesPackage("win32", "x64")).toBe("@embedded-postgres/windows-x64");
  });
  it("passes linux/darwin through", () => {
    expect(binariesPackage("linux", "arm64")).toBe("@embedded-postgres/linux-arm64");
    expect(binariesPackage("darwin", "x64")).toBe("@embedded-postgres/darwin-x64");
  });
});
