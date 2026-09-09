import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// The SPA and API share an origin in every deployment mode (the backend serves
// the built app in production). In `vite dev`/`preview` we reproduce that by
// proxying the API path prefixes to the backend. Every domain endpoint lives
// under /api/v1 (see backend/src/app.ts), which no longer collides with any
// client-router path, plus the two unprefixed infra probes.
const API_PREFIXES = ["/health", "/ready", "/api/v1"];

const backendTarget = process.env.VITE_DEV_API_TARGET ?? `http://localhost:${process.env.PORT || 4000}`;
const devPort = Number(process.env.FRONTEND_PORT) || 5173;

const apiProxy: Record<string, ProxyOptions> = Object.fromEntries(
  API_PREFIXES.map((prefix) => [
    prefix,
    {
      target: backendTarget,
      changeOrigin: true,
      bypass: (req) => {
        if (req.method === "GET" && (req.headers.accept ?? "").includes("text/html")) {
          return "/index.html";
        }
        return undefined;
      },
    } satisfies ProxyOptions,
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: {
    port: devPort,
    proxy: apiProxy,
  },
  preview: {
    port: devPort,
    proxy: apiProxy,
    // `vite preview` otherwise 403s any request whose Host header isn't
    // localhost, which breaks access via a container name, an internal DNS
    // name, or a reverse proxy. Restrict it in a real deployment by setting
    // VITE_ALLOWED_HOSTS to a comma-separated list.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(",").map((host) => host.trim())
      : true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
