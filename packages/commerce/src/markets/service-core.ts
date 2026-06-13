import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { exchangeRates, fxRateSets, marketCurrencies, marketLocales, markets } from "./schema.js"
import type {
  CreateExchangeRateInput,
  CreateFxRateSetInput,
  CreateMarketCurrencyInput,
  CreateMarketInput,
  CreateMarketLocaleInput,
  ExchangeRateListQuery,
  FxRateSetListQuery,
  MarketCurrencyListQuery,
  MarketListQuery,
  MarketLocaleListQuery,
  UpdateExchangeRateInput,
  UpdateFxRateSetInput,
  UpdateMarketCurrencyInput,
  UpdateMarketInput,
  UpdateMarketLocaleInput,
} from "./service-shared.js"
import { paginate, toTimestamp } from "./service-shared.js"

export async function listMarkets(db: PostgresJsDatabase, query: MarketListQuery) {
  const conditions = []
  if (query.status) conditions.push(eq(markets.status, query.status))
  if (query.countryCode) conditions.push(eq(markets.countryCode, query.countryCode))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(markets.name, term), ilike(markets.code, term)))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(markets)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(markets.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(markets).where(where),
    query.limit,
    query.offset,
  )
}

export async function getMarketById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(markets).where(eq(markets.id, id)).limit(1)
  return row ?? null
}

export async function createMarket(db: PostgresJsDatabase, data: CreateMarketInput) {
  const [row] = await db.insert(markets).values(data).returning()
  return row ?? null
}

export async function updateMarket(db: PostgresJsDatabase, id: string, data: UpdateMarketInput) {
  const [row] = await db
    .update(markets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(markets.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarket(db: PostgresJsDatabase, id: string) {
  const [row] = await db.delete(markets).where(eq(markets.id, id)).returning({ id: markets.id })
  return row ?? null
}

export async function listMarketLocales(db: PostgresJsDatabase, query: MarketLocaleListQuery) {
  const conditions = []
  if (query.marketId) conditions.push(eq(marketLocales.marketId, query.marketId))
  if (query.languageTag) conditions.push(eq(marketLocales.languageTag, query.languageTag))
  if (query.active !== undefined) conditions.push(eq(marketLocales.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(marketLocales)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(marketLocales.sortOrder), asc(marketLocales.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketLocales).where(where),
    query.limit,
    query.offset,
  )
}

export async function createMarketLocale(
  db: PostgresJsDatabase,
  marketId: string,
  data: CreateMarketLocaleInput,
) {
  const [market] = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)
  if (!market) return null
  const [row] = await db
    .insert(marketLocales)
    .values({ ...data, marketId })
    .returning()
  return row ?? null
}

export async function updateMarketLocale(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateMarketLocaleInput,
) {
  const [row] = await db
    .update(marketLocales)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketLocales.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarketLocale(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(marketLocales)
    .where(eq(marketLocales.id, id))
    .returning({ id: marketLocales.id })
  return row ?? null
}

export async function listMarketCurrencies(db: PostgresJsDatabase, query: MarketCurrencyListQuery) {
  const conditions = []
  if (query.marketId) conditions.push(eq(marketCurrencies.marketId, query.marketId))
  if (query.currencyCode) conditions.push(eq(marketCurrencies.currencyCode, query.currencyCode))
  if (query.active !== undefined) conditions.push(eq(marketCurrencies.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(marketCurrencies)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(marketCurrencies.sortOrder), asc(marketCurrencies.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketCurrencies).where(where),
    query.limit,
    query.offset,
  )
}

export async function createMarketCurrency(
  db: PostgresJsDatabase,
  marketId: string,
  data: CreateMarketCurrencyInput,
) {
  const [market] = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)
  if (!market) return null
  const [row] = await db
    .insert(marketCurrencies)
    .values({ ...data, marketId })
    .returning()
  return row ?? null
}

export async function updateMarketCurrency(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateMarketCurrencyInput,
) {
  const [row] = await db
    .update(marketCurrencies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketCurrencies.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarketCurrency(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(marketCurrencies)
    .where(eq(marketCurrencies.id, id))
    .returning({ id: marketCurrencies.id })
  return row ?? null
}

export async function listFxRateSets(db: PostgresJsDatabase, query: FxRateSetListQuery) {
  const conditions = []
  if (query.source) conditions.push(eq(fxRateSets.source, query.source))
  if (query.baseCurrency) conditions.push(eq(fxRateSets.baseCurrency, query.baseCurrency))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(fxRateSets)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(fxRateSets.effectiveAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(fxRateSets).where(where),
    query.limit,
    query.offset,
  )
}

export async function getFxRateSetById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(fxRateSets).where(eq(fxRateSets.id, id)).limit(1)
  return row ?? null
}

export async function createFxRateSet(db: PostgresJsDatabase, data: CreateFxRateSetInput) {
  const [row] = await db
    .insert(fxRateSets)
    .values({
      ...data,
      effectiveAt: toTimestamp(data.effectiveAt) ?? new Date(),
      observedAt: toTimestamp(data.observedAt),
    })
    .returning()
  return row ?? null
}

export async function updateFxRateSet(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateFxRateSetInput,
) {
  const { effectiveAt, observedAt, ...rest } = data
  const [row] = await db
    .update(fxRateSets)
    .set({
      ...rest,
      effectiveAt: effectiveAt === undefined ? undefined : (toTimestamp(effectiveAt) ?? new Date()),
      observedAt: observedAt === undefined ? undefined : toTimestamp(observedAt),
    })
    .where(eq(fxRateSets.id, id))
    .returning()
  return row ?? null
}

export async function deleteFxRateSet(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(fxRateSets)
    .where(eq(fxRateSets.id, id))
    .returning({ id: fxRateSets.id })
  return row ?? null
}

export async function listExchangeRates(db: PostgresJsDatabase, query: ExchangeRateListQuery) {
  const conditions = []
  if (query.fxRateSetId) conditions.push(eq(exchangeRates.fxRateSetId, query.fxRateSetId))
  if (query.baseCurrency) conditions.push(eq(exchangeRates.baseCurrency, query.baseCurrency))
  if (query.quoteCurrency) conditions.push(eq(exchangeRates.quoteCurrency, query.quoteCurrency))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(exchangeRates)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(exchangeRates.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(exchangeRates).where(where),
    query.limit,
    query.offset,
  )
}

export async function getExchangeRateById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(exchangeRates).where(eq(exchangeRates.id, id)).limit(1)
  return row ?? null
}

export async function createExchangeRate(
  db: PostgresJsDatabase,
  fxRateSetId: string,
  data: CreateExchangeRateInput,
) {
  const [rateSet] = await db
    .select({ id: fxRateSets.id })
    .from(fxRateSets)
    .where(eq(fxRateSets.id, fxRateSetId))
    .limit(1)
  if (!rateSet) return null

  const [row] = await db
    .insert(exchangeRates)
    .values({
      ...data,
      fxRateSetId,
      observedAt: toTimestamp(data.observedAt),
    })
    .returning()
  return row ?? null
}

export async function updateExchangeRate(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateExchangeRateInput,
) {
  const { observedAt, ...rest } = data
  const [row] = await db
    .update(exchangeRates)
    .set({
      ...rest,
      observedAt: observedAt === undefined ? undefined : toTimestamp(observedAt),
    })
    .where(eq(exchangeRates.id, id))
    .returning()
  return row ?? null
}

export async function deleteExchangeRate(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(exchangeRates)
    .where(eq(exchangeRates.id, id))
    .returning({ id: exchangeRates.id })
  return row ?? null
}
