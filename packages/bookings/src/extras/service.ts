import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { bookingExtras } from "./schema.js"
import { bookingsExtrasManifestService } from "./service-manifest.js"
import type {
  bookingExtraListQuerySchema,
  insertBookingExtraSchema,
  updateBookingExtraSchema,
} from "./validation.js"

type BookingExtraListQuery = z.infer<typeof bookingExtraListQuerySchema>
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

export const bookingsExtrasService = {
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

  ...bookingsExtrasManifestService,
}
