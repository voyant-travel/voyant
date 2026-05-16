import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env" })
config({ path: "../../.env" })
config({ path: "../../.env.local" })

function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? ""
}

export default defineConfig({
  schema: [
    // Core IAM + infra schemas
    "../../packages/db/src/schema/index.ts",
    "../../packages/action-ledger/src/schema.ts",
    // Module schemas — add/remove based on which modules this template uses
    "../../packages/crm/src/schema.ts",
    "../../packages/availability/src/schema.ts",
    "../../packages/facilities/src/schema.ts",
    "../../packages/hospitality/src/schema.ts",
    "../../packages/identity/src/schema.ts",
    "../../packages/external-refs/src/schema.ts",
    "../../packages/extras/src/schema.ts",
    "../../packages/booking-requirements/src/schema.ts",
    "../../packages/pricing/src/schema.ts",
    "../../packages/markets/src/schema.ts",
    "../../packages/transactions/src/schema.ts",
    "../../packages/sellability/src/schema.ts",
    "../../packages/resources/src/schema.ts",
    "../../packages/ground/src/schema.ts",
    "../../packages/distribution/src/schema.ts",
    "../../packages/suppliers/src/schema.ts",
    "../../packages/products/src/schema.ts",
    "../../packages/bookings/src/schema.ts",
    "../../packages/finance/src/schema.ts",
    "../../packages/legal/src/schema.ts",
    "../../packages/catalog/src/schema.ts",
    // Mounted at /v1/public/storefront-verification; keep this schema
    // alongside the route module so challenge requests do not fail at runtime.
    "../../packages/storefront-verification/src/schema.ts",
  ],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
})
