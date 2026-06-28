import {
  getOptionUnitsQueryOptions as getSharedOptionUnitsQueryOptions,
  getProductOptionsQueryOptions as getSharedProductOptionsQueryOptions,
  type VoyantProductsContextValue,
} from "../../index.js"
import {
  getDeparturePriceOverridesQueryOptions as getSharedDeparturePriceOverridesQueryOptions,
  getOptionPriceRulesQueryOptions as getSharedOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions as getSharedOptionUnitPriceRulesQueryOptions,
  getPriceCatalogsQueryOptions as getSharedPriceCatalogsQueryOptions,
  getPricingCategoriesQueryOptions as getSharedPricingCategoriesQueryOptions,
} from "./commerce-client.js"
import type { ProductDetailApi } from "./host.js"

/**
 * The same configured `{ baseUrl, fetcher }` client (from `useVoyantProductsContext()`)
 * drives both the products and pricing query-options — they hit the same API and
 * auth. Callers pass it in so this module stays free of app-specific fetchers.
 */
export type OptionsClient = VoyantProductsContextValue

export const optionStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

/**
 * Which pricing layout an option shows. "rooms" = a room×traveler-type grid
 * (accommodation / multi-day). "seats" = a flat traveler-type price list
 * (single-day excursions, transfers). Derived from the product's bookingMode
 * so the agent never picks a pricing model directly.
 */
export type OptionPricingLayout = "rooms" | "seats"

/**
 * Derive the pricing layout from the product's booking mode. Multi-day /
 * overnight modes imply rooms; single-day activity modes imply per-person
 * seats. `dayCount` is a fallback for the ambiguous `other` mode (>1 day →
 * rooms), matching the operator rule "more than one day means rooms".
 */
export function deriveOptionPricingLayout(
  bookingMode: string | null | undefined,
  dayCount?: number,
): OptionPricingLayout {
  switch (bookingMode) {
    case "stay":
    case "itinerary":
      return "rooms"
    case "date":
    case "date_time":
    case "open":
    case "transfer":
      return "seats"
    default:
      return dayCount != null && dayCount > 1 ? "rooms" : "seats"
  }
}

export function getProductDetailProductOptionsQueryOptions(
  client: OptionsClient,
  productId: string,
) {
  return getSharedProductOptionsQueryOptions(client, { productId, limit: 100 })
}

export function getProductDetailOptionUnitsQueryOptions(client: OptionsClient, optionId: string) {
  return getSharedOptionUnitsQueryOptions(client, { optionId, limit: 100 })
}

export function getProductDetailOptionPriceRulesQueryOptions(
  client: ProductDetailApi,
  optionId: string,
) {
  return getSharedOptionPriceRulesQueryOptions(client, {
    optionId,
    limit: 100,
  })
}

export function getProductDetailPricingCategoriesQueryOptions(client: ProductDetailApi) {
  return getSharedPricingCategoriesQueryOptions(client, { limit: 100 })
}

export function getProductDetailOptionUnitPriceRulesQueryOptions(
  client: ProductDetailApi,
  optionPriceRuleId: string,
) {
  return getSharedOptionUnitPriceRulesQueryOptions(client, {
    optionPriceRuleId,
    limit: 100,
  })
}

export function getProductDetailPriceCatalogsQueryOptions(client: ProductDetailApi) {
  return getSharedPriceCatalogsQueryOptions(client, { limit: 100 })
}

export function getProductDetailDeparturePriceOverridesQueryOptions(
  client: ProductDetailApi,
  departureId: string,
) {
  return getSharedDeparturePriceOverridesQueryOptions(client, {
    departureId,
    limit: 100,
  })
}
