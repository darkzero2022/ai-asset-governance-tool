import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { frontendDistDir, mountStaticSite, shouldServeStatic } from "./staticSite.js";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("shouldServeStatic", () => {
  it("honours an explicit SERVE_STATIC flag over NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    process.env.SERVE_STATIC = "false";
    expect(shouldServeStatic()).toBe(false);

    process.env.NODE_ENV = "development";
    process.env.SERVE_STATIC = "true";
    expect(shouldServeStatic()).toBe(true);
  });

  it("defaults to on in production and off otherwise", () => {
    delete process.env.SERVE_STATIC;
    process.env.NODE_ENV = "production";
    expect(shouldServeStatic()).toBe(true);
    process.env.NODE_ENV = "test";
    expect(shouldServeStatic()).toBe(false);
  });
});

describe("frontendDistDir", () => {
  it("resolves FRONTEND_DIST when set", () => {
    process.env.FRONTEND_DIST = "/tmp/some/where";
    expect(frontendDistDir()).toBe(path.resolve("/tmp/some/where"));
  });
});

describe("static site middleware", () => {
  let dist: string;
  let appServing: express.Express;

  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "aibom-dist-"));
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>AI-BOM</title>");
    fs.writeFileSync(path.join(dist, "assets", "app.js"), "console.log('bundle')");

    process.env.SERVE_STATIC = "true";
    process.env.FRONTEND_DIST = dist;

    appServing = express();
    // Same order as app.ts: static site before the API routes, JSON 404 last.
    mountStaticSite(appServing);
    appServing.get("/health", (_req, res) => res.json({ status: "ok" }));
    appServing.get("/risks/:id", (_req, res) => res.json({ id: "risk-from-api" }));
    appServing.get("/assets", (_req, res) => res.json({ list: "assets-from-api" }));
    appServing.use((_req, res) => res.status(404).json({ error: "Not found" }));
  });

  afterAll(() => {
    fs.rmSync(dist, { recursive: true, force: true });
  });

  it("serves hashed bundles from the assets directory", async () => {
    const res = await request(appServing).get("/assets/app.js").expect(200);
    expect(res.text).toContain("bundle");
  });

  it("serves index.html for a browser navigation to a client route", async () => {
    const res = await request(appServing).get("/risks/123").set("Accept", "text/html").expect(200);
    expect(res.text).toContain("<!doctype html>");
  });

  it("lets API clients through to the JSON route on the same path", async () => {
    const res = await request(appServing).get("/risks/123").set("Accept", "application/json").expect(200);
    expect(res.body).toEqual({ id: "risk-from-api" });
  });

  it("always returns the real /health response regardless of Accept", async () => {
    const res = await request(appServing).get("/health").set("Accept", "text/html").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns JSON (not an HTML page) for an unknown API path", async () => {
    const res = await request(appServing).get("/reference/nope").set("Accept", "application/json").expect(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("does not shadow a collection route that shares a name with the assets dir", async () => {
    const res = await request(appServing).get("/assets").set("Accept", "application/json").expect(200);
    expect(res.body).toEqual({ list: "assets-from-api" });
  });
});
