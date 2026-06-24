import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

import { schema } from "./drizzle.schemas.generated.ts"

const customDeploymentSchemas = ["./src/modules/*/schema.ts", "./src/extensions/*/schema.ts"]

const explicitDatabaseUrl = process.env.DATABASE_URL
config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })
config({ path: ".dev.vars", override: true })
if (explicitDatabaseUrl) process.env.DATABASE_URL = explicitDatabaseUrl

export default defineConfig({
  schema: [...schema, ...customDeploymentSchemas],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
