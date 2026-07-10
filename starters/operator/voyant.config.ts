import type {
  VoyantProjectDeploymentMode,
  VoyantProjectProviders,
} from "@voyant-travel/framework/profile"
import { defineProject } from "@voyant-travel/framework/project"

const deployment = {
  target: "node",
  mode: "self-hosted",
  providers: {
    database: "postgres",
    storage: "memory",
    cache: "postgres",
    sharedState: "memory",
    rateLimit: "memory",
    search: "none",
    email: "none",
    sms: "none",
    auth: "better-auth",
    scheduledJobs: "none",
    workflows: "none",
  },
  migrations: [{ id: "deployment", source: "./migrations" }],
} as const satisfies {
  target: "node"
  mode: VoyantProjectDeploymentMode
  providers: VoyantProjectProviders
  migrations: readonly [{ id: "deployment"; source: "./migrations" }]
}

const definition = {
  presetLineage: "operator-standard",
  modules: [
    "@voyant-travel/action-ledger",
    "@voyant-travel/relationships",
    "@voyant-travel/quotes",
    "@voyant-travel/operations",
    "@voyant-travel/identity",
    "@voyant-travel/distribution",
    "@voyant-travel/inventory/extras",
    "@voyant-travel/bookings/requirements",
    "@voyant-travel/commerce",
    "@voyant-travel/inventory",
    "@voyant-travel/catalog",
    "@voyant-travel/catalog/booking-engine",
    "@voyant-travel/accommodations",
    "@voyant-travel/bookings",
    "@voyant-travel/finance",
    "@voyant-travel/legal",
    "@voyant-travel/legal/contract-document",
    "@voyant-travel/public-document-delivery",
    "@voyant-travel/notifications",
    "@voyant-travel/storage",
    "@voyant-travel/storefront",
    "@voyant-travel/storefront/customer-portal",
    "@voyant-travel/storefront/verification",
    "@voyant-travel/storefront/payment-link",
    "@voyant-travel/trips",
    "@voyant-travel/flights",
    "@voyant-travel/operator-settings",
    "@voyant-travel/charters",
    "@voyant-travel/cruises",
    "@voyant-travel/realtime",
    "@voyant-travel/mice",
    "@voyant-travel/db",
    "@voyant-travel/availability",
    "@voyant-travel/catalog-authoring",
    "@voyant-travel/workflow-runs",
    { resolve: "./src/modules/mcp" },
    { resolve: "./src/modules/invitations" },
    { resolve: "./src/modules/team" },
  ],
  extensions: [
    "@voyant-travel/bookings/booking-supplier-extension",
    "@voyant-travel/finance/bookings-create-extension",
    "@voyant-travel/inventory/booking-extension",
    "@voyant-travel/inventory/authoring/extension",
    "@voyant-travel/quotes/booking-extension",
    "@voyant-travel/distribution/extension",
    "@voyant-travel/distribution/channel-push-extension",
    "@voyant-travel/finance/booking-tax-extension",
    "@voyant-travel/inventory/content-extension",
    "@voyant-travel/cruises/content-extension",
    "@voyant-travel/accommodations/content-extension",
    "@voyant-travel/inventory/brochure-extension",
    "@voyant-travel/finance/booking-schedule-extension",
    "@voyant-travel/quotes/quote-version-snapshot-extension",
    "@voyant-travel/commerce/booking-maintenance-extension",
    "@voyant-travel/action-ledger/health-extension",
    "@voyant-travel/quotes/proposal-extension",
    "@voyant-travel/catalog/offers-extension",
    "@voyant-travel/commerce/catalog-checkout-extension",
    "@voyant-travel/mice/booking-extension",
  ],
  plugins: [{ resolve: "@voyant-travel/plugin-netopia" }],
  deployment,
} as const

// The deployment member is part of the framework project contract supplied by
// the project-resolver slice. Object.assign preserves it when this branch is
// tested alone against the pre-resolver defineProject implementation.
export default Object.assign(defineProject(definition), { deployment })
