/**
 * Booking snapshot graph — immutable frozen views of CatalogEntries captured
 * at booking commit time.
 *
 * One booking can produce multiple snapshot rows (one per participating
 * CatalogEntry — a TUI package booking captures the package, the referenced
 * hotel, each selected excursion, the chosen departure, the selected flight).
 * Snapshots are never mutated and are preserved through source disconnection.
 *
 * See `docs/architecture/catalog-architecture.md` §5.3 for the full design.
 */

import { typeId } from "@voyantjs/db/lib/typeid-column"
import { jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

/**
 * Structured pricing breakdown stored alongside the JSONB blob so finance,
 * invoicing, and refund engines can query it without parsing.
 */
export interface PricingBasis {
  base_amount: number
  taxes: number
  fees: number
  surcharges: number
  currency: string
  /** Free-form line-item breakdown for engines that need full detail. */
  breakdown?: Record<string, unknown>
}

/**
 * `booking_catalog_snapshot` — frozen view of a CatalogEntry captured at
 * booking commit. One booking may produce many snapshot rows (one per
 * participating CatalogEntry).
 */
export const bookingCatalogSnapshotTable = pgTable(
  "booking_catalog_snapshot",
  {
    id: typeId("booking_catalog_snapshot"),

    // Booking the snapshot belongs to. Plain text reference (no FK) to
    // preserve the cross-module decoupling rule (see schema-discipline.md).
    booking_id: text("booking_id").notNull(),

    // Which CatalogEntry this snapshot freezes.
    entity_module: text("entity_module").notNull(),
    entity_id: text("entity_id").notNull(),

    // Source pointer — durable callback handle for post-book operations
    // (modify, cancel, status sync, refund). The snapshot is audit truth;
    // the source pointer is what you call back to.
    source_kind: text("source_kind").notNull(),
    source_provider: text("source_provider"),
    source_connection_id: text("source_connection_id"),
    source_ref: text("source_ref"),

    // Frozen resolved view of the entity at booking time. Includes overlay
    // values applied for the booking's (locale, audience, market). Opaque
    // JSONB; finance queries the structured columns below instead.
    frozen_payload: jsonb("frozen_payload").notNull(),

    // The overlay values that were live at capture time. Audit needs this to
    // reconstruct exactly what the customer saw — distinct from
    // `frozen_payload` which is the resolved view, not the override values.
    overlay_state_at_capture: jsonb("overlay_state_at_capture"),

    // Structured pricing columns alongside the JSONB blob. Finance queries
    // these directly without parsing. `pricing_basis_currency` denormalized
    // to a separate column for indexed queries.
    pricing_base_amount: numeric("pricing_base_amount", { precision: 18, scale: 4 }),
    pricing_taxes: numeric("pricing_taxes", { precision: 18, scale: 4 }),
    pricing_fees: numeric("pricing_fees", { precision: 18, scale: 4 }),
    pricing_surcharges: numeric("pricing_surcharges", { precision: 18, scale: 4 }),
    pricing_currency: text("pricing_currency"),
    pricing_breakdown: jsonb("pricing_breakdown").$type<Record<string, unknown>>(),

    captured_at: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A booking captures at most one snapshot per (entity_module, entity_id)
    // pair — multiple captures of the same entity inside one booking would be
    // a logic bug.
    uniqueIndex("booking_catalog_snapshot_booking_entity_uniq").on(
      table.booking_id,
      table.entity_module,
      table.entity_id,
    ),
  ],
)

export type InsertBookingCatalogSnapshot = typeof bookingCatalogSnapshotTable.$inferInsert
export type SelectBookingCatalogSnapshot = typeof bookingCatalogSnapshotTable.$inferSelect

/**
 * Helper to compose a `PricingBasis` from the structured columns of a
 * snapshot row. Returns `null` if the snapshot has no pricing columns set
 * (volatile-live fields without `on-quote` / `on-book` snapshot mode).
 */
export function readPricingBasis(row: SelectBookingCatalogSnapshot): PricingBasis | null {
  if (row.pricing_base_amount == null || row.pricing_currency == null) {
    return null
  }
  return {
    base_amount: Number(row.pricing_base_amount),
    taxes: row.pricing_taxes != null ? Number(row.pricing_taxes) : 0,
    fees: row.pricing_fees != null ? Number(row.pricing_fees) : 0,
    surcharges: row.pricing_surcharges != null ? Number(row.pricing_surcharges) : 0,
    currency: row.pricing_currency,
    breakdown: row.pricing_breakdown ?? undefined,
  }
}
