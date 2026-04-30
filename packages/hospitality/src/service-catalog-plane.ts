/**
 * Catalog-plane integration for the hospitality service.
 *
 * The hospitality vertical's catalog entry is the **room type** — the
 * sellable variant within a property. Properties live in
 * `packages/facilities` and are referenced via `propertyId`.
 *
 * Mirrors the pattern in `packages/products/src/service-catalog-plane.ts`.
 *
 * See `docs/architecture/catalog-architecture.md` §9.1.
 */

import {
  buildIndexerDocument,
  buildSnapshotInputFromView,
  type CaptureSnapshotInput,
  createFieldPolicyRegistry,
  type DocumentBuilder,
  type DocumentEmitter,
  type FieldPolicyRegistry,
  type IndexerDocument,
  type IndexerSlice,
  type PricingBasis,
  type Provenance,
  type ResolvedView,
  type ResolverScope,
  resolveEntityView,
} from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { eq } from "drizzle-orm"

import { hospitalityCatalogPolicy } from "./catalog-policy.js"
import { roomTypes } from "./schema-inventory.js"

let _registry: FieldPolicyRegistry | undefined
function getHospitalityRegistry(): FieldPolicyRegistry {
  if (!_registry) {
    _registry = createFieldPolicyRegistry(hospitalityCatalogPolicy)
  }
  return _registry
}

/**
 * Maps a room-type row to a field-keyed projection. Provenance covers both
 * operator-owned hotels (synthetic `owned`) and bedbank-sourced hotels
 * (Voyant Connect, Hotelbeds, etc.); the caller declares the source kind.
 */
export function roomTypeRowToProjection(
  row: typeof roomTypes.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    // Provenance
    ["source.kind", context.sourceKind ?? "owned"],
    ["source.ref", context.sourceRef],
    ["seller.operator_id", context.sellerOperatorId],

    // Identity
    ["id", row.id],
    ["code", row.code],
    ["createdAt", row.createdAt],
    ["updatedAt", row.updatedAt],

    // Cross-module reference
    ["propertyId", row.propertyId],

    // Merchandisable
    ["name", row.name],
    ["description", row.description],
    ["accessibilityNotes", row.accessibilityNotes],

    // Structural / facets
    ["inventoryMode", row.inventoryMode],
    ["roomClass", row.roomClass],
    ["active", row.active],
    ["smokingAllowed", row.smokingAllowed],
    ["sortOrder", row.sortOrder],

    // Occupancy
    ["maxAdults", row.maxAdults],
    ["maxChildren", row.maxChildren],
    ["maxInfants", row.maxInfants],
    ["standardOccupancy", row.standardOccupancy],
    ["maxOccupancy", row.maxOccupancy],
    ["minOccupancy", row.minOccupancy],

    // Physical
    ["bedroomCount", row.bedroomCount],
    ["bathroomCount", row.bathroomCount],
    ["areaValue", row.areaValue],
    ["areaUnit", row.areaUnit],
  ])
}

export function roomTypeProvenance(
  _row: typeof roomTypes.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): Provenance {
  return {
    source_kind: context.sourceKind ?? "owned",
    source_freshness: context.sourceKind && context.sourceKind !== "owned" ? "sync" : "static",
    source_ref: context.sourceRef,
  }
}

export interface RoomTypeCatalogContext {
  sellerOperatorId: string
  scope: ResolverScope
  sourceKind?: string
  sourceRef?: string
}

export async function getResolvedRoomTypeById(
  db: AnyDrizzleDb,
  id: string,
  context: RoomTypeCatalogContext,
): Promise<ResolvedView | null> {
  const rows = await db.select().from(roomTypes).where(eq(roomTypes.id, id)).limit(1)
  const row = rows[0]
  if (!row) return null

  const projection = roomTypeRowToProjection(row, {
    sellerOperatorId: context.sellerOperatorId,
    sourceKind: context.sourceKind,
    sourceRef: context.sourceRef,
  })
  return resolveEntityView(
    db,
    getHospitalityRegistry(),
    "hospitality",
    id,
    projection,
    context.scope,
  )
}

export async function listResolvedRoomTypes(
  db: AnyDrizzleDb,
  rows: ReadonlyArray<typeof roomTypes.$inferSelect>,
  context: RoomTypeCatalogContext,
): Promise<ResolvedView[]> {
  const registry = getHospitalityRegistry()
  const views: ResolvedView[] = []
  for (const row of rows) {
    const projection = roomTypeRowToProjection(row, {
      sellerOperatorId: context.sellerOperatorId,
      sourceKind: context.sourceKind,
      sourceRef: context.sourceRef,
    })
    const view = await resolveEntityView(
      db,
      registry,
      "hospitality",
      row.id,
      projection,
      context.scope,
    )
    views.push(view)
  }
  return views
}

/**
 * Build a `CaptureSnapshotInput` for a hospitality room type. Used by
 * booking commit flows to capture the room-type view at booking time.
 */
export async function buildRoomTypeSnapshotInput(
  db: AnyDrizzleDb,
  roomTypeId: string,
  context: RoomTypeCatalogContext & { pricingBasis?: PricingBasis },
): Promise<Omit<CaptureSnapshotInput, "bookingId"> | null> {
  const view = await getResolvedRoomTypeById(db, roomTypeId, context)
  if (!view) return null
  return buildSnapshotInputFromView(view, {
    entityModule: "hospitality",
    entityId: roomTypeId,
    sourceKind: context.sourceKind ?? "owned",
    sourceRef: context.sourceRef,
    pricingBasis: context.pricingBasis,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexer document emission
// ─────────────────────────────────────────────────────────────────────────────

export function createRoomTypeDocumentEmitter(context: {
  sellerOperatorId: string
  sourceKind?: string
  sourceRef?: string
}): DocumentEmitter<typeof roomTypes.$inferSelect> {
  const registry = getHospitalityRegistry()
  return {
    vertical: "hospitality",
    emit(source, slice) {
      const projection = roomTypeRowToProjection(source, {
        sellerOperatorId: context.sellerOperatorId,
        sourceKind: context.sourceKind,
        sourceRef: context.sourceRef,
      })
      return buildIndexerDocument(registry, projection, slice, source.id)
    },
  }
}

export function createRoomTypeDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): DocumentBuilder {
  const emitter = createRoomTypeDocumentEmitter(context)
  return async (entityId: string, slice: IndexerSlice): Promise<IndexerDocument | null> => {
    const rows = await db.select().from(roomTypes).where(eq(roomTypes.id, entityId)).limit(1)
    const row = rows[0]
    if (!row) return null
    return emitter.emit(row, slice)
  }
}

export type {
  CaptureSnapshotInput,
  DocumentBuilder,
  DocumentEmitter,
  IndexerDocument,
  IndexerSlice,
  PricingBasis,
  Provenance,
  ResolvedView,
  ResolverScope,
}
