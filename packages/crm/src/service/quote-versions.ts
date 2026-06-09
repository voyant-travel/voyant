import { and, desc, eq, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  type Quote,
  type QuoteVersion,
  type QuoteVersionLine,
  quotes,
  quoteVersionLines,
  quoteVersions,
} from "../schema.js"
import type {
  acceptQuoteVersionSchema,
  applyTripSnapshotToQuoteVersionSchema,
  declineQuoteVersionSchema,
  expireQuoteVersionsSchema,
  insertQuoteVersionLineSchema,
  insertQuoteVersionSchema,
  quoteVersionListQuerySchema,
  sendQuoteVersionSchema,
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
type SendQuoteVersionInput = z.infer<typeof sendQuoteVersionSchema>
type AcceptQuoteVersionInput = z.infer<typeof acceptQuoteVersionSchema>
type DeclineQuoteVersionInput = z.infer<typeof declineQuoteVersionSchema>
type ExpireQuoteVersionsInput = z.infer<typeof expireQuoteVersionsSchema>

export interface QuoteVersionProposalReadModel {
  quote: Quote
  quoteVersion: QuoteVersion
  lines: QuoteVersionLine[]
}

export interface AcceptQuoteVersionResult {
  quote: Quote
  quoteVersion: QuoteVersion
  closedQuoteVersions: QuoteVersion[]
}

export class QuoteVersionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuoteVersionConflictError"
  }
}

function normalizeTimestamp(value: string | null | undefined) {
  return value == null ? value : new Date(value)
}

