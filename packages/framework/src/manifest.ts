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
 * may pare it down via `createVoyantApp({ exclude })` (remove), validated against
 * `FRAMEWORK_CAPABILITY_GRAPH` (below) so dropping a depended-on module, or an
 * `isRequired` one, fails at boot rather than as a runtime 500. Phase 1 lands the
 * runtime removal mechanism here; aligning schema/migration generation with the
 * same subset is the immediate follow-up. Capability *replacement* (override a
 * module with a substitute) is the v2 design — see ADR-0007 "Deferred to v2".
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
    "@voyant-travel/accommodations",
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

export const FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS = [] as const

export const FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIER_SET = new Set<string>(
  FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIERS,
)

/**
 * The standard set's capability dependency graph (ADR-0007). `isRequired` marks
 * foundational modules a deployment may not `exclude`; `createVoyantApp` throws a
 * named boot error if one is excluded. The `provides`/`requires` edges (for
 * non-required modules a deployment *could* drop) are validated the same way —
 * excluding a depended-on module names the orphaned consumers — but the v1
 * standard set declares no such edges: every cross-cutting module is simply
 * required.
 *
 * The required set is kept intentionally minimal — cross-cutting infrastructure
 * (audit ledger, identity/contact-points, commerce primitives) plus CRM. CRM
 * (`relationships`) is required rather than pluggable: deployments extend it with
 * custom fields (`customFieldDefinitions`), not by swapping it out. A pluggable
 * CRM port was considered and rejected as over-engineering for v1 (ADR-0007
 * "Alternatives"). Everything else (flights, trips, cruises, …) stays excludable.
 */
export const FRAMEWORK_CAPABILITY_GRAPH = {
  "@voyant-travel/action-ledger": { isRequired: true },
  "@voyant-travel/identity": { isRequired: true },
  "@voyant-travel/commerce": { isRequired: true },
  "@voyant-travel/relationships": { isRequired: true },
} as const satisfies CapabilityGraph

/**
 * Which standard module(s) each standard extension augments (voyant#2104,
 * ADR-0007 follow-up a). An extension's mount prefix is a *path*, not a foreign
 * key to a module `name` — the standard set legitimately ships path-mounted
 * extensions with no same-named module (e.g. `operator/proposal-extension`
 * mounts under `quote-versions`), so a name-match orphan check is unsound.
 * Ownership is therefore *declared* here, co-located with the manifest it is
 * typed against, so excluding a module can cascade to its extensions safely
 * (see `ownedExtensionsForExcludedModules` / `subsetStandardManifest`).
 *
 * An extension is owned by every listed module: excluding *any* owner drops it,
 * because the extension augments a surface that owner contributes.
 */
export const FRAMEWORK_EXTENSION_OWNERSHIP = {
  "@voyant-travel/bookings/booking-supplier-extension": ["@voyant-travel/bookings"],
  "@voyant-travel/finance/bookings-create-extension": [
    "@voyant-travel/finance",
    "@voyant-travel/bookings",
  ],
  "@voyant-travel/inventory/booking-extension": [
    "@voyant-travel/inventory",
    "@voyant-travel/bookings",
  ],
  "@voyant-travel/inventory/authoring/extension": ["@voyant-travel/inventory"],
  "@voyant-travel/quotes/booking-extension": ["@voyant-travel/quotes", "@voyant-travel/bookings"],
  "@voyant-travel/distribution": ["@voyant-travel/distribution", "@voyant-travel/bookings"],
  "@voyant-travel/distribution/channel-push-extension": ["@voyant-travel/distribution"],
  "@voyant-travel/finance/booking-tax-extension": [
    "@voyant-travel/finance",
    "@voyant-travel/bookings",
    "@voyant-travel/operator-settings",
  ],
  "operator/booking-schedule-extension": [
    "@voyant-travel/finance",
    "@voyant-travel/bookings",
    "@voyant-travel/operator-settings",
  ],
  "operator/quote-version-snapshot-extension": ["@voyant-travel/quotes", "@voyant-travel/trips"],
  "operator/booking-maintenance-extension": [
    "@voyant-travel/bookings",
    "@voyant-travel/commerce",
    "@voyant-travel/operator-settings",
  ],
  "operator/action-ledger-health-extension": ["@voyant-travel/action-ledger"],
  "operator/proposal-extension": ["@voyant-travel/quotes"],
  "operator/catalog-offers-extension": ["@voyant-travel/catalog"],
  "operator/catalog-checkout-extension": ["@voyant-travel/catalog", "@voyant-travel/commerce"],
} as const satisfies Record<
  (typeof FRAMEWORK_RUNTIME_MANIFEST.extensions)[number],
  readonly (typeof FRAMEWORK_RUNTIME_MANIFEST.modules)[number][]
>
