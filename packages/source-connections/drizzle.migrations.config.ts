/**
 * D.2 — this package owns its own migration history, generated from its own
 * schema and shipped in the package tarball.
 *
 * Regenerate: `pnpm -C packages/source-connections db:generate`.
 */
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
})