function normalizeNow(value: Date | string | null | undefined) {
  return value instanceof Date ? value : value ? new Date(value) : new Date()
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10)
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

  async getQuoteVersionProposal(
    db: PostgresJsDatabase,
    id: string,
  ): Promise<QuoteVersionProposalReadModel | null> {
    const [row] = await db
      .select({
        quoteVersion: quoteVersions,
        quote: quotes,
      })
      .from(quoteVersions)
      .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
      .where(eq(quoteVersions.id, id))
      .limit(1)

    if (!row) return null

    return {
      quote: row.quote,
      quoteVersion: row.quoteVersion,
      lines: await db
        .select()
        .from(quoteVersionLines)
        .where(eq(quoteVersionLines.quoteVersionId, id))
        .orderBy(quoteVersionLines.createdAt),
    }
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

  async sendQuoteVersion(db: PostgresJsDatabase, id: string, data: SendQuoteVersionInput = {}) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(quoteVersions)
        .where(eq(quoteVersions.id, id))
        .limit(1)

      if (!existing) return null
      if (existing.status !== "draft") {
        throw new QuoteVersionConflictError("Quote Versions can only be sent from draft")
      }
      if (!existing.tripSnapshotId) {
        throw new QuoteVersionConflictError(
          "Quote Versions must have a Trip snapshot before they can be sent",
        )
      }

      const now = new Date()
      const validUntil = data.validUntil === undefined ? existing.validUntil : data.validUntil
      if (validUntil && validUntil < toDateString(now)) {
        throw new QuoteVersionConflictError("Quote Version validUntil must be today or later")
      }

      const [row] = await tx
        .update(quoteVersions)
        .set({
          status: "sent",
          validUntil,
          sentAt: now,
          viewedAt: null,
          decidedAt: null,
          updatedAt: now,
        })
        .where(eq(quoteVersions.id, id))
        .returning()

      return row ?? null
    })
  },

  async markQuoteVersionViewed(db: PostgresJsDatabase, id: string) {
    const now = new Date()
    const [row] = await db
      .update(quoteVersions)
      .set({
        viewedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(quoteVersions.id, id),
          eq(quoteVersions.status, "sent"),
          isNull(quoteVersions.viewedAt),
        ),
      )
      .returning()

    if (row) return row

    const [existing] = await db
      .select()
      .from(quoteVersions)
      .where(eq(quoteVersions.id, id))
      .limit(1)
    return existing ?? null
  },

  async acceptQuoteVersion(
    db: PostgresJsDatabase,
    id: string,
    _data: AcceptQuoteVersionInput = {},
  ): Promise<AcceptQuoteVersionResult | null> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          quoteVersion: quoteVersions,
          quote: quotes,
        })
        .from(quoteVersions)
        .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
        .where(eq(quoteVersions.id, id))
        .limit(1)

      if (!current) return null

      if (
        current.quote.acceptedVersionId &&
        current.quote.acceptedVersionId !== current.quoteVersion.id
      ) {
        throw new QuoteVersionConflictError("Quote already has an accepted Quote Version")
      }

      if (current.quoteVersion.status === "accepted") {
        return {
          quote: current.quote,
          quoteVersion: current.quoteVersion,
          closedQuoteVersions: [],
        }
      }

      if (current.quoteVersion.status !== "sent") {
        throw new QuoteVersionConflictError(
          "Quote Versions can only be accepted after they are sent",
        )
      }

      const now = new Date()
      const [quoteVersion] = await tx
        .update(quoteVersions)
        .set({
          status: "accepted",
          decidedAt: now,
          updatedAt: now,
        })
        .where(and(eq(quoteVersions.id, id), eq(quoteVersions.status, "sent")))
        .returning()

      if (!quoteVersion) {
        throw new QuoteVersionConflictError(
          "Quote Versions can only be accepted after they are sent",
        )
      }

      const declinedVersions = await tx
        .update(quoteVersions)
        .set({
          status: "declined",
          decidedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(quoteVersions.quoteId, quoteVersion.quoteId),
            ne(quoteVersions.id, quoteVersion.id),
            eq(quoteVersions.status, "sent"),
          ),
        )
        .returning()

      const supersededVersions = await tx
        .update(quoteVersions)
        .set({
          status: "superseded",
          decidedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(quoteVersions.quoteId, quoteVersion.quoteId),
            ne(quoteVersions.id, quoteVersion.id),
            eq(quoteVersions.status, "draft"),
          ),
        )
        .returning()

      const [quote] = await tx
        .update(quotes)
        .set({
          status: "won",
          acceptedVersionId: quoteVersion.id,
          valueAmountCents: quoteVersion.totalAmountCents,
          valueCurrency: quoteVersion.currency,
          closedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotes.id, quoteVersion.quoteId),
            or(isNull(quotes.acceptedVersionId), eq(quotes.acceptedVersionId, quoteVersion.id)),
          ),
        )
        .returning()

      if (!quote) {
        throw new QuoteVersionConflictError("Quote already has an accepted Quote Version")
      }

      return {
        quote,
        quoteVersion,
        closedQuoteVersions: [...declinedVersions, ...supersededVersions],
      }
    })
  },

  async declineQuoteVersion(
    db: PostgresJsDatabase,
    id: string,
    _data: DeclineQuoteVersionInput = {},
  ) {
    const now = new Date()
    const [row] = await db
      .update(quoteVersions)
      .set({
        status: "declined",
        decidedAt: now,
        updatedAt: now,
      })
      .where(and(eq(quoteVersions.id, id), eq(quoteVersions.status, "sent")))
      .returning()

    if (row) return row

    const [existing] = await db
      .select({ status: quoteVersions.status })
      .from(quoteVersions)
      .where(eq(quoteVersions.id, id))
      .limit(1)
    if (!existing) return null
    throw new QuoteVersionConflictError("Quote Versions can only be declined after they are sent")
  },

  async expireQuoteVersionIfPastValidUntil(
    db: PostgresJsDatabase,
    id: string,
    nowValue?: Date | string,
  ) {
    const now = normalizeNow(nowValue)
    const [row] = await db
      .update(quoteVersions)
      .set({
        status: "expired",
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(quoteVersions.id, id),
          eq(quoteVersions.status, "sent"),
          isNotNull(quoteVersions.validUntil),
          lt(quoteVersions.validUntil, toDateString(now)),
        ),
      )
      .returning()

    return row ?? null
  },

  async expireQuoteVersions(db: PostgresJsDatabase, data: ExpireQuoteVersionsInput = {}) {
    const now = normalizeNow(data.now)
    const rows = await db
      .update(quoteVersions)
      .set({
        status: "expired",
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(quoteVersions.status, "sent"),
          isNotNull(quoteVersions.validUntil),
          lt(quoteVersions.validUntil, toDateString(now)),
        ),
      )
      .returning()

    return rows
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
