import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      // Subpath aliases first — arrays preserve order so the more-specific
      // ./testing entry matches before the package-root alias.
      {
        find: "@voyant-travel/workflows-orchestrator/testing",
        replacement: fileURLToPath(
          new URL("../workflows-orchestrator/src/testing/driver-compliance.ts", import.meta.url),
        ),
      },
      {
        find: "@voyant-travel/workflows-orchestrator",
        replacement: fileURLToPath(
          new URL("../workflows-orchestrator/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
})
