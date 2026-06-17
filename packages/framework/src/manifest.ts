/**
 * The standard Voyant runtime composition manifest — the ordered set of
 * package-delivered modules + extensions every operator deployment mounts.
 *
 * A deployment composes its full manifest by spreading this and appending its
 * own deployment-local entries (and `voyant.config` may pare the module set
 * down). Owning the standard ordering here means a new standard module added to
 * the framework auto-joins the default set — the deployment doesn't re-list it.
 *
 * Workstream B of the consolidated-deployments RFC: the standard registry's
 * factories relocate into this package next; this is the manifest (the "which +
 * order") moving first.
 */
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
