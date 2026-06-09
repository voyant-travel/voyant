import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// Schema list is DERIVED from voyant.config.ts (modules + additionalSchemas +
// template-local schemas) and emitted to this committed file. Do not hand-edit
// the list — run `voyant db schemas --emit` (or `voyant db generate`) to
// refresh it; `voyant db doctor` fails if it drifts.
import { schema } from "./drizzle.schemas.generated.ts"

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? ""
}

export default defineConfig({
  schema: [...schema],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
})
