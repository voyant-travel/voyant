/**
 * Read-side of the booking engine — `getOrder` / `listOrders`.
 *
 * The engine does not introduce a new "orders" table; `bookings` is
 * already the parent and `booking_catalog_snapshot` is the per-line
 * record. These helpers expose the cross-vertical view by selecting
 * snapshot rows directly.
 *
 * Bookings-module joins (status, customer, payment) are layered on at
 * the route level — these helpers stay scoped to what the catalog plane
 * itself owns.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, desc, eq, inArray } from "drizzle-orm"

import {
  bookingCatalogSnapshotTable,
  type SelectBookingCatalogSnapshot,
} from "../snapshot/schema.js"

export interface ListOrdersQuery {
  /** Restrict to a specific booking. */
  bookingId?: string
  /** Restrict to a specific catalog vertical (`"products"`, `"accommodations"`, etc.). */
  entityModule?: string
  /** Restrict to one or more source kinds — e.g. `["demo"]`. */
  sourceKinds?: ReadonlyArray<string>
  /** Pagination — capped at 100 by callers. */
  limit?: number
  offset?: number
}

export interface ListOrdersResult {
  rows: ReadonlyArray<SelectBookingCatalogSnapshot>
  /**
   * `null` when the caller didn't request a count; populated when the
   * query is bounded enough that an EXACT count is cheap (currently when
   * `bookingId` is provided).
   */
  total?: number
}

export async function listOrders(
  db: AnyDrizzleDb,
  query: ListOrdersQuery = {},
): Promise<ListOrdersResult> {
  const conditions = []
  if (query.bookingId) {
    conditions.push(eq(bookingCatalogSnapshotTable.booking_id, query.bookingId))
  }
  if (query.entityModule) {
    conditions.push(eq(bookingCatalogSnapshotTable.entity_module, query.entityModule))
  }
  if (query.sourceKinds?.length) {
    conditions.push(inArray(bookingCatalogSnapshotTable.source_kind, [...query.sourceKinds]))
  }

  const where = conditions.length ? and(...conditions) : undefined
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100)
  const offset = Math.max(query.offset ?? 0, 0)

  const rows = (await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(where)
    .orderBy(desc(bookingCatalogSnapshotTable.captured_at))
    .limit(limit)
    .offset(offset)) as SelectBookingCatalogSnapshot[]

  return { rows }
}

/**
 * Fetch one snapshot row by its id. Used by the operator starter's
 * `GET /v1/admin/catalog/orders/:id` route. Returns `null` when absent.
 */
export async function getOrderById(
  db: AnyDrizzleDb,
  snapshotId: string,
): Promise<SelectBookingCatalogSnapshot | null> {
  const rows = (await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(eq(bookingCatalogSnapshotTable.id, snapshotId))
    .limit(1)) as SelectBookingCatalogSnapshot[]
  return rows[0] ?? null
}
