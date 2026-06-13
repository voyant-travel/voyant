import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { quoteParticipants, quoteProducts, quotes } from "../schema.js"
import type {
  insertQuoteParticipantSchema,
  insertQuoteProductSchema,
  insertQuoteSchema,
  quoteListQuerySchema,
  updateQuoteProductSchema,
  updateQuoteSchema,
} from "../validation.js"
import { paginate } from "./helpers.js"

type QuoteListQuery = z.infer<typeof quoteListQuerySchema>
type CreateQuoteInput = z.infer<typeof insertQuoteSchema>
type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
type CreateQuoteParticipantInput = z.infer<typeof insertQuoteParticipantSchema>
type CreateQuoteProductInput = z.infer<typeof insertQuoteProductSchema>
type UpdateQuoteProductInput = z.infer<typeof updateQuoteProductSchema>

export const quotesService = {
  async listQuotes(db: PostgresJsDatabase, query: QuoteListQuery) {
    const conditions = []

    if (query.personId) conditions.push(eq(quotes.personId, query.personId))
    if (query.organizationId) conditions.push(eq(quotes.organizationId, query.organizationId))
    if (query.pipelineId) conditions.push(eq(quotes.pipelineId, query.pipelineId))
    if (query.stageId) conditions.push(eq(quotes.stageId, query.stageId))
    if (query.ownerId) conditions.push(eq(quotes.ownerId, query.ownerId))
    if (query.status) conditions.push(eq(quotes.status, query.status))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(
        or(ilike(quotes.title, term), ilike(quotes.source, term), ilike(quotes.sourceRef, term)),
      )
    }

    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(quotes)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(quotes.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(quotes).where(where),
      query.limit,
      query.offset,
    )
  },

  async getQuoteById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1)
    return row ?? null
  },

  async createQuote(db: PostgresJsDatabase, data: CreateQuoteInput) {
    const [row] = await db.insert(quotes).values(data).returning()
    return row
  },

  async updateQuote(db: PostgresJsDatabase, id: string, data: UpdateQuoteInput) {
    const patch: UpdateQuoteInput & {
      updatedAt: Date
      stageChangedAt?: Date
      closedAt?: Date | null
    } = {
      ...data,
      updatedAt: new Date(),
    }

    if (data.stageId) patch.stageChangedAt = new Date()
    if (data.status && data.status !== "open") {
      patch.closedAt = new Date()
    }
    if (data.status === "open") {
      patch.closedAt = null
    }

    const [row] = await db.update(quotes).set(patch).where(eq(quotes.id, id)).returning()
    return row ?? null
  },

  async deleteQuote(db: PostgresJsDatabase, id: string) {
    const [row] = await db.delete(quotes).where(eq(quotes.id, id)).returning({ id: quotes.id })
    return row ?? null
  },

  listQuoteParticipants(db: PostgresJsDatabase, quoteId: string) {
    return db
      .select()
      .from(quoteParticipants)
      .where(eq(quoteParticipants.quoteId, quoteId))
      .orderBy(desc(quoteParticipants.isPrimary), quoteParticipants.createdAt)
  },

  async createQuoteParticipant(
    db: PostgresJsDatabase,
    quoteId: string,
    data: CreateQuoteParticipantInput,
  ) {
    const [row] = await db
      .insert(quoteParticipants)
      .values({ ...data, quoteId })
      .returning()
    return row
  },

  async deleteQuoteParticipant(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(quoteParticipants)
      .where(eq(quoteParticipants.id, id))
      .returning({ id: quoteParticipants.id })
    return row ?? null
  },

  listQuoteProducts(db: PostgresJsDatabase, quoteId: string) {
    return db
      .select()
      .from(quoteProducts)
      .where(eq(quoteProducts.quoteId, quoteId))
      .orderBy(quoteProducts.createdAt)
  },

  async createQuoteProduct(db: PostgresJsDatabase, quoteId: string, data: CreateQuoteProductInput) {
    const [row] = await db
      .insert(quoteProducts)
      .values({ ...data, quoteId })
      .returning()
    return row
  },

  async updateQuoteProduct(db: PostgresJsDatabase, id: string, data: UpdateQuoteProductInput) {
    const [row] = await db
      .update(quoteProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteProducts.id, id))
      .returning()
    return row ?? null
  },

  async deleteQuoteProduct(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(quoteProducts)
      .where(eq(quoteProducts.id, id))
      .returning({ id: quoteProducts.id })
    return row ?? null
  },
}
