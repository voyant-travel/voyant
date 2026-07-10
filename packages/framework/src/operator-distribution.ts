import type { DefineVoyantGraphProjectUnitInput } from "@voyant-travel/core/project"

export interface OperatorDistributionDeclaration {
  id: string
  target: "node"
  modules: readonly DefineVoyantGraphProjectUnitInput[]
  extensions: readonly DefineVoyantGraphProjectUnitInput[]
}

/** Consumer-owned differences applied after the framework distribution. */
export interface OperatorDistributionDifferences {
  modules?: readonly DefineVoyantGraphProjectUnitInput[]
  extensions?: readonly DefineVoyantGraphProjectUnitInput[]
  plugins?: readonly DefineVoyantGraphProjectUnitInput[]
}

/** Resolver input after framework defaults and consumer differences are merged. */
export interface ResolvedOperatorDistribution {
  modules: readonly DefineVoyantGraphProjectUnitInput[]
  extensions: readonly DefineVoyantGraphProjectUnitInput[]
  plugins: readonly DefineVoyantGraphProjectUnitInput[]
}

/**
 * Applies the standard Operator product closure before consumer-owned
 * differences. This is a resolver/default-config boundary: authored config
 * describes differences and does not need to spread the standard declaration.
 */
export function mergeOperatorDistributionDefaults(
  differences: OperatorDistributionDifferences = {},
  distribution: OperatorDistributionDeclaration = STANDARD_OPERATOR_DISTRIBUTION,
): ResolvedOperatorDistribution {
  return {
    modules: [...distribution.modules, ...(differences.modules ?? [])],
    extensions: [...distribution.extensions, ...(differences.extensions ?? [])],
    plugins: [...(differences.plugins ?? [])],
  }
}

/** The package-owned product closure used by a standard Node operator. */
export const STANDARD_OPERATOR_DISTRIBUTION = {
  id: "operator-standard",
  target: "node",
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
} as const satisfies OperatorDistributionDeclaration
