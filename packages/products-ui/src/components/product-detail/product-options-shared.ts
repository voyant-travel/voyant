import {
  getDeparturePriceOverridesQueryOptions as getSharedDeparturePriceOverridesQueryOptions,
  getOptionPriceRulesQueryOptions as getSharedOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions as getSharedOptionUnitPriceRulesQueryOptions,
  getPriceCatalogsQueryOptions as getSharedPriceCatalogsQueryOptions,
  getPricingCategoriesQueryOptions as getSharedPricingCategoriesQueryOptions,
} from "@voyantjs/pricing-react"
import {
  getOptionUnitsQueryOptions as getSharedOptionUnitsQueryOptions,
  getProductOptionsQueryOptions as getSharedProductOptionsQueryOptions,
  type VoyantProductsContextValue,
} from "@voyantjs/products-react"

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

export function getProductOptionsQueryOptions(client: OptionsClient, productId: string) {
  return getSharedProductOptionsQueryOptions(client, { productId, limit: 100 })
}

export function getOptionUnitsQueryOptions(client: OptionsClient, optionId: string) {
  return getSharedOptionUnitsQueryOptions(client, { optionId, limit: 100 })
}

export function getOptionPriceRulesQueryOptions(client: OptionsClient, optionId: string) {
  return getSharedOptionPriceRulesQueryOptions(client, { optionId, limit: 100 })
}

export function getPricingCategoriesQueryOptions(client: OptionsClient) {
  return getSharedPricingCategoriesQueryOptions(client, { limit: 100 })
}

export function getOptionUnitPriceRulesQueryOptions(
  client: OptionsClient,
  optionPriceRuleId: string,
) {
  return getSharedOptionUnitPriceRulesQueryOptions(client, {
    optionPriceRuleId,
    limit: 100,
  })
}

export function getPriceCatalogsQueryOptions(client: OptionsClient) {
  return getSharedPriceCatalogsQueryOptions(client, { limit: 100 })
}

export function getDeparturePriceOverridesQueryOptions(client: OptionsClient, departureId: string) {
  return getSharedDeparturePriceOverridesQueryOptions(client, {
    departureId,
    limit: 100,
  })
}
