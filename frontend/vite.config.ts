import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    port: 5173,
    // `vite preview` is the process the Docker image runs. It otherwise 403s any
    // request whose Host header isn't localhost, which breaks access via a
    // container name, an internal DNS name, or a reverse proxy. Restrict it in a
    // real deployment by setting VITE_ALLOWED_HOSTS to a comma-separated list.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS
      ? process.env.VITE_ALLOWED_HOSTS.split(",").map((host) => host.trim())
      : true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
