import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// The SPA and API share an origin in every deployment mode (the backend serves
// the built app in production). In `vite dev`/`preview` we reproduce that by
// proxying the API path prefixes to the backend. Several prefixes (`/assets`,
// `/risks`, `/projects`, `/dashboard`, `/users`) are also client-router paths,
// so a browser navigation (`Accept: text/html`) is served the SPA and only
// XHR/fetch calls (`Accept: application/json`) are proxied — the same
// negotiation the backend does for its own history fallback.
const API_PREFIXES = [
  "/health",
  "/ready",
  "/auth",
  "/users",
  "/reference",
  "/assets",
  "/projects",
  "/risks",
  "/controls",
  "/audit-logs",
  "/search",
  "/dashboard",
  "/reports",
  "/exports",
];

const backendTarget = process.env.VITE_DEV_API_TARGET ?? "http://localhost:4000";

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
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
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
