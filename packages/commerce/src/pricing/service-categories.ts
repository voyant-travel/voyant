import { and, asc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { pricingCategories, pricingCategoryDependencies } from "./schema.js"
import type {
  CreatePricingCategoryDependencyInput,
  CreatePricingCategoryInput,
  PricingCategoryDependencyListQuery,
  PricingCategoryListQuery,
  UpdatePricingCategoryDependencyInput,
  UpdatePricingCategoryInput,
} from "./service-shared.js"
import { paginate } from "./service-shared.js"

export async function listPricingCategories(
  db: PostgresJsDatabase,
  query: PricingCategoryListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(pricingCategories.productId, query.productId))
  if (query.optionId) conditions.push(eq(pricingCategories.optionId, query.optionId))
  if (query.unitId) conditions.push(eq(pricingCategories.unitId, query.unitId))
  if (query.categoryType) conditions.push(eq(pricingCategories.categoryType, query.categoryType))
  if (query.active !== undefined) conditions.push(eq(pricingCategories.active, query.active))
  if (query.search) {
    const term = `%${query.search}%`
    conditions.push(or(ilike(pricingCategories.name, term), ilike(pricingCategories.code, term)))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(pricingCategories)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(pricingCategories.sortOrder), asc(pricingCategories.name)),
    db.select({ count: sql<number>`count(*)::int` }).from(pricingCategories).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPricingCategoryById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(pricingCategories)
    .where(eq(pricingCategories.id, id))
    .limit(1)
  return row ?? null
}

export async function createPricingCategory(
  db: PostgresJsDatabase,
  data: CreatePricingCategoryInput,
) {
  const [row] = await db.insert(pricingCategories).values(data).returning()
  return row ?? null
}

export async function updatePricingCategory(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePricingCategoryInput,
) {
  const [row] = await db
    .update(pricingCategories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pricingCategories.id, id))
    .returning()
  return row ?? null
}

export async function deletePricingCategory(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(pricingCategories)
    .where(eq(pricingCategories.id, id))
    .returning({ id: pricingCategories.id })
  return row ?? null
}

export async function listPricingCategoryDependencies(
  db: PostgresJsDatabase,
  query: PricingCategoryDependencyListQuery,
) {
  const conditions = []
  if (query.pricingCategoryId) {
    conditions.push(eq(pricingCategoryDependencies.pricingCategoryId, query.pricingCategoryId))
  }
  if (query.masterPricingCategoryId) {
    conditions.push(
      eq(pricingCategoryDependencies.masterPricingCategoryId, query.masterPricingCategoryId),
    )
  }
  if (query.dependencyType) {
    conditions.push(eq(pricingCategoryDependencies.dependencyType, query.dependencyType))
  }
  if (query.active !== undefined) {
    conditions.push(eq(pricingCategoryDependencies.active, query.active))
  }
  const where = conditions.length ? and(...conditions) : undefined

  return paginate(
    db
      .select()
      .from(pricingCategoryDependencies)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(pricingCategoryDependencies.createdAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(pricingCategoryDependencies).where(where),
    query.limit,
    query.offset,
  )
}

export async function getPricingCategoryDependencyById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(pricingCategoryDependencies)
    .where(eq(pricingCategoryDependencies.id, id))
    .limit(1)
  return row ?? null
}

export async function createPricingCategoryDependency(
  db: PostgresJsDatabase,
  data: CreatePricingCategoryDependencyInput,
) {
  const [row] = await db.insert(pricingCategoryDependencies).values(data).returning()
  return row ?? null
}

export async function updatePricingCategoryDependency(
  db: PostgresJsDatabase,
  id: string,
  data: UpdatePricingCategoryDependencyInput,
) {
  const [row] = await db
    .update(pricingCategoryDependencies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pricingCategoryDependencies.id, id))
    .returning()
  return row ?? null
}

export async function deletePricingCategoryDependency(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .delete(pricingCategoryDependencies)
    .where(eq(pricingCategoryDependencies.id, id))
    .returning({ id: pricingCategoryDependencies.id })
  return row ?? null
}
