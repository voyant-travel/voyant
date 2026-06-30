import { RequestValidationError } from "@voyant-travel/hono"
import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { optionUnits, productOptions, products } from "./schema.js"
import type {
  insertOptionUnitSchema,
  insertProductOptionSchema,
  optionUnitListQuerySchema,
  productOptionListQuerySchema,
  updateOptionUnitSchema,
  updateProductOptionSchema,
} from "./validation.js"
import { validateMergedOptionUnit } from "./validation-core.js"

type ProductOptionListQuery = z.infer<typeof productOptionListQuerySchema>
type CreateProductOptionInput = z.infer<typeof insertProductOptionSchema>
type UpdateProductOptionInput = z.infer<typeof updateProductOptionSchema>
type OptionUnitListQuery = z.infer<typeof optionUnitListQuerySchema>
type CreateOptionUnitInput = z.infer<typeof insertOptionUnitSchema>
type UpdateOptionUnitInput = z.infer<typeof updateOptionUnitSchema>

export const optionProductsService = {
  async listOptions(db: PostgresJsDatabase, query: ProductOptionListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productOptions.productId, query.productId))
    }

    if (query.status) {
      conditions.push(eq(productOptions.status, query.status))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productOptions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productOptions).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getOptionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productOptions).where(eq(productOptions.id, id)).limit(1)
    return row ?? null
  },

  async createOption(db: PostgresJsDatabase, productId: string, data: CreateProductOptionInput) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productOptions.productId, productId))
    }

    const [row] = await db
      .insert(productOptions)
      .values({ ...data, productId })
      .returning()

    return row
  },

  async updateOption(db: PostgresJsDatabase, id: string, data: UpdateProductOptionInput) {
    const [current] = await db
      .select({ id: productOptions.id, productId: productOptions.productId })
      .from(productOptions)
      .where(eq(productOptions.id, id))
      .limit(1)

    if (!current) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productOptions.productId, current.productId))
    }

    const [row] = await db
      .update(productOptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productOptions.id, id))
      .returning()

    return row ?? null
  },

  async deleteOption(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productOptions)
      .where(eq(productOptions.id, id))
      .returning({ id: productOptions.id })

    return row ?? null
  },

  async listUnits(db: PostgresJsDatabase, query: OptionUnitListQuery) {
    const conditions = []

    if (query.optionId) {
      conditions.push(eq(optionUnits.optionId, query.optionId))
    }

    if (query.unitType) {
      conditions.push(eq(optionUnits.unitType, query.unitType))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(optionUnits)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(optionUnits).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getUnitById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(optionUnits).where(eq(optionUnits.id, id)).limit(1)
    return row ?? null
  },

  async getUnitForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select({ unit: optionUnits, productId: productOptions.productId })
      .from(optionUnits)
      .innerJoin(productOptions, eq(optionUnits.optionId, productOptions.id))
      .where(eq(optionUnits.id, id))
      .limit(1)

    return row ? { ...row.unit, productId: row.productId } : null
  },

  async createUnit(db: PostgresJsDatabase, optionId: string, data: CreateOptionUnitInput) {
    const [option] = await db
      .select({ id: productOptions.id })
      .from(productOptions)
      .where(eq(productOptions.id, optionId))
      .limit(1)

    if (!option) {
      return null
    }

    const validation = validateMergedOptionUnit(data)
    if (!validation.ok) {
      const first = validation.issues[0]
      throw new RequestValidationError(first?.message ?? "Invalid option unit", {
        issues: validation.issues,
      })
    }

    const [row] = await db
      .insert(optionUnits)
      .values({ ...data, optionId })
      .returning()

    return row
  },

  async updateUnit(db: PostgresJsDatabase, id: string, data: UpdateOptionUnitInput) {
    const [existing] = await db
      .select({
        unitType: optionUnits.unitType,
        minAge: optionUnits.minAge,
        maxAge: optionUnits.maxAge,
        occupancyMin: optionUnits.occupancyMin,
        occupancyMax: optionUnits.occupancyMax,
      })
      .from(optionUnits)
      .where(eq(optionUnits.id, id))
      .limit(1)

    if (!existing) {
      return null
    }

    const merged = {
      unitType: "unitType" in data ? data.unitType : existing.unitType,
      minAge: "minAge" in data ? data.minAge : existing.minAge,
      maxAge: "maxAge" in data ? data.maxAge : existing.maxAge,
      occupancyMin: "occupancyMin" in data ? data.occupancyMin : existing.occupancyMin,
      occupancyMax: "occupancyMax" in data ? data.occupancyMax : existing.occupancyMax,
    }

    const validation = validateMergedOptionUnit(merged)
    if (!validation.ok) {
      const first = validation.issues[0]
      throw new RequestValidationError(first?.message ?? "Invalid option unit", {
        issues: validation.issues,
      })
    }

    const [row] = await db
      .update(optionUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(optionUnits.id, id))
      .returning()

    return row ?? null
  },

  async deleteUnit(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(optionUnits)
      .where(eq(optionUnits.id, id))
      .returning({ id: optionUnits.id })

    return row ?? null
  },
}
