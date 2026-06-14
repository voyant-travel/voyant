export interface MarketsListFilters {
  status?: string | undefined
  countryCode?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface MarketLocalesListFilters {
  marketId?: string | undefined
  languageTag?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface MarketCurrenciesListFilters {
  marketId?: string | undefined
  currencyCode?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface MarketProductRulesListFilters {
  marketId?: string | undefined
  productId?: string | undefined
  optionId?: string | undefined
  sellability?: string | undefined
  active?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const marketsQueryKeys = {
  all: ["markets"] as const,
  markets: () => [...marketsQueryKeys.all, "markets"] as const,
  marketsList: (filters: MarketsListFilters) => [...marketsQueryKeys.markets(), filters] as const,
  market: (id: string) => [...marketsQueryKeys.markets(), id] as const,
  marketLocales: () => [...marketsQueryKeys.all, "market-locales"] as const,
  marketLocalesList: (filters: MarketLocalesListFilters) =>
    [...marketsQueryKeys.marketLocales(), filters] as const,
  marketLocale: (id: string) => [...marketsQueryKeys.marketLocales(), id] as const,
  marketCurrencies: () => [...marketsQueryKeys.all, "market-currencies"] as const,
  marketCurrenciesList: (filters: MarketCurrenciesListFilters) =>
    [...marketsQueryKeys.marketCurrencies(), filters] as const,
  marketCurrency: (id: string) => [...marketsQueryKeys.marketCurrencies(), id] as const,
  marketProductRules: () => [...marketsQueryKeys.all, "product-rules"] as const,
  marketProductRulesList: (filters: MarketProductRulesListFilters) =>
    [...marketsQueryKeys.marketProductRules(), filters] as const,
  marketProductRule: (id: string) => [...marketsQueryKeys.marketProductRules(), id] as const,
}
