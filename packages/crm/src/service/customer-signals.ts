import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { customerSignals, people } from "../schema.js"
import type {
  customerSignalListQuerySchema,
  insertCustomerSignalSchema,
  updateCustomerSignalSchema,
} from "../validation.js"
import { paginate } from "./helpers.js"

export type CreateCustomerSignalInput = z.infer<typeof insertCustomerSignalSchema>
export type UpdateCustomerSignalInput = z.infer<typeof updateCustomerSignalSchema>
export type CustomerSignalListQuery = z.infer<typeof customerSignalListQuerySchema>

async function personExists(db: PostgresJsDatabase, personId: string) {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)
  return Boolean(row)
}

function normaliseFollowUpAt(value: string | null | undefined) {
  if (value == null) return value ?? null
  return new Date(value)
}

export const customerSignalsService = {
  /**
   * Top-level list with filters. Defaults to newest-first so the
   * sales-pipeline UI shows fresh inquiries on top.
   */
  async listCustomerSignals(db: PostgresJsDatabase, query: CustomerSignalListQuery) {
    const conditions = []
    if (query.personId) conditions.push(eq(customerSignals.personId, query.personId))
    if (query.assignedToUserId) {
      conditions.push(eq(customerSignals.assignedToUserId, query.assignedToUserId))
    }
    if (query.status) conditions.push(eq(customerSignals.status, query.status))
    if (query.kind) conditions.push(eq(customerSignals.kind, query.kind))
    if (query.productId) conditions.push(eq(customerSignals.productId, query.productId))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(customerSignals.notes, term)))
    }

    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(customerSignals)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(customerSignals.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(customerSignals).where(where),
      query.limit,
      query.offset,
    )
  },

  /**
   * Per-person convenience list — same shape, ordered oldest-first
   * so a person's signal history reads chronologically alongside
   * their notes / activities.
   */
  listSignalsForPerson(db: PostgresJsDatabase, personId: string) {
    return db
      .select()
      .from(customerSignals)
      .where(eq(customerSignals.personId, personId))
      .orderBy(asc(customerSignals.createdAt))
  },

  async getCustomerSignal(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(customerSignals).where(eq(customerSignals.id, id)).limit(1)
    return row ?? null
  },

  async createCustomerSignal(db: PostgresJsDatabase, data: CreateCustomerSignalInput) {
    if (!(await personExists(db, data.personId))) return null
    const [row] = await db
      .insert(customerSignals)
      .values({
        ...data,
        followUpAt: normaliseFollowUpAt(data.followUpAt),
      })
      .returning()
    return row ?? null
  },

  async updateCustomerSignal(db: PostgresJsDatabase, id: string, data: UpdateCustomerSignalInput) {
    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() }
    if (data.followUpAt !== undefined) {
      updates.followUpAt = normaliseFollowUpAt(data.followUpAt)
    }
    const [row] = await db
      .update(customerSignals)
      .set(updates)
      .where(eq(customerSignals.id, id))
      .returning()
    return row ?? null
  },

  async deleteCustomerSignal(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(customerSignals)
      .where(eq(customerSignals.id, id))
      .returning({ id: customerSignals.id })
    return row ?? null
  },

  /**
   * Closes the loop: marks the signal as converted and records the
   * booking it became. The caller (operator UI) is responsible for
   * actually creating the booking; this is just the bookkeeping.
   */
  async resolveCustomerSignalToBooking(
    db: PostgresJsDatabase,
    signalId: string,
    bookingId: string,
  ) {
    const [row] = await db
      .update(customerSignals)
      .set({
        resolvedBookingId: bookingId,
        status: "converted",
        updatedAt: new Date(),
      })
      .where(eq(customerSignals.id, signalId))
      .returning()
    return row ?? null
  },
}
