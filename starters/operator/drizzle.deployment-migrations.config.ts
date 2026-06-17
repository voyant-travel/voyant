/**
 * Generates the D.1 *deployment* migration source — the cross-module link
 * (pivot) tables (`drizzle.links.generated.ts`), which are deployment-owned
 * (they span modules; can't be package-owned). Applied AFTER the framework
 * bundle by the collector. Regenerate with
 * `pnpm -C starters/operator exec drizzle-kit generate --config=drizzle.deployment-migrations.config.ts`.
 */
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: ["./drizzle.links.generated.ts"],
  out: "./migrations-d1",
  dialect: "postgresql",
})
