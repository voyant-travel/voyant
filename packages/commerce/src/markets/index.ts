import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { marketsRoutes } from "./routes.js"
import { marketsService } from "./service.js"

export type { MarketsRoutes } from "./routes.js"

export const marketsModule: Module = {
  name: "markets",
}

export const marketsHonoModule: HonoModule = {
  module: marketsModule,
  routes: marketsRoutes,
}

export type {
  ExchangeRate,
  FxRateSet,
  Market,
  MarketChannelRule,
  MarketCurrency,
  MarketLocale,
  MarketPriceCatalog,
  MarketProductRule,
  NewExchangeRate,
  NewFxRateSet,
  NewMarket,
  NewMarketChannelRule,
  NewMarketCurrency,
  NewMarketLocale,
  NewMarketPriceCatalog,
  NewMarketProductRule,
} from "./schema.js"
export {
  exchangeRates,
  fxRateSets,
  marketChannelRules,
  marketCurrencies,
  marketLocales,
  marketPriceCatalogs,
  marketProductRules,
  markets,
} from "./schema.js"
export {
  exchangeRateListQuerySchema,
  fxRateSetListQuerySchema,
  insertExchangeRateSchema,
  insertFxRateSetSchema,
  insertMarketChannelRuleSchema,
  insertMarketCurrencySchema,
  insertMarketLocaleSchema,
  insertMarketPriceCatalogSchema,
  insertMarketProductRuleSchema,
  insertMarketSchema,
  marketChannelRuleListQuerySchema,
  marketCurrencyListQuerySchema,
  marketListQuerySchema,
  marketLocaleListQuerySchema,
  marketPriceCatalogListQuerySchema,
  marketProductRuleListQuerySchema,
  updateExchangeRateSchema,
  updateFxRateSetSchema,
  updateMarketChannelRuleSchema,
  updateMarketCurrencySchema,
  updateMarketLocaleSchema,
  updateMarketPriceCatalogSchema,
  updateMarketProductRuleSchema,
  updateMarketSchema,
} from "./validation.js"
export { marketsService }
