import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// Self-contained — don't inherit DATABASE_URL from the repo-root .env
// (that's the operator template's DB).
config({ path: ".env" })

const databaseUrl = process.env.CATALOG_DEMO_DATABASE_URL ?? process.env.DATABASE_URL ?? ""

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
})
