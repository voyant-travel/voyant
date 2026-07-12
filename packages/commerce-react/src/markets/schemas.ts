import {
  insertMarketCurrencySchema,
  insertMarketLocaleSchema,
  insertMarketProductRuleSchema,
  insertMarketSchema,
} from "@voyant-travel/commerce/validation"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const marketRecordSchema = insertMarketSchema.extend({
  id: z.string(),
  regionCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  timezone: z.string().nullable(),
  taxContext: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type MarketRecord = z.infer<typeof marketRecordSchema>

export const marketLocaleRecordSchema = insertMarketLocaleSchema.extend({
  id: z.string(),
  marketId: z.string(),
})

export type MarketLocaleRecord = z.infer<typeof marketLocaleRecordSchema>

export const marketCurrencyRecordSchema = insertMarketCurrencySchema.extend({
  id: z.string(),
  marketId: z.string(),
})

export type MarketCurrencyRecord = z.infer<typeof marketCurrencyRecordSchema>

export const marketProductRuleRecordSchema = insertMarketProductRuleSchema.extend({
  id: z.string(),
  marketId: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  priceCatalogId: z.string().nullable(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  notes: z.string().nullable(),
})

export type MarketProductRuleRecord = z.infer<typeof marketProductRuleRecordSchema>

export const marketListResponse = paginatedEnvelope(marketRecordSchema)
export const marketSingleResponse = singleEnvelope(marketRecordSchema)
export const marketLocaleListResponse = paginatedEnvelope(marketLocaleRecordSchema)
export const marketLocaleSingleResponse = singleEnvelope(marketLocaleRecordSchema)
export const marketCurrencyListResponse = paginatedEnvelope(marketCurrencyRecordSchema)
export const marketCurrencySingleResponse = singleEnvelope(marketCurrencyRecordSchema)
export const marketProductRuleListResponse = paginatedEnvelope(marketProductRuleRecordSchema)
export const marketProductRuleSingleResponse = singleEnvelope(marketProductRuleRecordSchema)
