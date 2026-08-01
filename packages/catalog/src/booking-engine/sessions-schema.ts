import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import type { BookingSessionTargetV1 } from "./contracts.js"

export const bookingSessionsTable = pgTable(
  "booking_sessions",
  {
    id: text("id").primaryKey(),
    capabilityHash: text("capability_hash"),
    actorKind: text("actor_kind").notNull(),
    targetKind: text("target_kind").notNull(),
    productId: text("product_id"),
    catalogItemId: text("catalog_item_id"),
    state: text("state").notNull(),
    revision: integer("revision").notNull(),
    statePayload: jsonb("state_payload").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_sessions_state_expires").on(table.state, table.expiresAt),
    index("idx_booking_sessions_product").on(table.productId),
    index("idx_booking_sessions_catalog_item").on(table.catalogItemId),
  ],
)

export const bookingSessionQuotesTable = pgTable(
  "booking_session_quotes",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    sessionRevision: integer("session_revision").notNull(),
    state: text("state").notNull(),
    pricing: jsonb("pricing").$type<Record<string, unknown>>().notNull(),
    priceFingerprint: text("price_fingerprint").notNull(),
    quotedAt: timestamp("quoted_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_booking_session_quotes_session").on(table.sessionId, table.sessionRevision),
    index("idx_booking_session_quotes_expires").on(table.expiresAt),
  ],
)

export const bookingSessionHoldsTable = pgTable(
  "booking_session_holds",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    quoteId: text("quote_id").notNull(),
    target: jsonb("target").$type<BookingSessionTargetV1>().notNull(),
    quantity: integer("quantity").notNull(),
    state: text("state").notNull(),
    capacityKey: text("capacity_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_session_holds_session").on(table.sessionId),
    index("idx_booking_session_holds_capacity").on(table.capacityKey, table.state),
    index("idx_booking_session_holds_expires").on(table.expiresAt),
  ],
)

export const bookingSessionCommitsTable = pgTable(
  "booking_session_commits",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    outcome: jsonb("outcome").$type<Record<string, unknown>>().notNull(),
    bookingId: text("booking_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_booking_session_commits_session_idem").on(
      table.sessionId,
      table.idempotencyKey,
    ),
    index("idx_booking_session_commits_booking").on(table.bookingId),
  ],
)

export type SelectBookingSession = typeof bookingSessionsTable.$inferSelect
export type InsertBookingSession = typeof bookingSessionsTable.$inferInsert
export type SelectBookingSessionQuote = typeof bookingSessionQuotesTable.$inferSelect
export type InsertBookingSessionQuote = typeof bookingSessionQuotesTable.$inferInsert
export type SelectBookingSessionHold = typeof bookingSessionHoldsTable.$inferSelect
export type InsertBookingSessionHold = typeof bookingSessionHoldsTable.$inferInsert
export type SelectBookingSessionCommit = typeof bookingSessionCommitsTable.$inferSelect
export type InsertBookingSessionCommit = typeof bookingSessionCommitsTable.$inferInsert
