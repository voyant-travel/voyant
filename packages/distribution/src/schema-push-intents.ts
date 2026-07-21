import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { channels } from "./schema-core.js"

/**
 * Durable handoff rows for the channel-push availability and content
 * flows. Subscribers INSERT into these tables (returning immediately
 * per the EventBus contract); the scheduled push workflows drain them.
 *
 * Booking push doesn't need its own intent table — `channel_booking_links`
 * already serves both roles (push_status = 'pending' for in-flight,
 * 'ok' on success).
 *
 * Per docs/architecture/channel-push-architecture.md §7.3 and §12.
 */

export const channelAvailabilityPushIntents = pgTable(
  "channel_availability_push_intents",
  {
    id: typeId("channel_availability_push_intents"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    /**
     * Connection id resolving to a registered SourceAdapter. Subscriber
     * reads it from the resolved channel mapping at insert time so the
     * worker doesn't need to re-resolve.
     */
    sourceConnectionId: text("source_connection_id").notNull(),
    /** Slot id (typeid). Plain text to avoid cross-package FK. */
    slotId: text("slot_id").notNull(),
    /** Product id (typeid). Plain text to avoid cross-package FK. */
    productId: text("product_id").notNull(),
    /** Optional option id when the channel allotment is option-scoped. */
    optionId: text("option_id"),
    /** Slot start time, mirrored from the source event. Diagnostic. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /**
     * Time the most recent supersession event landed for this
     * (channel, slot) pair. Workers scan oldest-first; the unique
     * constraint below collapses concurrent events to one row, so
     * this is bumped on every UPSERT.
     */
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    /** Number of dispatch attempts so far. */
    attempts: integer("attempts").notNull().default(0),
    /** Most recent error from the last failed attempt. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_chan_avail_push_intents_requested").on(table.channelId, table.requestedAt),
    index("idx_chan_avail_push_intents_product").on(table.productId, table.requestedAt),
    /**
     * Supersession key. Concurrent slot.changed events for the same
     * (channel, slot) collapse to one row — the worker reads the
     * *current* slot state when it processes, so stale event payloads
     * never propagate. Per §5.2.
     */
    uniqueIndex("uniq_chan_avail_push_intents_per_slot").on(table.channelId, table.slotId),
  ],
)

export const channelContentPushIntents = pgTable(
  "channel_content_push_intents",
  {
    id: typeId("channel_content_push_intents"),
    channelId: typeIdRef("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    sourceConnectionId: text("source_connection_id").notNull(),
    productId: text("product_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_chan_content_push_intents_requested").on(table.channelId, table.requestedAt),
    /**
     * Supersession key. Concurrent product.content.changed events
     * collapse to one row per (channel, product). Per §6.2.
     */
    uniqueIndex("uniq_chan_content_push_intents_per_product").on(table.channelId, table.productId),
  ],
)

/** Cross-instance leases for the fixed channel-push drain/reconciler jobs. */
export const channelPushJobLeases = pgTable("channel_push_job_leases", {
  jobId: text("job_id").primaryKey(),
  owner: text("owner").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ChannelAvailabilityPushIntent = typeof channelAvailabilityPushIntents.$inferSelect
export type NewChannelAvailabilityPushIntent = typeof channelAvailabilityPushIntents.$inferInsert
export type ChannelContentPushIntent = typeof channelContentPushIntents.$inferSelect
export type NewChannelContentPushIntent = typeof channelContentPushIntents.$inferInsert
