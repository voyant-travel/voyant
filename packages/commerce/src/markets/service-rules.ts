import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { marketChannelRules, marketPriceCatalogs, marketProductRules, markets } from "./schema.js"
import type {
  CreateMarketChannelRuleInput,
  CreateMarketPriceCatalogInput,
  CreateMarketProductRuleInput,
  MarketChannelRuleListQuery,
  MarketPriceCatalogListQuery,
  MarketProductRuleListQuery,
  UpdateMarketChannelRuleInput,
  UpdateMarketPriceCatalogInput,
  UpdateMarketProductRuleInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

async function marketExists(db: PostgresJsDatabase, marketId: string) {
  const [market] = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)
  return market ?? null
}

export async function listMarketPriceCatalogs(
  db: PostgresJsDatabase,
  query: MarketPriceCatalogListQuery,
) {
  const conditions = []
  if (query.marketId) conditions.push(eq(marketPriceCatalogs.marketId, query.marketId))
  if (query.priceCatalogId)
    conditions.push(eq(marketPriceCatalogs.priceCatalogId, query.priceCatalogId))
  if (query.active !== undefined) conditions.push(eq(marketPriceCatalogs.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(marketPriceCatalogs)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(marketPriceCatalogs.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketPriceCatalogs).where(where),
    query.limit,
    query.offset,
  )
}

export async function getMarketPriceCatalogById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(marketPriceCatalogs)
    .where(eq(marketPriceCatalogs.id, id))
    .limit(1)
  return row ?? null
}

export async function createMarketPriceCatalog(
  db: PostgresJsDatabase,
  data: CreateMarketPriceCatalogInput,
) {
  if (!(await marketExists(db, data.marketId))) return null
  const [row] = await db.insert(marketPriceCatalogs).values(data).returning()
  return row ?? null
}

export async function updateMarketPriceCatalog(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateMarketPriceCatalogInput,
) {
  const [row] = await db
    .update(marketPriceCatalogs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketPriceCatalogs.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarketPriceCatalog(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(marketPriceCatalogs)
    .where(eq(marketPriceCatalogs.id, id))
    .returning({ id: marketPriceCatalogs.id })
  return row ?? null
}

export async function listMarketProductRules(
  db: PostgresJsDatabase,
  query: MarketProductRuleListQuery,
) {
  const conditions = []
  if (query.marketId) conditions.push(eq(marketProductRules.marketId, query.marketId))
  if (query.productId) conditions.push(eq(marketProductRules.productId, query.productId))
  if (query.optionId) conditions.push(eq(marketProductRules.optionId, query.optionId))
  if (query.sellability) conditions.push(eq(marketProductRules.sellability, query.sellability))
  if (query.active !== undefined) conditions.push(eq(marketProductRules.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(marketProductRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(marketProductRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketProductRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getMarketProductRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(marketProductRules)
    .where(eq(marketProductRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createMarketProductRule(
  db: PostgresJsDatabase,
  data: CreateMarketProductRuleInput,
) {
  if (!(await marketExists(db, data.marketId))) return null
  const [row] = await db.insert(marketProductRules).values(data).returning()
  return row ?? null
}

export async function updateMarketProductRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateMarketProductRuleInput,
) {
  const [row] = await db
    .update(marketProductRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketProductRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarketProductRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(marketProductRules)
    .where(eq(marketProductRules.id, id))
    .returning({ id: marketProductRules.id })
  return row ?? null
}

export async function listMarketChannelRules(
  db: PostgresJsDatabase,
  query: MarketChannelRuleListQuery,
) {
  const conditions = []
  if (query.marketId) conditions.push(eq(marketChannelRules.marketId, query.marketId))
  if (query.channelId) conditions.push(eq(marketChannelRules.channelId, query.channelId))
  if (query.sellability) conditions.push(eq(marketChannelRules.sellability, query.sellability))
  if (query.active !== undefined) conditions.push(eq(marketChannelRules.active, query.active))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(marketChannelRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(marketChannelRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(marketChannelRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getMarketChannelRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(marketChannelRules)
    .where(eq(marketChannelRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createMarketChannelRule(
  db: PostgresJsDatabase,
  data: CreateMarketChannelRuleInput,
) {
  if (!(await marketExists(db, data.marketId))) return null
  const [row] = await db.insert(marketChannelRules).values(data).returning()
  return row ?? null
}

export async function updateMarketChannelRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateMarketChannelRuleInput,
) {
  const [row] = await db
    .update(marketChannelRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketChannelRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteMarketChannelRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(marketChannelRules)
    .where(eq(marketChannelRules.id, id))
    .returning({ id: marketChannelRules.id })
  return row ?? null
}
