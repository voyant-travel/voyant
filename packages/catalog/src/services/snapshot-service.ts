/**
 * SnapshotService — drizzle-bound capture and read of booking snapshot
 * graphs.
 *
 * One booking commit may produce multiple snapshot rows — one per
 * participating CatalogEntry (a TUI package booking captures the package,
 * the referenced hotel, each selected excursion, the chosen departure, the
 * selected flight). Snapshots are immutable once written and preserved
 * through source disconnection.
 *
 * Functions take an `AnyDrizzleDb` as their first parameter to match the
 * existing voyant convention.
 *
 * See `docs/architecture/catalog-architecture.md` §5.3 for the design.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import { and, eq } from "drizzle-orm"

import type { ResolvedView } from "../overlay/resolver.js"
import {
  bookingCatalogSnapshotTable,
  type PricingBasis,
  type SelectBookingCatalogSnapshot,
} from "../snapshot/schema.js"

// ─────────────────────────────────────────────────────────────────────────────
// Captures
// ─────────────────────────────────────────────────────────────────────────────

/** Input for a single snapshot row capture. */
export interface CaptureSnapshotInput {
  bookingId: string
  entityModule: string
  entityId: string
  sourceKind: string
  sourceProvider?: string
  sourceConnectionId?: string
  sourceRef?: string
  /** The resolved CatalogEntry view at booking time. */
  frozenPayload: unknown
  /**
   * The overlay values that were live at capture time (audit needs this to
   * reconstruct exactly what the customer saw).
   */
  overlayStateAtCapture?: unknown
  /** Structured pricing breakdown alongside the JSONB blob. */
  pricingBasis?: PricingBasis
}

/**
 * Capture a single booking-catalog-snapshot row. Idempotent on
 * `(booking_id, entity_module, entity_id)` — re-capturing the same entity
 * inside the same booking is a logic bug; this function lets the unique
 * constraint catch it rather than silently overwriting.
 */
export async function captureSnapshot(
  db: AnyDrizzleDb,
  input: CaptureSnapshotInput,
): Promise<SelectBookingCatalogSnapshot> {
  const inserted = await db
    .insert(bookingCatalogSnapshotTable)
    .values({
      id: newId("booking_catalog_snapshot"),
      booking_id: input.bookingId,
      entity_module: input.entityModule,
      entity_id: input.entityId,
      source_kind: input.sourceKind,
      source_provider: input.sourceProvider,
      source_connection_id: input.sourceConnectionId,
      source_ref: input.sourceRef,
      frozen_payload: input.frozenPayload,
      overlay_state_at_capture: input.overlayStateAtCapture,
      pricing_base_amount:
        input.pricingBasis?.base_amount != null
          ? String(input.pricingBasis.base_amount)
          : undefined,
      pricing_taxes:
        input.pricingBasis?.taxes != null ? String(input.pricingBasis.taxes) : undefined,
      pricing_fees: input.pricingBasis?.fees != null ? String(input.pricingBasis.fees) : undefined,
      pricing_surcharges:
        input.pricingBasis?.surcharges != null ? String(input.pricingBasis.surcharges) : undefined,
      pricing_currency: input.pricingBasis?.currency,
      pricing_breakdown: input.pricingBasis?.breakdown,
    })
    .returning()

  if (!inserted[0]) {
    throw new Error("captureSnapshot: insert returned no rows")
  }
  return inserted[0]
}

/**
 * Capture multiple snapshot rows for a single booking in one transaction.
 * Used by the booking-commit pipeline when a booking participates with
 * multiple CatalogEntries (composite packages, cruises with selected
 * cabins, flights with passengers).
 *
 * If any single capture fails, the whole transaction rolls back — the
 * booking's snapshot graph is all-or-nothing.
 */
