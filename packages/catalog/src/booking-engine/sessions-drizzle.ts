import { AsyncLocalStorage } from "node:async_hooks"
import { withOptionalTransaction } from "@voyant-travel/db/transaction"
import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { PricingBreakdownV1 } from "./contracts.js"
import {
  bookingSessionCommitsTable,
  bookingSessionHoldsTable,
  bookingSessionQuotesTable,
  bookingSessionsTable,
  type SelectBookingSession,
  type SelectBookingSessionCommit,
  type SelectBookingSessionHold,
  type SelectBookingSessionQuote,
} from "./sessions-schema.js"
import type {
  BookingCommitInternalRecord,
  BookingHoldInternalRecord,
  BookingQuoteInternalRecord,
  BookingSessionInternalRecord,
  BookingSessionRepository,
} from "./sessions-service.js"

export function createDrizzleBookingSessionRepository(
  db: PostgresJsDatabase,
): BookingSessionRepository {
  const txStore = new AsyncLocalStorage<PostgresJsDatabase>()
  const resolveDb = () => txStore.getStore() ?? db

  return {
    async createSession(record) {
      const [row] = await resolveDb()
        .insert(bookingSessionsTable)
        .values({
          id: record.id,
          capabilityHash: record.capabilityHash,
          actorKind: record.actorKind,
          targetKind: record.target.kind,
          productId: record.target.productId,
          catalogItemId: record.target.catalogItemId,
          state: record.state,
          revision: record.revision,
          statePayload: record.statePayload,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })
        .returning()
      return row ? mapSession(row, record.capability) : record
    },
    async getSession(sessionId) {
      const [row] = await resolveDb()
        .select()
        .from(bookingSessionsTable)
        .where(eq(bookingSessionsTable.id, sessionId))
        .limit(1)
      return row ? mapSession(row) : null
    },
    async saveSession(record) {
      await resolveDb()
        .update(bookingSessionsTable)
        .set({
          capabilityHash: record.capabilityHash,
          actorKind: record.actorKind,
          targetKind: record.target.kind,
          productId: record.target.productId,
          catalogItemId: record.target.catalogItemId,
          state: record.state,
          revision: record.revision,
          statePayload: record.statePayload,
          expiresAt: record.expiresAt,
          consumedAt: record.state === "consumed" ? record.updatedAt : null,
          abandonedAt: record.state === "abandoned" ? record.updatedAt : null,
          updatedAt: record.updatedAt,
        })
        .where(eq(bookingSessionsTable.id, record.id))
    },
    async listActiveQuotes(sessionId) {
      const rows = await resolveDb()
        .select()
        .from(bookingSessionQuotesTable)
        .where(
          and(
            eq(bookingSessionQuotesTable.sessionId, sessionId),
            eq(bookingSessionQuotesTable.state, "active"),
          ),
        )
      return rows.map(mapQuote)
    },
    async getQuote(quoteId) {
      const [row] = await resolveDb()
        .select()
        .from(bookingSessionQuotesTable)
        .where(eq(bookingSessionQuotesTable.id, quoteId))
        .limit(1)
      return row ? mapQuote(row) : null
    },
    async saveQuote(record) {
      await resolveDb()
        .insert(bookingSessionQuotesTable)
        .values({
          id: record.id,
          sessionId: record.sessionId,
          sessionRevision: record.sessionRevision,
          state: record.state,
          pricing: record.pricing,
          priceFingerprint: record.priceFingerprint,
          quotedAt: record.quotedAt,
          expiresAt: record.expiresAt,
          consumedAt: record.state === "consumed" ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: bookingSessionQuotesTable.id,
          set: {
            state: record.state,
            pricing: record.pricing,
            priceFingerprint: record.priceFingerprint,
            expiresAt: record.expiresAt,
            consumedAt: record.state === "consumed" ? new Date() : null,
          },
        })
    },
    async getHold(holdId) {
      const [row] = await resolveDb()
        .select()
        .from(bookingSessionHoldsTable)
        .where(eq(bookingSessionHoldsTable.id, holdId))
        .limit(1)
      return row ? mapHold(row) : null
    },
    async saveHold(record) {
      await resolveDb()
        .insert(bookingSessionHoldsTable)
        .values({
          id: record.id,
          sessionId: record.sessionId,
          quoteId: record.quoteId,
          target: record.target,
          quantity: record.quantity,
          state: record.state,
          capacityKey: record.capacityKey,
          expiresAt: record.expiresAt,
          convertedAt: record.state === "converted" ? new Date() : null,
          releasedAt: record.state === "released" ? new Date() : null,
          createdAt: record.createdAt,
        })
        .onConflictDoUpdate({
          target: bookingSessionHoldsTable.id,
          set: {
            target: record.target,
            quantity: record.quantity,
            state: record.state,
            capacityKey: record.capacityKey,
            expiresAt: record.expiresAt,
            convertedAt: record.state === "converted" ? new Date() : null,
            releasedAt: record.state === "released" ? new Date() : null,
          },
        })
    },
    async getCommitByIdempotency(sessionId, idempotencyKey) {
      const [row] = await resolveDb()
        .select()
        .from(bookingSessionCommitsTable)
        .where(
          and(
            eq(bookingSessionCommitsTable.sessionId, sessionId),
            eq(bookingSessionCommitsTable.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1)
      return row ? mapCommit(row) : null
    },
    async saveCommit(record) {
      await resolveDb().insert(bookingSessionCommitsTable).values({
        id: record.id,
        sessionId: record.sessionId,
        idempotencyKey: record.idempotencyKey,
        requestFingerprint: record.requestFingerprint,
        outcome: record.outcome,
        bookingId: record.bookingId,
        createdAt: record.createdAt,
      })
    },
    async withSessionTransaction(sessionId, operation) {
      return withOptionalTransaction(db, async (tx) =>
        txStore.run(tx as PostgresJsDatabase, async () => {
          await resolveDb().execute(
            sql`select id from booking_sessions where id = ${sessionId} for update`,
          )
          return operation()
        }),
      )
    },
  }
}

function mapSession(row: SelectBookingSession, capability?: string): BookingSessionInternalRecord {
  return {
    id: row.id,
    capability,
    capabilityHash: row.capabilityHash ?? undefined,
    target: {
      kind: row.targetKind === "catalog_item" ? "catalog_item" : "product",
      productId: row.productId ?? undefined,
      catalogItemId: row.catalogItemId ?? undefined,
    },
    actorKind: row.actorKind as BookingSessionInternalRecord["actorKind"],
    state: row.state as BookingSessionInternalRecord["state"],
    revision: row.revision,
    statePayload: row.statePayload,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapQuote(row: SelectBookingSessionQuote): BookingQuoteInternalRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sessionRevision: row.sessionRevision,
    state: row.state as BookingQuoteInternalRecord["state"],
    pricing: row.pricing as PricingBreakdownV1,
    priceFingerprint: row.priceFingerprint,
    quotedAt: row.quotedAt,
    expiresAt: row.expiresAt,
  }
}

function mapHold(row: SelectBookingSessionHold): BookingHoldInternalRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    quoteId: row.quoteId,
    target: row.target,
    quantity: row.quantity,
    state: row.state as BookingHoldInternalRecord["state"],
    capacityKey: row.capacityKey,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }
}

function mapCommit(row: SelectBookingSessionCommit): BookingCommitInternalRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    outcome: row.outcome as BookingCommitInternalRecord["outcome"],
    bookingId: row.bookingId ?? undefined,
    createdAt: row.createdAt,
  }
}
