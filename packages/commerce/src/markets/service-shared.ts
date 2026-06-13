import type { z } from "zod"

import type {
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

export type MarketListQuery = z.infer<typeof marketListQuerySchema>
export type MarketLocaleListQuery = z.infer<typeof marketLocaleListQuerySchema>
export type MarketCurrencyListQuery = z.infer<typeof marketCurrencyListQuerySchema>
export type FxRateSetListQuery = z.infer<typeof fxRateSetListQuerySchema>
export type ExchangeRateListQuery = z.infer<typeof exchangeRateListQuerySchema>
export type MarketPriceCatalogListQuery = z.infer<typeof marketPriceCatalogListQuerySchema>
export type MarketProductRuleListQuery = z.infer<typeof marketProductRuleListQuerySchema>
export type MarketChannelRuleListQuery = z.infer<typeof marketChannelRuleListQuerySchema>
export type CreateMarketInput = z.infer<typeof insertMarketSchema>
export type UpdateMarketInput = z.infer<typeof updateMarketSchema>
export type CreateMarketLocaleInput = z.infer<typeof insertMarketLocaleSchema>
export type UpdateMarketLocaleInput = z.infer<typeof updateMarketLocaleSchema>
export type CreateMarketCurrencyInput = z.infer<typeof insertMarketCurrencySchema>
export type UpdateMarketCurrencyInput = z.infer<typeof updateMarketCurrencySchema>
export type CreateFxRateSetInput = z.infer<typeof insertFxRateSetSchema>
export type UpdateFxRateSetInput = z.infer<typeof updateFxRateSetSchema>
export type CreateExchangeRateInput = z.infer<typeof insertExchangeRateSchema>
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>
export type CreateMarketPriceCatalogInput = z.infer<typeof insertMarketPriceCatalogSchema>
export type UpdateMarketPriceCatalogInput = z.infer<typeof updateMarketPriceCatalogSchema>
export type CreateMarketProductRuleInput = z.infer<typeof insertMarketProductRuleSchema>
export type UpdateMarketProductRuleInput = z.infer<typeof updateMarketProductRuleSchema>
export type CreateMarketChannelRuleInput = z.infer<typeof insertMarketChannelRuleSchema>
export type UpdateMarketChannelRuleInput = z.infer<typeof updateMarketChannelRuleSchema>

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

export function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}
