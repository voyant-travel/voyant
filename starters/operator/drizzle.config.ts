import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// Schema list is DERIVED from voyant.config.ts (modules + additionalSchemas +
// starter-local schemas) and emitted to this committed file. Do not hand-edit
// the list — run `voyant db schemas --emit` (or `voyant db generate`) to
// refresh it; `voyant db doctor` fails if it drifts.
import { schema } from "./drizzle.schemas.generated.ts"

// Custom deployment modules/extensions (`src/{modules,extensions}/<name>/schema.ts`)
// extend the live aggregate schema beyond the generated standard set — so
// `push`/`studio`/`check` and the migration-replay oracle see them too. Empty
// until a deployment adds one; their migrations are emitted into the deployment
// source (migrations-d1).
const customDeploymentSchemas = ["./src/modules/*/schema.ts", "./src/extensions/*/schema.ts"]

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })

function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? ""
}

export default defineConfig({
  schema: [...schema, ...customDeploymentSchemas],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
})
