/**
 * The standard Voyant runtime composition manifest — the ordered set of
 * package-delivered modules + extensions every operator deployment mounts.
 *
 * A deployment composes its full manifest by spreading this and appending its
 * own deployment-local entries. Owning the standard ordering here means a new
 * standard module added to the framework auto-joins the default set — the
 * deployment doesn't re-list it.
 *
 * The standard set is the DEFAULT, not a fixed profile (ADR-0007). A deployment
 * may pare it down via `createVoyantApp({ exclude })` (remove) or
 * `{ overrideCapabilities }` (replace — auto-displaces the default provider of a
 * capability); both are validated against `FRAMEWORK_CAPABILITY_GRAPH` (below) so
 * dropping a depended-on module without a substitute, or excluding an
 * `isRequired` module, fails at boot rather than as a runtime 500. Phase 1 lands
 * the runtime mechanism here; aligning schema/migration generation with the same
 * subset is the immediate follow-up.
 *
 * Workstream B of the consolidated-deployments RFC: the standard registry's
 * factories live in this package alongside the manifest (the "which + order").
 */
import type { CapabilityGraph } from "@voyant-travel/hono/composition"

export interface FrameworkManifest {
  modules: readonly string[]
  extensions: readonly string[]
}

export const FRAMEWORK_RUNTIME_MANIFEST = {
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
    "@voyant-travel/bookings",
    "@voyant-travel/finance",
    "@voyant-travel/legal",
    "@voyant-travel/public-document-delivery",
    "@voyant-travel/notifications",
    "@voyant-travel/storefront",
    "@voyant-travel/storefront/customer-portal",
    "@voyant-travel/storefront/verification",
    "@voyant-travel/trips",
    "@voyant-travel/flights",
    "@voyant-travel/operator-settings",
    // `operator/*` STANDARD families — routes are package-owned; they keep the
    // `operator/*` specifier only because the deployment injects their provider
    // wiring (see operator-registry-classification.md). The framework owns the
    // factory (frameworkComposition) + manifest entry; the deployment injects
    // the loaders. (operator/invitations + operator/operator-settings are
    // genuinely deployment-local and stay appended in the deployment's manifest.)
    "operator/mcp",
    "operator/catalog-booking",
    "operator/catalog-content",
    "operator/media",
    "operator/payment-link",
    "operator/contract-document",
  ],
  extensions: [
    "@voyant-travel/bookings/booking-supplier-extension",
    "@voyant-travel/finance/bookings-create-extension",
    "@voyant-travel/inventory/booking-extension",
    "@voyant-travel/inventory/authoring/extension",
    "@voyant-travel/quotes/booking-extension",
    "@voyant-travel/distribution",
    "@voyant-travel/distribution/channel-push-extension",
    "@voyant-travel/finance/booking-tax-extension",
    // `operator/*` STANDARD extensions (builders/loaders injected).
    "operator/booking-schedule-extension",
    "operator/quote-version-snapshot-extension",
    "operator/booking-maintenance-extension",
    "operator/action-ledger-health-extension",
    "operator/proposal-extension",
    "operator/catalog-offers-extension",
    "operator/catalog-checkout-extension",
  ],
} as const satisfies FrameworkManifest

/**
 * The standard set's capability dependency graph (ADR-0007). It declares which
 * standard modules `provide` a capability token and which `require` one, so that
 * subsetting the standard set (`createVoyantApp({ exclude })`) can be validated:
 * dropping a module whose capability is still required — and not satisfied by an
 * injected substitute (`provideCapabilities`) — becomes a boot error naming the
 * orphaned consumers, instead of a runtime 500.
 *
 * Phase 1 declares the single port the coupling map proved real:
 * `people-directory` — person/organization read + upsert + travel-snapshot,
 * provided by `@voyant-travel/relationships` and consumed by bookings (billing /
 * traveler resolution), legal (contract-party hydration), and storefront
 * (customer-portal lookups). Deep CRM features (activities, segments, merges,
 * custom fields) have no cross-module consumers and carry no token — they leave
 * with the module. New ports (e.g. a separate `crm-intake` write surface) are
 * added here as consumers are narrowed onto them.
 *
 * `isRequired` marks the foundational modules a deployment may not `exclude`
 * (it may still override their capability with a substitute). The set is kept
 * intentionally minimal — cross-cutting infrastructure only (audit ledger,
 * identity/contact-points, commerce primitives) — and tightens as coupling
 * dictates rather than defensively up front.
 */
export const FRAMEWORK_CAPABILITY_GRAPH = {
  "@voyant-travel/action-ledger": { isRequired: true },
  "@voyant-travel/identity": { isRequired: true },
  "@voyant-travel/commerce": { isRequired: true },
  "@voyant-travel/relationships": { provides: ["people-directory"] },
  "@voyant-travel/bookings": { requires: ["people-directory"] },
  "@voyant-travel/legal": { requires: ["people-directory"] },
  "@voyant-travel/storefront": { requires: ["people-directory"] },
  // Customer-portal is a distinct standard module that calls relationshipsService
  // directly (service-public-impl.ts: getPersonById / list+createPersonDocument /
  // create+updatePerson), so it depends on people-directory in its own right —
  // excluding relationships without it would otherwise validate yet 500 at runtime.
  "@voyant-travel/storefront/customer-portal": { requires: ["people-directory"] },
} as const satisfies CapabilityGraph
