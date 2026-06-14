/**
 * `cancelEntity` — third step in the booking engine lifecycle.
 *
 * Looks up the snapshot row, dispatches `adapter.cancel`, returns the
 * adapter's refund result. The snapshot stays — it's the audit record —
 * and the booking row's lifecycle (set status to cancelled, etc.) is the
 * caller's responsibility, kept outside the engine to preserve the
 * decoupling from `packages/bookings`.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq } from "drizzle-orm"

import type {
  CancelResult,
  SourceAdapterContext,
  SourceAdapterRequestScope,
} from "../adapter/contract.js"
import {
  bookingCatalogSnapshotTable,
  type SelectBookingCatalogSnapshot,
} from "../snapshot/schema.js"

import { BookingEngineError, ORDER_NOT_FOUND } from "./errors.js"
import type { SourceAdapterRegistry } from "./registry.js"

export interface CancelEntityRequest {
  bookingId: string
  entityModule: string
  entityId: string
  reason?: string
  scope?: SourceAdapterRequestScope
  idempotencyKey?: string
  adapterContext: SourceAdapterContext
}

export interface CancelEntityResult {
  status: CancelResult["status"]
  refundAmount?: number
  refundCurrency?: string
  pendingChannel?: string
  /** The snapshot row's id — exposed for callers that want to log the cancel against it. */
  snapshotId: string
}

export interface CancelEntityDeps {
  registry: SourceAdapterRegistry
}

/**
 * Cancel the given (booking, entity) pair. Throws `ORDER_NOT_FOUND` when
 * no snapshot row matches. Otherwise dispatches to the registered
 * adapter; if the adapter doesn't implement `cancel`, returns the
 * adapter's refusal verbatim so the caller can surface it.
 */
export async function cancelEntity(
  db: AnyDrizzleDb,
  deps: CancelEntityDeps,
  request: CancelEntityRequest,
): Promise<CancelEntityResult> {
  const snapshot = await loadSnapshot(db, request.bookingId, request.entityModule, request.entityId)
  const adapter = snapshot.source_connection_id
    ? (deps.registry.resolveByConnection(snapshot.source_connection_id) ??
      deps.registry.resolveOrThrow(snapshot.source_kind))
    : deps.registry.resolveOrThrow(snapshot.source_kind)
  if (!adapter.cancel) {
    return {
      status: "refused",
      snapshotId: snapshot.id,
    }
  }

  const result = await adapter.cancel(request.adapterContext, {
    upstream_ref: snapshot.source_ref ?? snapshot.id,
    reason: request.reason,
    scope: request.scope,
    idempotency_key: request.idempotencyKey,
  })

  return {
    status: result.status,
    refundAmount: result.refund_amount,
    refundCurrency: result.refund_currency,
    pendingChannel: result.pending_channel,
    snapshotId: snapshot.id,
  }
}

async function loadSnapshot(
  db: AnyDrizzleDb,
  bookingId: string,
  entityModule: string,
  entityId: string,
): Promise<SelectBookingCatalogSnapshot> {
  const rows = (await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(
      and(
        eq(bookingCatalogSnapshotTable.booking_id, bookingId),
        eq(bookingCatalogSnapshotTable.entity_module, entityModule),
        eq(bookingCatalogSnapshotTable.entity_id, entityId),
      ),
    )
    .limit(1)) as SelectBookingCatalogSnapshot[]
  const snapshot = rows[0]
  if (!snapshot) {
    throw new BookingEngineError(
      ORDER_NOT_FOUND,
      `no snapshot row for booking=${bookingId} entity=${entityModule}:${entityId}`,
      { bookingId, entityModule, entityId },
    )
  }
  return snapshot
}
