import cors from "cors";
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { httpLogger, requestContext } from "./middleware/requestContext.js";
import { mountStaticSite, shouldServeStatic } from "./middleware/staticSite.js";
import { mountApiDocs } from "./openapi.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import referenceRouter from "./routes/reference.js";
import assetsRouter from "./routes/assets.js";
import projectsRouter from "./routes/projects.js";
import risksRouter from "./routes/risks.js";
import controlsRouter from "./routes/controls.js";
import auditRouter from "./routes/audit.js";
import searchRouter from "./routes/search.js";
import dashboardRouter from "./routes/dashboard.js";
import reportsRouter from "./routes/reports.js";
import exportsRouter from "./routes/exports.js";

export const app = express();

// When deployed behind a reverse proxy / ingress, set TRUST_PROXY (e.g. "1" for a
// single proxy hop, or a subnet) so express-rate-limit and req.ip see the real
// client address instead of the proxy's. Left off by default for direct local use.
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim());

app.disable("x-powered-by");

// First in the chain: assign a request id (echoed as X-Request-Id) and log one
// structured line per request.
app.use(requestContext);
app.use(httpLogger);

// Baseline security headers. When this process only serves the JSON API the CSP
// is locked all the way down (`default-src 'none'`). When it also serves the
// built SPA (SERVE_STATIC) the same origin has to allow the app's own scripts,
// styles, fonts, images and API calls — still same-origin only, no external
// hosts, matching the frontend's strict CSP posture.
const contentSecurityPolicy = shouldServeStatic()
  ? [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join("; ")
  : "default-src 'none'; frame-ancestors 'none'";

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", contentSecurityPolicy);
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

// Serve the built SPA (when enabled) before the API routes: hashed bundles are
// returned as files and browser navigations to client-router paths get
// index.html ahead of any colliding API route. API/XHR calls fall through.
mountStaticSite(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// All domain endpoints live under /api/v1. /health (above) is the one
// intentional exception, kept unprefixed for infra probes that hit it directly.
const apiV1 = express.Router();
apiV1.use(authRouter);
apiV1.use(usersRouter);
apiV1.use(referenceRouter);
apiV1.use(assetsRouter);
apiV1.use(projectsRouter);
apiV1.use(risksRouter);
apiV1.use(controlsRouter);
apiV1.use(auditRouter);
apiV1.use(searchRouter);
apiV1.use(dashboardRouter);
apiV1.use(reportsRouter);
apiV1.use(exportsRouter);
app.use("/api/v1", apiV1);

// /api/docs (Swagger UI + the raw document) lives outside the versioned prefix
// — it documents the API rather than being an operation on it. Gated by
// ENABLE_API_DOCS (see openapi.ts): on by default outside production.
mountApiDocs(app, apiV1);

// Any unmatched route returns the JSON error envelope, never Express's HTML 404.
app.use(notFoundHandler);
app.use(errorHandler);