export async function captureSnapshotGraph(
  db: AnyDrizzleDb,
  bookingId: string,
  inputs: ReadonlyArray<Omit<CaptureSnapshotInput, "bookingId">>,
): Promise<SelectBookingCatalogSnapshot[]> {
  if (inputs.length === 0) return []

  const rows = inputs.map((input) => ({
    id: newId("booking_catalog_snapshot"),
    booking_id: bookingId,
    entity_module: input.entityModule,
    entity_id: input.entityId,
    source_kind: input.sourceKind,
    source_provider: input.sourceProvider,
    source_connection_id: input.sourceConnectionId,
    source_ref: input.sourceRef,
    frozen_payload: input.frozenPayload,
    overlay_state_at_capture: input.overlayStateAtCapture,
    pricing_base_amount:
      input.pricingBasis?.base_amount != null ? String(input.pricingBasis.base_amount) : undefined,
    pricing_taxes: input.pricingBasis?.taxes != null ? String(input.pricingBasis.taxes) : undefined,
    pricing_fees: input.pricingBasis?.fees != null ? String(input.pricingBasis.fees) : undefined,
    pricing_surcharges:
      input.pricingBasis?.surcharges != null ? String(input.pricingBasis.surcharges) : undefined,
    pricing_currency: input.pricingBasis?.currency,
    pricing_breakdown: input.pricingBasis?.breakdown,
  }))

  const inserted = await db.insert(bookingCatalogSnapshotTable).values(rows).returning()
  return inserted as SelectBookingCatalogSnapshot[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all snapshot rows for a single booking. Returns the full snapshot
 * graph — one row per participating CatalogEntry. Used by refunds, audits,
 * post-book operations.
 */
export async function fetchSnapshotsForBooking(
  db: AnyDrizzleDb,
  bookingId: string,
): Promise<SelectBookingCatalogSnapshot[]> {
  const rows = await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(eq(bookingCatalogSnapshotTable.booking_id, bookingId))
  return rows as SelectBookingCatalogSnapshot[]
}

/**
 * Fetch a specific entity's snapshot for a booking. Returns `null` if no
 * snapshot was captured for the entity.
 */
export async function fetchEntitySnapshot(
  db: AnyDrizzleDb,
  bookingId: string,
  entityModule: string,
  entityId: string,
): Promise<SelectBookingCatalogSnapshot | null> {
  const rows = await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(
      and(
        eq(bookingCatalogSnapshotTable.booking_id, bookingId),
        eq(bookingCatalogSnapshotTable.entity_module, entityModule),
        eq(bookingCatalogSnapshotTable.entity_id, entityId),
      ),
    )
    .limit(1)
  return (rows[0] ?? null) as SelectBookingCatalogSnapshot | null
}

// ─────────────────────────────────────────────────────────────────────────────
// View → snapshot input helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a `ResolvedView`'s value Map into a plain object suitable for
 * storing as the JSONB `frozen_payload`. Field paths become keys.
 */
export function viewToFrozenPayload(view: ResolvedView): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, value] of view.values) {
    result[path] = value
  }
  return result
}

/**
 * Converts a `ResolvedView`'s provenance Map into a plain object suitable
 * for storing as the JSONB `overlay_state_at_capture`. Records which
 * variant slice satisfied each overlayed field at capture time. Fields
 * with `null` provenance (no overlay applied) are omitted.
 */
export function viewToOverlayState(view: ResolvedView): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, prov] of view.provenance) {
    if (prov) result[path] = prov
  }
  return result
}

/**
 * Composition helper: turn a `ResolvedView` plus identity / provenance /
 * pricing context into a `CaptureSnapshotInput` ready to pass into
 * `captureSnapshot` or `captureSnapshotGraph`.
 *
 * Verticals' `buildXSnapshotInput` helpers wrap this with the vertical-
 * specific row fetching + resolution.
 */
export function buildSnapshotInputFromView(
  view: ResolvedView,
  context: {
    entityModule: string
    entityId: string
    sourceKind: string
    sourceProvider?: string
    sourceConnectionId?: string
    sourceRef?: string
    pricingBasis?: PricingBasis
  },
): Omit<CaptureSnapshotInput, "bookingId"> {
  return {
    entityModule: context.entityModule,
    entityId: context.entityId,
    sourceKind: context.sourceKind,
    sourceProvider: context.sourceProvider,
    sourceConnectionId: context.sourceConnectionId,
    sourceRef: context.sourceRef,
    frozenPayload: viewToFrozenPayload(view),
    overlayStateAtCapture: viewToOverlayState(view),
    pricingBasis: context.pricingBasis,
  }
}
