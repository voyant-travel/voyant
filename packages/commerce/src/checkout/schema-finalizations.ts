import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Durable, Commerce-owned finalization authority for one booking.
 *
 * Per-session deliveries point at this row below. Cross-module ids remain
 * plain text (see schema-discipline.md); their owning domains remain
 * authoritative for the referenced records.
 */
export const checkoutFinalizations = pgTable(
  "checkout_finalizations",
  {
    bookingId: text("booking_id").primaryKey(),
    triggerPaymentSessionId: text("trigger_payment_session_id").notNull(),
    invoiceId: text("invoice_id"),
    paymentId: text("payment_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    paymentRevision: integer("payment_revision").notNull().default(0),
    contractId: text("contract_id"),
    contractAttachmentId: text("contract_attachment_id"),
    finalPaymentRenderVersion: integer("final_payment_render_version").notNull().default(0),
    finalPaymentRenderKey: text("final_payment_render_key"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_checkout_finalizations_trigger_session").on(table.triggerPaymentSessionId),
    index("idx_checkout_finalizations_invoice").on(table.invoiceId),
  ],
)

export type CheckoutFinalization = typeof checkoutFinalizations.$inferSelect

export const checkoutFinalizationDeliveries = pgTable(
  "checkout_finalization_deliveries",
  {
    paymentSessionId: text("payment_session_id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => checkoutFinalizations.bookingId, { onDelete: "cascade" }),
    paymentLinkedAt: timestamp("payment_linked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_checkout_finalization_deliveries_booking").on(table.bookingId)],
)

export type CheckoutFinalizationDelivery = typeof checkoutFinalizationDeliveries.$inferSelect
