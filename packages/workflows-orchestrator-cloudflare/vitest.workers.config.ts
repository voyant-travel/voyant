import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

// Separate config for the miniflare-backed suite. The main `test`
// script runs plain-node tests against structural-type mocks; this
// `test:workers` script runs tests inside workerd against a real
// Durable Object + alarm runtime.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./test-worker/wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["test-worker/__tests__/**/*.test.ts"],
  },
})
