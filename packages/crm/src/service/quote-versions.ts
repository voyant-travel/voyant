import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { quoteVersionLines, quoteVersions } from "../schema.js"
import type {
  applyTripSnapshotToQuoteVersionSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  quoteVersionListQuerySchema,
  updateQuoteVersionLineSchema,
  updateQuoteVersionSchema,
} from "../validation.js"
import { paginate } from "./helpers.js"

type QuoteVersionListQuery = z.infer<typeof quoteVersionListQuerySchema>
type CreateQuoteVersionInput = z.infer<typeof insertQuoteVersionSchema>
type UpdateQuoteVersionInput = z.infer<typeof updateQuoteVersionSchema>
type CreateQuoteVersionLineInput = z.infer<typeof insertQuoteVersionLineSchema>
type UpdateQuoteVersionLineInput = z.infer<typeof updateQuoteVersionLineSchema>
type ApplyTripSnapshotToQuoteVersionInput = z.infer<typeof applyTripSnapshotToQuoteVersionSchema>

export class QuoteVersionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuoteVersionConflictError"
  }
}

function normalizeTimestamp(value: string | null | undefined) {
  return value == null ? value : new Date(value)
}

export const quoteVersionsService = {
  async listQuoteVersions(db: PostgresJsDatabase, query: QuoteVersionListQuery) {
    const conditions = []
    if (query.quoteId) conditions.push(eq(quoteVersions.quoteId, query.quoteId))
    if (query.status) conditions.push(eq(quoteVersions.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined

    return paginate(
      db
        .select()
        .from(quoteVersions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(quoteVersions.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(quoteVersions).where(where),
      query.limit,
      query.offset,
    )
  },

  async getQuoteVersionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(quoteVersions).where(eq(quoteVersions.id, id)).limit(1)
    return row ?? null
  },

  async createQuoteVersion(db: PostgresJsDatabase, data: CreateQuoteVersionInput) {
    const values = {
      ...data,
      sentAt: normalizeTimestamp(data.sentAt),
      viewedAt: normalizeTimestamp(data.viewedAt),
      decidedAt: normalizeTimestamp(data.decidedAt),
    }
    const [row] = await db.insert(quoteVersions).values(values).returning()
    return row
  },

  async updateQuoteVersion(db: PostgresJsDatabase, id: string, data: UpdateQuoteVersionInput) {
    const values = {
      ...data,
      sentAt: normalizeTimestamp(data.sentAt),
      viewedAt: normalizeTimestamp(data.viewedAt),
      decidedAt: normalizeTimestamp(data.decidedAt),
      updatedAt: new Date(),
    }
    const [row] = await db
      .update(quoteVersions)
      .set(values)
      .where(eq(quoteVersions.id, id))
      .returning()
    return row ?? null
  },

  async deleteQuoteVersion(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(quoteVersions)
      .where(eq(quoteVersions.id, id))
      .returning({ id: quoteVersions.id })
    return row ?? null
  },

  async applyTripSnapshotToQuoteVersion(
    db: PostgresJsDatabase,
    id: string,
    data: ApplyTripSnapshotToQuoteVersionInput,
  ) {
    return db.transaction(async (tx) => {
      const [quoteVersion] = await tx
        .update(quoteVersions)
        .set({
          tripSnapshotId: data.tripSnapshotId,
          currency: data.currency,
          subtotalAmountCents: data.subtotalAmountCents,
          taxAmountCents: data.taxAmountCents,
          totalAmountCents: data.totalAmountCents,
          updatedAt: new Date(),
        })
        .where(and(eq(quoteVersions.id, id), eq(quoteVersions.status, "draft")))
        .returning()

      if (!quoteVersion) {
        const [existing] = await tx
          .select({ status: quoteVersions.status })
          .from(quoteVersions)
          .where(eq(quoteVersions.id, id))
          .limit(1)
        if (!existing) return null
        throw new QuoteVersionConflictError(
          "Trip snapshots can only be applied to draft Quote Versions",
        )
      }

      await tx.delete(quoteVersionLines).where(eq(quoteVersionLines.quoteVersionId, id))

      const lineValues = data.lines.map(({ componentId: _componentId, ...line }) => ({
        ...line,
        quoteVersionId: id,
      }))
      const lines =
        lineValues.length > 0
          ? await tx.insert(quoteVersionLines).values(lineValues).returning()
          : []

      return { quoteVersion, lines }
    })
  },

  listQuoteVersionLines(db: PostgresJsDatabase, quoteVersionId: string) {
    return db
      .select()
      .from(quoteVersionLines)
      .where(eq(quoteVersionLines.quoteVersionId, quoteVersionId))
      .orderBy(quoteVersionLines.createdAt)
  },

  async createQuoteVersionLine(
    db: PostgresJsDatabase,
    quoteVersionId: string,
    data: CreateQuoteVersionLineInput,
  ) {
    const [row] = await db
      .insert(quoteVersionLines)
      .values({ ...data, quoteVersionId })
      .returning()
    return row
  },

  async updateQuoteVersionLine(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateQuoteVersionLineInput,
  ) {
    const [row] = await db
      .update(quoteVersionLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteVersionLines.id, id))
      .returning()
    return row ?? null
  },

  async deleteQuoteVersionLine(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(quoteVersionLines)
      .where(eq(quoteVersionLines.id, id))
      .returning({ id: quoteVersionLines.id })
    return row ?? null
  },
}
