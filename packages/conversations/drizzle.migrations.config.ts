/**
 * This package owns and ships its migration history for source-free runtimes.
 * Regenerate with `pnpm -C packages/conversations db:generate`.
 */
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
})
