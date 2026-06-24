import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: ["./src/modules/*/schema.ts", "./src/extensions/*/schema.ts"],
  out: "./migrations",
  dialect: "postgresql",
})
