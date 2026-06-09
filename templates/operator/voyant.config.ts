import { defineVoyantConfig } from "@voyantjs/core/config"

/**
 * voyant.config.ts — manifest powering CLI tooling (generators, link-table
 * sync, registry resolution). Runtime composition still lives in
 * `src/api/app.ts` via `createApp({ modules, plugins, ... })`.
 */
export default defineVoyantConfig({
  deployment: "cloudflare-worker",
  projectConfig: {
    database: { urlEnv: "DATABASE_URL", adapter: "serverless" },
    cache: { provider: "kv", binding: "CACHE" },
    auth: { provider: "better-auth" },
  },
  admin: { enabled: true, path: "/app" },
  modules: [
    "@voyantjs/action-ledger",
    "@voyantjs/crm",
    "@voyantjs/identity",
    "@voyantjs/suppliers",
    "@voyantjs/products",
    "@voyantjs/bookings",
    "@voyantjs/finance",
    "@voyantjs/transactions",
    "@voyantjs/availability",
    "@voyantjs/pricing",
    "@voyantjs/sellability",
    "@voyantjs/distribution",
    "@voyantjs/resources",
    "@voyantjs/markets",
    "@voyantjs/notifications",
    "@voyantjs/booking-requirements",
    "@voyantjs/external-refs",
    "@voyantjs/extras",
    "@voyantjs/catalog-authoring",
    "@voyantjs/legal",
    "@voyantjs/promotions",
    "@voyantjs/cruises",
    "@voyantjs/charters",
    "@voyantjs/accommodations",
    "@voyantjs/travel-composer",
    "@voyantjs/flights",
    "@voyantjs/catalog",
    "@voyantjs/workflow-runs",
    "@voyantjs/storefront-verification",
  ],
  extensions: [
    "@voyantjs/bookings/extensions/suppliers",
    "@voyantjs/finance",
    "@voyantjs/products/booking-extension",
    "@voyantjs/catalog-authoring/extension",
    "@voyantjs/crm/booking-extension",
    "@voyantjs/transactions/booking-extension",
    "@voyantjs/distribution/booking-extension",
  ],
  schemas: ["./src/db/schema.ts"],
  plugins: ["@voyantjs/plugin-smartbill"],
  featureFlags: {
    links_enabled: true,
    query_graph: true,
  },
})
