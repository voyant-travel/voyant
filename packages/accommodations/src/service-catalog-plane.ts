/**
 * Catalog-plane integration for the accommodation service.
 *
 * The accommodation vertical's catalog entry is the **room type** — the
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
} from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq } from "drizzle-orm"

import { accommodationCatalogPolicy } from "./catalog-policy.js"
import { isCustomerRoomTypeBookable } from "./customer-bookability.js"
import { roomTypes } from "./schema-inventory.js"
import {
  ACCOMMODATION_CONTENT_MARKET_ANY,
  accommodationSourcedContentTable,
} from "./schema-sourced-content.js"

let _registry: FieldPolicyRegistry | undefined
function getAccommodationRegistry(): FieldPolicyRegistry {
  if (!_registry) {
    _registry = createFieldPolicyRegistry(accommodationCatalogPolicy)
  }
  return _registry
}

/**
 * Maps a room-type row to a field-keyed projection. Provenance covers sourced
 * and direct-supplier lodging inventory; the caller declares the source kind.
 */
export function roomTypeRowToProjection(
  row: typeof roomTypes.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    // Provenance
    ["source.kind", context.sourceKind ?? "direct"],
    ["source.ref", context.sourceRef],
    ["seller.operator_id", context.sellerOperatorId],

    // Identity
    ["id", row.id],
    ["code", row.code],
    ["createdAt", row.createdAt],
    ["updatedAt", row.updatedAt],

    // Cross-module reference
    ["propertyId", row.propertyId],
    ["supplierId", row.supplierId],

    // Merchandisable
    ["name", row.name],
    ["description", row.description],
    ["accessibilityNotes", row.accessibilityNotes],
    ["thumbnailUrl", pickThumbnailUrl(row.metadata)],

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
    source_kind: context.sourceKind ?? "direct",
    source_freshness: context.sourceKind && context.sourceKind !== "direct" ? "sync" : "static",
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
    getAccommodationRegistry(),
    "accommodations",
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
  const registry = getAccommodationRegistry()
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
      "accommodations",
      row.id,
      projection,
      context.scope,
    )
    views.push(view)
  }
  return views
}

/**
 * Build a `CaptureSnapshotInput` for a accommodation room type. Used by
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
    entityModule: "accommodations",
    entityId: roomTypeId,
    sourceKind: context.sourceKind ?? "direct",
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
  const registry = getAccommodationRegistry()
  return {
    vertical: "accommodations",
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
  const registry = getAccommodationRegistry()
  return async (entityId: string, slice: IndexerSlice): Promise<IndexerDocument | null> => {
    const rows = await db.select().from(roomTypes).where(eq(roomTypes.id, entityId)).limit(1)
    const row = rows[0]
    if (!row) return null
    if (slice.audience === "customer" && !(await isCustomerRoomTypeBookable(db, row))) return null
    const projection = new Map(
      roomTypeRowToProjection(row, {
        sellerOperatorId: context.sellerOperatorId,
        sourceKind: context.sourceKind,
        sourceRef: context.sourceRef,
      }),
    )
    const sourcedThumbnailUrl = await fetchSourcedContentThumbnailUrl(db, entityId, slice)
    if (sourcedThumbnailUrl) {
      projection.set("thumbnailUrl", sourcedThumbnailUrl)
    }
    return buildIndexerDocument(registry, projection, slice, entityId)
  }
}

async function fetchSourcedContentThumbnailUrl(
  db: AnyDrizzleDb,
  entityId: string,
  slice: IndexerSlice,
): Promise<string | null> {
  const rows = await db
    .select({
      market: accommodationSourcedContentTable.market,
      payload: accommodationSourcedContentTable.payload,
    })
    .from(accommodationSourcedContentTable)
    .where(
      and(
        eq(accommodationSourcedContentTable.entity_id, entityId),
        eq(accommodationSourcedContentTable.locale, slice.locale),
      ),
    )

  const row =
    rows.find((candidate) => candidate.market === slice.market) ??
    rows.find((candidate) => candidate.market === ACCOMMODATION_CONTENT_MARKET_ANY) ??
    rows[0]
  return pickThumbnailUrl(row?.payload)
}

function pickThumbnailUrl(value: unknown): string | null {
  const record = asRecord(value)
  if (!record) return null
  return (
    firstString(
      record.thumbnailUrl,
      record.heroImageUrl,
      record.hero_image_url,
      record.imageUrl,
      record.image_url,
    ) ??
    firstMediaUrl(record.media) ??
    firstStringFromArray(record.images) ??
    firstStringFromArray(record.galleryUrls)
  )
}

function firstMediaUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const item of value) {
    const media = asRecord(item)
    if (!media) continue
    const type = typeof media.type === "string" ? media.type : null
    if (type && type !== "image") continue
    const url = firstString(media.url, media.src)
    if (url) return url
  }
  return null
}

function firstStringFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  return value.find((item): item is string => typeof item === "string" && item.length > 0) ?? null
}

function firstString(...values: unknown[]): string | null {
  return (
    values.find((value): value is string => typeof value === "string" && value.length > 0) ?? null
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
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
