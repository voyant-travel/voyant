import { defineConfig } from "drizzle-kit"

const DEFAULT_DATABASE_URL = ["postgresql://postgres:postgres", "127.0.0.1:5432/voyant"].join("@")

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/node/postgres-schema.ts",
  out: "./migrations",
  dbCredentials: {
    // `generate` doesn't hit the database, but `migrate` requires a real URL.
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
