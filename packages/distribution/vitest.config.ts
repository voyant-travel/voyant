import { defineConfig } from "vitest/config"

export default defineConfig({
  // Several unit tests dynamically import the package's workflow graph, which is
  // slow under the concurrent full-suite run; give them headroom so they don't
  // flake on the default 5s timeout under CPU contention.
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
})
