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
  // Mounted Hono modules that own migrated schema. NOTE: not yet the full
  // runtime mount list — route-only modules that own no tables (storefront,
  // customer-portal, checkout, public-document-delivery, octo) are deferred to
  // the Phase 5 runtime manifest; they do not affect schema resolution.
  // `facilities` is migrated but mounted nowhere — it is pulled transitively
  // via `suppliers`/`accommodations` requiresSchemas, so it needs no entry.
  modules: [
    "@voyantjs/action-ledger",
    "@voyantjs/crm",
    "@voyantjs/identity",
    "@voyantjs/suppliers",
    "@voyantjs/products",
    "@voyantjs/promotions",
    "@voyantjs/catalog",
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
    "@voyantjs/legal",
    "@voyantjs/storefront-verification",
    "@voyantjs/travel-composer",
  ],
  plugins: ["@voyantjs/plugin-smartbill"],
  // Mounted Hono extensions that own migrated schema.
  extensions: ["@voyantjs/catalog-authoring"],
  // Schema this template migrates but does not mount as a module or extension:
  //  - workflow-runs: only its admin routes are mounted, not a module
  //  - accommodations: FK-target schema, not mounted
  //  - charters / cruises / flights: schema migrated ahead of route mounting
  additionalSchemas: [
    "@voyantjs/workflow-runs",
    "@voyantjs/accommodations",
    "@voyantjs/charters",
    "@voyantjs/cruises",
    "@voyantjs/flights",
  ],
  // Template-local Drizzle schema(s) owned by no package: deployment glue plus
  // the generated cross-module link tables (folded into the migration history
  // instead of applied out-of-band via sync-links — regenerate with
  // `voyant db sync-links --emit-drizzle`).
  schemas: ["./src/db/schema.ts", "./drizzle.links.generated.ts"],
  featureFlags: {
    links_enabled: true,
    query_graph: true,
  },
})
