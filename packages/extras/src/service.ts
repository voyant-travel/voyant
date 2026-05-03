import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { bookingExtras, optionExtraConfigs, productExtras } from "./schema.js"
import type {
  bookingExtraListQuerySchema,
  insertBookingExtraSchema,
  insertOptionExtraConfigSchema,
  insertProductExtraSchema,
  optionExtraConfigListQuerySchema,
  productExtraListQuerySchema,
  updateBookingExtraSchema,
  updateOptionExtraConfigSchema,
  updateProductExtraSchema,
} from "./validation.js"

type ProductExtraListQuery = z.infer<typeof productExtraListQuerySchema>
type OptionExtraConfigListQuery = z.infer<typeof optionExtraConfigListQuerySchema>
type BookingExtraListQuery = z.infer<typeof bookingExtraListQuerySchema>
type CreateProductExtraInput = z.infer<typeof insertProductExtraSchema>
type UpdateProductExtraInput = z.infer<typeof updateProductExtraSchema>
type CreateOptionExtraConfigInput = z.infer<typeof insertOptionExtraConfigSchema>
type UpdateOptionExtraConfigInput = z.infer<typeof updateOptionExtraConfigSchema>
type CreateBookingExtraInput = z.infer<typeof insertBookingExtraSchema>
type UpdateBookingExtraInput = z.infer<typeof updateBookingExtraSchema>

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

export const extrasService = {
  async listProductExtras(db: PostgresJsDatabase, query: ProductExtraListQuery) {
    const conditions = []
    if (query.productId) conditions.push(eq(productExtras.productId, query.productId))
    if (query.supplierId) conditions.push(eq(productExtras.supplierId, query.supplierId))
    if (query.active !== undefined) conditions.push(eq(productExtras.active, query.active))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(productExtras.name, term), ilike(productExtras.code, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(productExtras)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productExtras.sortOrder), asc(productExtras.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(productExtras).where(where),
      query.limit,
      query.offset,
    )
  },

  async getProductExtraById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productExtras).where(eq(productExtras.id, id)).limit(1)
    return row ?? null
  },

  async createProductExtra(db: PostgresJsDatabase, data: CreateProductExtraInput) {
    const [row] = await db.insert(productExtras).values(data).returning()
    return row ?? null
  },

  async updateProductExtra(db: PostgresJsDatabase, id: string, data: UpdateProductExtraInput) {
    const [row] = await db
      .update(productExtras)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productExtras.id, id))
      .returning()
    return row ?? null
  },

  async deleteProductExtra(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productExtras)
      .where(eq(productExtras.id, id))
      .returning({ id: productExtras.id })
    return row ?? null
  },

  async listOptionExtraConfigs(db: PostgresJsDatabase, query: OptionExtraConfigListQuery) {
    const conditions = []
    if (query.optionId) conditions.push(eq(optionExtraConfigs.optionId, query.optionId))
    if (query.productExtraId)
      conditions.push(eq(optionExtraConfigs.productExtraId, query.productExtraId))
    if (query.active !== undefined) conditions.push(eq(optionExtraConfigs.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(optionExtraConfigs)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(optionExtraConfigs.sortOrder), desc(optionExtraConfigs.isDefault)),
      db.select({ count: sql<number>`count(*)::int` }).from(optionExtraConfigs).where(where),
      query.limit,
      query.offset,
    )
  },

  async getOptionExtraConfigById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(optionExtraConfigs)
      .where(eq(optionExtraConfigs.id, id))
      .limit(1)
    return row ?? null
  },

  async createOptionExtraConfig(db: PostgresJsDatabase, data: CreateOptionExtraConfigInput) {
    const [row] = await db.insert(optionExtraConfigs).values(data).returning()
    return row ?? null
  },

  async updateOptionExtraConfig(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateOptionExtraConfigInput,
  ) {
    const [row] = await db
      .update(optionExtraConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(optionExtraConfigs.id, id))
      .returning()
    return row ?? null
  },

  async deleteOptionExtraConfig(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(optionExtraConfigs)
      .where(eq(optionExtraConfigs.id, id))
      .returning({ id: optionExtraConfigs.id })
    return row ?? null
  },

  async listBookingExtras(db: PostgresJsDatabase, query: BookingExtraListQuery) {
    const conditions = []
    if (query.bookingId) conditions.push(eq(bookingExtras.bookingId, query.bookingId))
    if (query.productExtraId)
      conditions.push(eq(bookingExtras.productExtraId, query.productExtraId))
    if (query.optionExtraConfigId)
      conditions.push(eq(bookingExtras.optionExtraConfigId, query.optionExtraConfigId))
    if (query.status) conditions.push(eq(bookingExtras.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(bookingExtras)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(bookingExtras.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(bookingExtras).where(where),
      query.limit,
      query.offset,
    )
  },

  async getBookingExtraById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(bookingExtras).where(eq(bookingExtras.id, id)).limit(1)
    return row ?? null
  },

  async createBookingExtra(db: PostgresJsDatabase, data: CreateBookingExtraInput) {
    const [row] = await db.insert(bookingExtras).values(data).returning()
    return row ?? null
  },

  async updateBookingExtra(db: PostgresJsDatabase, id: string, data: UpdateBookingExtraInput) {
    const [row] = await db
      .update(bookingExtras)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingExtras.id, id))
      .returning()
    return row ?? null
  },

  async deleteBookingExtra(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(bookingExtras)
      .where(eq(bookingExtras.id, id))
      .returning({ id: bookingExtras.id })
    return row ?? null
  },
}
