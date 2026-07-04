import { defineVoyantConfig } from "@voyant-travel/core/config"

/**
 * Federated operator manifest.
 *
 * This is a reduced operating-layer posture, not the all-in-one operator
 * profile. Runtime composition is explicit in `src/api/app.ts`; this manifest
 * powers tooling such as schema discovery and future admin generators.
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
    "@voyant-travel/action-ledger",
    "@voyant-travel/relationships",
    "@voyant-travel/identity",
    "@voyant-travel/source-connections",
  ],
  additionalSchemas: ["@voyant-travel/workflow-runs"],
  featureFlags: {
    links_enabled: false,
    query_graph: false,
  },
})
