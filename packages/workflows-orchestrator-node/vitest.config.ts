import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Integration tests share a single Postgres instance via
    // TEST_DATABASE_URL. Several `*.integration.test.ts` files truncate
    // tables in beforeEach — running files in parallel would race those
    // truncates against in-flight runs in sibling test files (esp.
    // sleep-resume's polling loop). Serialize file execution to keep
    // tests deterministic against the shared DB.
    fileParallelism: false,
  },
})
