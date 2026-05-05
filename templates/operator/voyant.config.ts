import { defineVoyantConfig } from "@voyantjs/core/config"

/**
 * voyant.config.ts — manifest powering CLI tooling (generators, link-table
 * sync, registry resolution). Runtime composition still lives in
 * `src/api/app.ts` via `createApp({ modules, plugins, ... })`.
 */
export default defineVoyantConfig({
  deployment: "cloudflare-worker",
  projectConfig: {
    database: { urlEnv: "DATABASE_URL", adapter: "edge" },
    cache: { provider: "kv", binding: "CACHE" },
    auth: { provider: "better-auth" },
  },
  admin: { enabled: true, path: "/app" },
  modules: [
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
  ],
  plugins: ["@voyantjs/plugin-smartbill"],
  featureFlags: {
    links_enabled: true,
    query_graph: true,
  },
})
