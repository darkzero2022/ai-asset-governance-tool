import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { logger } from "../log.js";

// Endpoints that must always return their real (non-HTML) response even when the
// caller happens to accept text/html — infra probes hit these, and /api/docs is
// itself an HTML page (Swagger UI) that must not be swallowed by the SPA shell.
const ALWAYS_API_PATHS = new Set(["/health", "/ready"]);
const ALWAYS_API_PREFIXES = ["/api/"];

function isAlwaysApiPath(path: string): boolean {
  return (
    ALWAYS_API_PATHS.has(path) || ALWAYS_API_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

/**
 * Whether this process should serve the built frontend alongside the API.
 * `SERVE_STATIC=true|false` is explicit; otherwise it follows `NODE_ENV`.
 */
export function shouldServeStatic(): boolean {
  const flag = process.env.SERVE_STATIC?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

/**
 * Directory holding the built SPA (`index.html` + `assets/`).
 * `FRONTEND_DIST` overrides; the default assumes the repo layout
 * (`backend/dist/staticSite.js` → `<repo>/frontend/dist`).
 */
export function frontendDistDir(): string {
  if (process.env.FRONTEND_DIST) return path.resolve(process.env.FRONTEND_DIST);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../frontend/dist");
}

function resolvedIndexHtml(): string | null {
  const index = path.join(frontendDistDir(), "index.html");
  return fs.existsSync(index) ? index : null;
}

/** True for a top-level browser navigation (as opposed to an XHR/fetch/API call). */
export function isDocumentNavigation(method: string, acceptHeader: string | undefined): boolean {
  return method === "GET" && (acceptHeader ?? "").includes("text/html");
}

/**
 * Serve the built SPA on the same origin as the API. Registered BEFORE the API
 * routes so that:
 *  - a hashed bundle under `/assets/` is returned as a file, not captured by the
 *    `/assets/:id` API route;
 *  - a browser navigation to any client-router path (`/risks/:id`, `/dashboard`,
 *    …) is answered with `index.html` before the colliding API route can run.
 * XHR/fetch/API callers (no `text/html` in Accept) fall straight through to the
 * API routes and the JSON 404 handler.
 */
export function mountStaticSite(app: express.Express): void {
  if (!shouldServeStatic()) return;
  const index = resolvedIndexHtml();
  if (!index) {
    logger.warn(
      { dir: frontendDistDir() },
      "SERVE_STATIC is enabled but no build was found — the API will run without the SPA",
    );
    return;
  }

  // `redirect: false` stops serve-static from 301-ing `/assets` -> `/assets/`,
  // which would otherwise shadow the `GET /assets` API route.
  app.use(express.static(frontendDistDir(), { index: false, redirect: false, maxAge: "1h" }));

  app.use((req, res, next) => {
    if (isAlwaysApiPath(req.path)) return next();
    if (isDocumentNavigation(req.method, req.headers.accept)) {
      res.sendFile(index);
      return;
    }
    next();
  });
}
