import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Coverage is gated on the framework-agnostic logic (API client, session store,
// small helpers) — the part where a test is the right tool and a regression
// should fail CI. Components/pages are exercised by the smoke tests and, in CI,
// the Playwright golden-path run; they are not held to a line threshold here.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Unit tests only — the Playwright specs in e2e/ run via `npm run test:e2e`.
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        provider: "v8",
        include: ["src/api/**/*.ts", "src/auth/**/*.ts", "src/lib/**/*.ts"],
        exclude: ["src/**/*.test.{ts,tsx}"],
        thresholds: {
          statements: 80,
          branches: 78,
          functions: 70,
          lines: 82,
        },
      },
    },
  }),
);
