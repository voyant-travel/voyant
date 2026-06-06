import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Dedup ledger for clone/compose. A clone or compose has no natural key
 * (product names may collide), so we cannot reuse the booking-create
 * advisory-lock-on-natural-key guard. Instead, callers (agent tool runtimes)
 * pass an `Idempotency-Key`; a retried/double-tapped request with the same key
 * returns the originally-created product id instead of building a second graph.
 */
export const productAuthoringRequests = pgTable(
  "product_authoring_requests",
  {
    idempotencyKey: text("idempotency_key").primaryKey(),
    /** The product produced by the first request with this key. */
    productId: text("product_id").notNull(),
    /** `duplicate` | `compose` — for observability only. */
    operation: text("operation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_par_product").on(t.productId)],
)

export type ProductAuthoringRequest = typeof productAuthoringRequests.$inferSelect
export type NewProductAuthoringRequest = typeof productAuthoringRequests.$inferInsert
