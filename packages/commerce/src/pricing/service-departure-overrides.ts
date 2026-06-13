import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { departurePriceOverrides } from "./schema.js"
import {
  type CreateDeparturePriceOverrideInput,
  type DeparturePriceOverrideListQuery,
  paginate,
  type UpdateDeparturePriceOverrideInput,
} from "./service-shared.js"

export async function listDeparturePriceOverrides(
  db: PostgresJsDatabase,
  query: DeparturePriceOverrideListQuery,
) {
  const conditions = []
  if (query.departureId) conditions.push(eq(departurePriceOverrides.departureId, query.departureId))
  if (query.optionId) conditions.push(eq(departurePriceOverrides.optionId, query.optionId))
  if (query.optionUnitId) {
    conditions.push(eq(departurePriceOverrides.optionUnitId, query.optionUnitId))
  }
  if (query.priceCatalogId) {
    conditions.push(eq(departurePriceOverrides.priceCatalogId, query.priceCatalogId))
  }
  if (query.active !== undefined) {
    conditions.push(eq(departurePriceOverrides.active, query.active))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(departurePriceOverrides)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(departurePriceOverrides.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(departurePriceOverrides).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDeparturePriceOverrideById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(departurePriceOverrides)
    .where(eq(departurePriceOverrides.id, id))
    .limit(1)
  return row ?? null
}

export async function createDeparturePriceOverride(
  db: PostgresJsDatabase,
  data: CreateDeparturePriceOverrideInput,
) {
  const [row] = await db.insert(departurePriceOverrides).values(data).returning()
  return row ?? null
}

export async function updateDeparturePriceOverride(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateDeparturePriceOverrideInput,
) {
  const [row] = await db
    .update(departurePriceOverrides)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(departurePriceOverrides.id, id))
    .returning()
  return row ?? null
}

export async function deleteDeparturePriceOverride(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(departurePriceOverrides)
    .where(eq(departurePriceOverrides.id, id))
    .returning({ id: departurePriceOverrides.id })
  return row ?? null
}
