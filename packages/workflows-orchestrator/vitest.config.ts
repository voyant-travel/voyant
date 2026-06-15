import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Some moved Node/Postgres integration tests share one database and
    // truncate tables in beforeEach; serialize files to avoid cross-test races.
    fileParallelism: false,
  },
})
