import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The integration/app tests share one PostgreSQL database. Run test files
    // sequentially so one file's fixture setup/teardown can't race another's.
    fileParallelism: false,
  },
});
