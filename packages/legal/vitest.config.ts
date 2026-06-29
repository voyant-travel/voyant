import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    passWithNoTests: true,
    hookTimeout: 60000,
    // Integration tests share a single voyant_test DB and clean it in
    // beforeEach; running files in parallel truncates mid-flight. Stick to
    // serial — legal's suite is small (≈60 tests / ~10s) so the cost is
    // negligible and the reliability win is big.
    fileParallelism: false,
  },
})
