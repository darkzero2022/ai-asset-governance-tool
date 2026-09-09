import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The integration/app tests share one PostgreSQL database. Run test files
    // sequentially so one file's fixture setup/teardown can't race another's.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      // A ratchet: set a few points below the current numbers so a real
      // regression fails CI, then raise these as coverage improves. Run
      // `npm run test:coverage` to see the current report.
      thresholds: {
        statements: 63,
        branches: 52,
        functions: 64,
        lines: 63,
      },
    },
  },
});
