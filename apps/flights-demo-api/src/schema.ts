import type { FlightOrder, FlightOrderStatus } from "@voyant-travel/flights/contract/types"
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Persistence for the demo flight adapter. Real GDS / NDC connectors don't
 * own the orders DB — the upstream provider is the source of truth. The
 * demo connector ships with the operator starter and needs somewhere to
 * keep orders across worker restarts so the `/flights/orders` list is
 * useful, so it gets its own table here.
 *
 * `payload` is the canonical `FlightOrder` JSON; the denormalized columns
 * (status, payerName, totalAmount, totalCurrency) are for filtering and
 * sorting in the list view without hydrating every row.
 */
export const demoFlightOrders = pgTable(
  "demo_flight_orders",
  {
    orderId: text("order_id").primaryKey(),
    pnr: text("pnr"),
    status: text("status").$type<FlightOrderStatus>().notNull(),
    payerName: text("payer_name"),
    payerEmail: text("payer_email"),
    totalAmount: text("total_amount").notNull(),
    totalCurrency: text("total_currency").notNull(),
    payload: jsonb("payload").$type<FlightOrder>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("demo_flight_orders_status_idx").on(t.status),
    index("demo_flight_orders_created_at_idx").on(t.createdAt),
    index("demo_flight_orders_payer_email_idx").on(t.payerEmail),
  ],
)

export type DemoFlightOrderRow = typeof demoFlightOrders.$inferSelect
export type NewDemoFlightOrderRow = typeof demoFlightOrders.$inferInsert
