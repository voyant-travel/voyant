import {
  getDeparturePriceOverridesQueryOptions as getSharedDeparturePriceOverridesQueryOptions,
  getOptionPriceRulesQueryOptions as getSharedOptionPriceRulesQueryOptions,
  getOptionUnitPriceRulesQueryOptions as getSharedOptionUnitPriceRulesQueryOptions,
  getPriceCatalogsQueryOptions as getSharedPriceCatalogsQueryOptions,
  getPricingCategoriesQueryOptions as getSharedPricingCategoriesQueryOptions,
  defaultFetcher as pricingDefaultFetcher,
} from "@voyantjs/pricing-react"
import {
  getOptionUnitsQueryOptions as getSharedOptionUnitsQueryOptions,
  getProductOptionsQueryOptions as getSharedProductOptionsQueryOptions,
  defaultFetcher as productsDefaultFetcher,
} from "@voyantjs/products-react"
import { getApiUrl } from "@/lib/env"

const productsClient = { baseUrl: getApiUrl(), fetcher: productsDefaultFetcher }
const pricingClient = { baseUrl: getApiUrl(), fetcher: pricingDefaultFetcher }

export const optionStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  active: "default",
  archived: "secondary",
}

export function getProductOptionsQueryOptions(productId: string) {
  return getSharedProductOptionsQueryOptions(productsClient, { productId, limit: 100 })
}

export function getOptionUnitsQueryOptions(optionId: string) {
  return getSharedOptionUnitsQueryOptions(productsClient, { optionId, limit: 100 })
}

export function getOptionPriceRulesQueryOptions(optionId: string) {
  return getSharedOptionPriceRulesQueryOptions(pricingClient, { optionId, limit: 100 })
}

export function getPricingCategoriesQueryOptions() {
  return getSharedPricingCategoriesQueryOptions(pricingClient, { limit: 100 })
}

export function getOptionUnitPriceRulesQueryOptions(optionPriceRuleId: string) {
  return getSharedOptionUnitPriceRulesQueryOptions(pricingClient, {
    optionPriceRuleId,
    limit: 100,
  })
}

export function getPriceCatalogsQueryOptions() {
  return getSharedPriceCatalogsQueryOptions(pricingClient, { limit: 100 })
}

export function getDeparturePriceOverridesQueryOptions(departureId: string) {
  return getSharedDeparturePriceOverridesQueryOptions(pricingClient, {
    departureId,
    limit: 100,
  })
}
