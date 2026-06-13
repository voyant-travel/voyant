import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { priceCatalogs, priceSchedules } from "./schema.js"
import type {
  CreatePriceCatalogInput,
  CreatePriceScheduleInput,
  PriceCatalogListQuery,
  PriceScheduleListQuery,
  UpdatePriceCatalogInput,
  UpdatePriceScheduleInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listPriceCatalogs(db: PostgresJsDatabase, query: PriceCatalogListQuery) {
  const conditions = []
  if (query.currencyCode) conditions.push(eq(priceCatalogs.currencyCode, query.currencyCode))
  if (query.catalogType) conditions.push(eq(priceCatalogs.catalogType, query.catalogType))
  if (query.active !== undefined) conditions.push(eq(priceCatalogs.active, query.active))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(priceCatalogs.name, term), ilike(priceCatalogs.code, term)))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(priceCatalogs)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(priceCatalogs.name)),
    db.select({ count: sql<number>`count(*)::int` }).from(priceCatalogs).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPriceCatalogById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(priceCatalogs).where(eq(priceCatalogs.id, id)).limit(1)
  return row ?? null
}

export async function createPriceCatalog(db: PostgresJsDatabase, data: CreatePriceCatalogInput) {
  const [row] = await db.insert(priceCatalogs).values(data).returning()
  return row ?? null
}

export async function updatePriceCatalog(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePriceCatalogInput,
) {
  const [row] = await db
    .update(priceCatalogs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(priceCatalogs.id, id))
    .returning()
  return row ?? null
}

export async function deletePriceCatalog(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(priceCatalogs)
    .where(eq(priceCatalogs.id, id))
    .returning({ id: priceCatalogs.id })
  return row ?? null
}

export async function listPriceSchedules(db: PostgresJsDatabase, query: PriceScheduleListQuery) {
  const conditions = []
  if (query.priceCatalogId) conditions.push(eq(priceSchedules.priceCatalogId, query.priceCatalogId))
  if (query.active !== undefined) conditions.push(eq(priceSchedules.active, query.active))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(priceSchedules.name, term), ilike(priceSchedules.code, term)))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(priceSchedules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(priceSchedules.priority), asc(priceSchedules.name)),
    db.select({ count: sql<number>`count(*)::int` }).from(priceSchedules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPriceScheduleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(priceSchedules).where(eq(priceSchedules.id, id)).limit(1)
  return row ?? null
}

export async function createPriceSchedule(db: PostgresJsDatabase, data: CreatePriceScheduleInput) {
  const [row] = await db.insert(priceSchedules).values(data).returning()
  return row ?? null
}

export async function updatePriceSchedule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePriceScheduleInput,
) {
  const [row] = await db
    .update(priceSchedules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(priceSchedules.id, id))
    .returning()
  return row ?? null
}

export async function deletePriceSchedule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(priceSchedules)
    .where(eq(priceSchedules.id, id))
    .returning({ id: priceSchedules.id })
  return row ?? null
}
