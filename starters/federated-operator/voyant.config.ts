import { defineVoyantConfig } from "@voyant-travel/core/config"

/**
 * Federated edge-application manifest.
 *
 * This app is outside the unified Voyant deployment graph. Runtime composition
 * is explicit in `src/api/app.ts`; this manifest only powers legacy schema and
 * admin tooling.
 */
export default defineVoyantConfig({
  projectConfig: {
    database: { urlEnv: "DATABASE_URL", adapter: "serverless" },
    cache: { provider: "platform" },
    auth: { provider: "better-auth" },
  },
  admin: { enabled: true, path: "/app" },
  modules: [
    "@voyant-travel/action-ledger",
    "@voyant-travel/relationships",
    "@voyant-travel/identity",
  ],
  additionalSchemas: ["@voyant-travel/workflow-runs"],
  featureFlags: {
    links_enabled: false,
    query_graph: false,
  },
})
