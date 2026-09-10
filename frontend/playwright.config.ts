import { defineConfig, devices } from "@playwright/test";

// The golden-path E2E drives the built app served by the backend on one origin
// (SERVE_STATIC), against a freshly-migrated, admin-less database so the run
// starts at the first-run bootstrap screen.
const PORT = Number(process.env.E2E_PORT || 4600);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bash e2e/run-stack.sh",
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { E2E_PORT: String(PORT) },
  },
});
