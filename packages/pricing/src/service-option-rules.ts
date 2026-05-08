import { RequestValidationError } from "@voyantjs/hono"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
} from "./schema.js"

// A `per_booking` rule produces a single flat amount for the whole booking;
// per-unit prices implicitly assume a per-unit (or per-person) multiplier.
// The two are contradictory — see #482.
const PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE =
  "Rules with pricingMode = 'per_booking' cannot carry per-unit prices. " +
  "Use pricingMode = 'per_person' or 'starting_from' for unit-priced rules, " +
  "or remove the unit prices to keep this rule a flat per-booking amount."

import type {
  CreateOptionPriceRuleInput,
  CreateOptionStartTimeRuleInput,
  CreateOptionUnitPriceRuleInput,
  CreateOptionUnitTierInput,
  OptionPriceRuleListQuery,
  OptionStartTimeRuleListQuery,
  OptionUnitPriceRuleListQuery,
  OptionUnitTierListQuery,
  UpdateOptionPriceRuleInput,
  UpdateOptionStartTimeRuleInput,
  UpdateOptionUnitPriceRuleInput,
  UpdateOptionUnitTierInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listOptionPriceRules(
  db: PostgresJsDatabase,
  query: OptionPriceRuleListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(optionPriceRules.productId, query.productId))
  if (query.optionId) conditions.push(eq(optionPriceRules.optionId, query.optionId))
  if (query.priceCatalogId)
    conditions.push(eq(optionPriceRules.priceCatalogId, query.priceCatalogId))
  if (query.priceScheduleId)
    conditions.push(eq(optionPriceRules.priceScheduleId, query.priceScheduleId))
  if (query.cancellationPolicyId) {
    conditions.push(eq(optionPriceRules.cancellationPolicyId, query.cancellationPolicyId))
  }
  if (query.pricingMode) conditions.push(eq(optionPriceRules.pricingMode, query.pricingMode))
  if (query.active !== undefined) conditions.push(eq(optionPriceRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(optionPriceRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(optionPriceRules.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(optionPriceRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOptionPriceRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(optionPriceRules).where(eq(optionPriceRules.id, id)).limit(1)
  return row ?? null
}

export async function createOptionPriceRule(
  db: PostgresJsDatabase,
  data: CreateOptionPriceRuleInput,
) {
  const [row] = await db.insert(optionPriceRules).values(data).returning()
  return row ?? null
}

export async function updateOptionPriceRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOptionPriceRuleInput,
) {
  if (data.pricingMode === "per_booking") {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(optionUnitPriceRules)
      .where(eq(optionUnitPriceRules.optionPriceRuleId, id))
    const unitPriceCount = countRow?.count ?? 0
    if (unitPriceCount > 0) {
      throw new RequestValidationError(PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE, {
        ruleId: id,
        unitPriceCount,
      })
    }
  }

  const [row] = await db
    .update(optionPriceRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(optionPriceRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteOptionPriceRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(optionPriceRules)
    .where(eq(optionPriceRules.id, id))
    .returning({ id: optionPriceRules.id })
  return row ?? null
}

export async function listOptionUnitPriceRules(
  db: PostgresJsDatabase,
  query: OptionUnitPriceRuleListQuery,
) {
  const conditions = []
  if (query.optionPriceRuleId) {
    conditions.push(eq(optionUnitPriceRules.optionPriceRuleId, query.optionPriceRuleId))
  }
  if (query.optionId) conditions.push(eq(optionUnitPriceRules.optionId, query.optionId))
  if (query.unitId) conditions.push(eq(optionUnitPriceRules.unitId, query.unitId))
  if (query.pricingCategoryId) {
    conditions.push(eq(optionUnitPriceRules.pricingCategoryId, query.pricingCategoryId))
  }
  if (query.active !== undefined) conditions.push(eq(optionUnitPriceRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(optionUnitPriceRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(optionUnitPriceRules.sortOrder), asc(optionUnitPriceRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(optionUnitPriceRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOptionUnitPriceRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(optionUnitPriceRules)
    .where(eq(optionUnitPriceRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createOptionUnitPriceRule(
  db: PostgresJsDatabase,
  data: CreateOptionUnitPriceRuleInput,
) {
  const [parent] = await db
    .select({ pricingMode: optionPriceRules.pricingMode })
    .from(optionPriceRules)
    .where(eq(optionPriceRules.id, data.optionPriceRuleId))
    .limit(1)
  if (parent?.pricingMode === "per_booking") {
    throw new RequestValidationError(PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE, {
      ruleId: data.optionPriceRuleId,
    })
  }

  const [row] = await db.insert(optionUnitPriceRules).values(data).returning()
  return row ?? null
}

export async function updateOptionUnitPriceRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOptionUnitPriceRuleInput,
) {
  const [row] = await db
    .update(optionUnitPriceRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(optionUnitPriceRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteOptionUnitPriceRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(optionUnitPriceRules)
    .where(eq(optionUnitPriceRules.id, id))
    .returning({ id: optionUnitPriceRules.id })
  return row ?? null
}

export async function listOptionStartTimeRules(
  db: PostgresJsDatabase,
  query: OptionStartTimeRuleListQuery,
) {
  const conditions = []
  if (query.optionPriceRuleId) {
    conditions.push(eq(optionStartTimeRules.optionPriceRuleId, query.optionPriceRuleId))
  }
  if (query.optionId) conditions.push(eq(optionStartTimeRules.optionId, query.optionId))
  if (query.startTimeId) conditions.push(eq(optionStartTimeRules.startTimeId, query.startTimeId))
  if (query.active !== undefined) conditions.push(eq(optionStartTimeRules.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(optionStartTimeRules)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(optionStartTimeRules.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(optionStartTimeRules).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOptionStartTimeRuleById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(optionStartTimeRules)
    .where(eq(optionStartTimeRules.id, id))
    .limit(1)
  return row ?? null
}

export async function createOptionStartTimeRule(
  db: PostgresJsDatabase,
  data: CreateOptionStartTimeRuleInput,
) {
  const [row] = await db.insert(optionStartTimeRules).values(data).returning()
  return row ?? null
}

export async function updateOptionStartTimeRule(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOptionStartTimeRuleInput,
) {
  const [row] = await db
    .update(optionStartTimeRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(optionStartTimeRules.id, id))
    .returning()
  return row ?? null
}

export async function deleteOptionStartTimeRule(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(optionStartTimeRules)
    .where(eq(optionStartTimeRules.id, id))
    .returning({ id: optionStartTimeRules.id })
  return row ?? null
}

export async function listOptionUnitTiers(db: PostgresJsDatabase, query: OptionUnitTierListQuery) {
  const conditions = []
  if (query.optionUnitPriceRuleId) {
    conditions.push(eq(optionUnitTiers.optionUnitPriceRuleId, query.optionUnitPriceRuleId))
  }
  if (query.active !== undefined) conditions.push(eq(optionUnitTiers.active, query.active))
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(optionUnitTiers)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(optionUnitTiers.sortOrder), asc(optionUnitTiers.minQuantity)),
    db.select({ count: sql<number>`count(*)::int` }).from(optionUnitTiers).where(where),
    query.limit,
    query.offset,
  )
}

export async function getOptionUnitTierById(db: PostgresJsDatabase, id: string) {
  const [row] = await db.select().from(optionUnitTiers).where(eq(optionUnitTiers.id, id)).limit(1)
  return row ?? null
}

export async function createOptionUnitTier(
  db: PostgresJsDatabase,
  data: CreateOptionUnitTierInput,
) {
  const [row] = await db.insert(optionUnitTiers).values(data).returning()
  return row ?? null
}

export async function updateOptionUnitTier(
  db: PostgresJsDatabase,
  id: string,
  data: UpdateOptionUnitTierInput,
) {
  const [row] = await db
    .update(optionUnitTiers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(optionUnitTiers.id, id))
    .returning()
  return row ?? null
}

export async function deleteOptionUnitTier(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(optionUnitTiers)
    .where(eq(optionUnitTiers.id, id))
    .returning({ id: optionUnitTiers.id })
  return row ?? null
}
