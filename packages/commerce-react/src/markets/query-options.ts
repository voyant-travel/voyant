"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseMarketCurrenciesOptions } from "./hooks/use-market-currencies.js"
import type { UseMarketLocalesOptions } from "./hooks/use-market-locales.js"
import type { UseMarketProductRulesOptions } from "./hooks/use-market-product-rules.js"
import type { UseMarketsOptions } from "./hooks/use-markets.js"
import { marketsQueryKeys } from "./query-keys.js"
import {
  marketCurrencyListResponse,
  marketCurrencySingleResponse,
  marketListResponse,
  marketLocaleListResponse,
  marketLocaleSingleResponse,
  marketProductRuleListResponse,
  marketProductRuleSingleResponse,
  marketSingleResponse,
} from "./schemas.js"

function toQueryString(filters: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function getMarketsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseMarketsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: marketsQueryKeys.marketsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/markets/markets${toQueryString(filters)}`,
        marketListResponse,
        client,
      ),
  })
}

export function getMarketQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: marketsQueryKeys.market(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/markets/markets/${id}`,
        marketSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getMarketLocalesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseMarketLocalesOptions,
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: marketsQueryKeys.marketLocalesList(filters),
    queryFn: async () => {
      if (!filters.marketId) throw new Error("getMarketLocalesQueryOptions requires a marketId")
      return fetchWithValidation(
        `/v1/markets/market-locales${toQueryString(filters)}`,
        marketLocaleListResponse,
        client,
      )
    },
  })
}

export function getMarketLocaleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: marketsQueryKeys.marketLocale(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/markets/market-locales/${id}`,
        marketLocaleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getMarketCurrenciesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseMarketCurrenciesOptions,
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: marketsQueryKeys.marketCurrenciesList(filters),
    queryFn: async () => {
      if (!filters.marketId) throw new Error("getMarketCurrenciesQueryOptions requires a marketId")
      return fetchWithValidation(
        `/v1/markets/market-currencies${toQueryString(filters)}`,
        marketCurrencyListResponse,
        client,
      )
    },
  })
}

export function getMarketCurrencyQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: marketsQueryKeys.marketCurrency(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/markets/market-currencies/${id}`,
        marketCurrencySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getMarketProductRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseMarketProductRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: marketsQueryKeys.marketProductRulesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/markets/product-rules${toQueryString(filters)}`,
        marketProductRuleListResponse,
        client,
      ),
  })
}

export function getMarketProductRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: marketsQueryKeys.marketProductRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/markets/product-rules/${id}`,
        marketProductRuleSingleResponse,
        client,
      )
      return data
    },
  })
}
