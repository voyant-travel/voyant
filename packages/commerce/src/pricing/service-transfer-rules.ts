import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { dropoffPriceRules, extraPriceRules, pickupPriceRules } from "./schema.js"
import type {
  CreateDropoffPriceRuleInput,
  CreateExtraPriceRuleInput,
  CreatePickupPriceRuleInput,
  DropoffPriceRuleListQuery,
  ExtraPriceRuleListQuery,
  PickupPriceRuleListQuery,
  UpdateDropoffPriceRuleInput,
  UpdateExtraPriceRuleInput,
  UpdatePickupPriceRuleInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listPickupPriceRules(
  db: PostgresJsDatabase,
  query: PickupPriceRuleListQuery,
) {
  const conditions = []
  if (query.optionPriceRuleId) {
    conditions.push(eq(pickupPriceRules.optionPriceRuleId, query.optionPriceRuleId))
  }
  if (query.optionId) conditions.push(eq(pickupPriceRules.optionId, query.optionId))
  if (query.pickupPointId) conditions.push(eq(pickupPriceRules.pickupPointId, query.pickupPointId))
  if (query.active !== undefined) conditions.push(eq(pickupPriceRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(pickupPriceRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(pickupPriceRules.sortOrder), asc(pickupPriceRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(pickupPriceRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPickupPriceRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(pickupPriceRules).where(eq(pickupPriceRules.id, id)).limit(1)
  return row ?? null
}

export async function createPickupPriceRule(
  db: PostgresJsDatabase,
  data: CreatePickupPriceRuleInput,
) {
  const [row] = await db.insert(pickupPriceRules).values(data).returning()
  return row ?? null
}

export async function updatePickupPriceRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePickupPriceRuleInput,
) {
  const [row] = await db
    .update(pickupPriceRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pickupPriceRules.id, id))
    .returning()
  return row ?? null
}

export async function deletePickupPriceRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(pickupPriceRules)
    .where(eq(pickupPriceRules.id, id))
    .returning({ id: pickupPriceRules.id })
  return row ?? null
}

export async function listDropoffPriceRules(
  db: PostgresJsDatabase,
  query: DropoffPriceRuleListQuery,
) {
  const conditions = []
  if (query.optionPriceRuleId) {
    conditions.push(eq(dropoffPriceRules.optionPriceRuleId, query.optionPriceRuleId))
  }
  if (query.optionId) conditions.push(eq(dropoffPriceRules.optionId, query.optionId))
  if (query.facilityId) conditions.push(eq(dropoffPriceRules.facilityId, query.facilityId))
  if (query.active !== undefined) conditions.push(eq(dropoffPriceRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(dropoffPriceRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(dropoffPriceRules.sortOrder), asc(dropoffPriceRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(dropoffPriceRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getDropoffPriceRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(dropoffPriceRules)
    .where(eq(dropoffPriceRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createDropoffPriceRule(
  db: PostgresJsDatabase,
  data: CreateDropoffPriceRuleInput,
) {
  const [row] = await db.insert(dropoffPriceRules).values(data).returning()
  return row ?? null
}

export async function updateDropoffPriceRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateDropoffPriceRuleInput,
) {
  const [row] = await db
    .update(dropoffPriceRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dropoffPriceRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteDropoffPriceRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(dropoffPriceRules)
    .where(eq(dropoffPriceRules.id, id))
    .returning({ id: dropoffPriceRules.id })
  return row ?? null
}

export async function listExtraPriceRules(db: PostgresJsDatabase, query: ExtraPriceRuleListQuery) {
  const conditions = []
  if (query.optionPriceRuleId) {
    conditions.push(eq(extraPriceRules.optionPriceRuleId, query.optionPriceRuleId))
  }
  if (query.optionId) conditions.push(eq(extraPriceRules.optionId, query.optionId))
  if (query.productExtraId)
    conditions.push(eq(extraPriceRules.productExtraId, query.productExtraId))
  if (query.optionExtraConfigId) {
    conditions.push(eq(extraPriceRules.optionExtraConfigId, query.optionExtraConfigId))
  }
  if (query.active !== undefined) conditions.push(eq(extraPriceRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(extraPriceRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(extraPriceRules.sortOrder), asc(extraPriceRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(extraPriceRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getExtraPriceRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(extraPriceRules).where(eq(extraPriceRules.id, id)).limit(1)
  return row ?? null
}

export async function createExtraPriceRule(
  db: PostgresJsDatabase,
  data: CreateExtraPriceRuleInput,
) {
  const [row] = await db.insert(extraPriceRules).values(data).returning()
  return row ?? null
}

export async function updateExtraPriceRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateExtraPriceRuleInput,
) {
  const [row] = await db
    .update(extraPriceRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(extraPriceRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteExtraPriceRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(extraPriceRules)
    .where(eq(extraPriceRules.id, id))
    .returning({ id: extraPriceRules.id })
  return row ?? null
}
