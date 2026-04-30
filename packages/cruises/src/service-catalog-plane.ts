/**
 * Catalog-plane integration for the cruises service.
 *
 * Mirrors the pattern in `packages/products/src/service-catalog-plane.ts`.
 * Adds catalog-aware methods alongside the existing service surface.
 *
 * See `docs/architecture/catalog-architecture.md` §9.1.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
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
} from "@voyantjs/voyant-catalog"
import { eq } from "drizzle-orm"

import { cruiseCatalogPolicy } from "./catalog-policy.js"
import { cruises } from "./schema-core.js"

let _registry: FieldPolicyRegistry | undefined
function getCruisesRegistry(): FieldPolicyRegistry {
  if (!_registry) {
    _registry = createFieldPolicyRegistry(cruiseCatalogPolicy)
  }
  return _registry
}

/**
 * Maps a cruise row to a field-keyed projection. Provenance is synthesized:
 * cruises sourced from a line via Voyant Connect would carry their actual
 * source connection; today's mapper assumes operator-owned cruises (Phase 1
 * baseline). When sourced cruises land, this helper picks up the parallel
 * provenance row.
 */
export function cruiseRowToProjection(
  row: typeof cruises.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([
    // Provenance
    ["source.kind", context.sourceKind ?? "owned"],
    ["source.ref", context.sourceRef],
    ["seller.operator_id", context.sellerOperatorId],

    // Identity
    ["id", row.id],
    ["slug", row.slug],
    ["createdAt", row.createdAt],
    ["updatedAt", row.updatedAt],
    ["externalRefs", row.externalRefs],

    // Merchandisable
    ["name", row.name],
    ["description", row.description],
    ["shortDescription", row.shortDescription],
    ["highlights", row.highlights],
    ["inclusionsHtml", row.inclusionsHtml],
    ["exclusionsHtml", row.exclusionsHtml],
    ["heroImageUrl", row.heroImageUrl],
    ["mapImageUrl", row.mapImageUrl],

    // Structural
    ["cruiseType", row.cruiseType],
    ["status", row.status],
    ["lineSupplierId", row.lineSupplierId],
    ["defaultShipId", row.defaultShipId],
    ["nights", row.nights],
    ["embarkPortFacilityId", row.embarkPortFacilityId],
    ["disembarkPortFacilityId", row.disembarkPortFacilityId],
    ["regions", row.regions],
    ["themes", row.themes],

    // Volatile-indexed (browse-time approximations)
    ["lowestPriceCached", row.lowestPriceCached],
    ["lowestPriceCurrencyCached", row.lowestPriceCurrencyCached],
    ["earliestDepartureCached", row.earliestDepartureCached],
    ["latestDepartureCached", row.latestDepartureCached],
  ])
}

/**
 * Returns the Provenance tuple for a cruise. Owned cruises synthesize an
 * `owned` source; sourced cruises (e.g. via Voyant Connect from a cruise
 * line) carry the actual connection identity from their parallel provenance
 * row.
 */
export function cruiseProvenance(
  _row: typeof cruises.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): Provenance {
  return {
    source_kind: context.sourceKind ?? "owned",
    source_freshness: context.sourceKind && context.sourceKind !== "owned" ? "sync" : "static",
    source_ref: context.sourceRef,
  }
}

export interface CruiseCatalogContext {
  sellerOperatorId: string
  scope: ResolverScope
  /** When the cruise comes from an upstream source, populate these. */
  sourceKind?: string
  sourceRef?: string
}

export async function getResolvedCruiseById(
  db: AnyDrizzleDb,
  id: string,
  context: CruiseCatalogContext,
): Promise<ResolvedView | null> {
  const rows = await db.select().from(cruises).where(eq(cruises.id, id)).limit(1)
  const row = rows[0]
  if (!row) return null

  const projection = cruiseRowToProjection(row, {
    sellerOperatorId: context.sellerOperatorId,
    sourceKind: context.sourceKind,
    sourceRef: context.sourceRef,
  })
  return resolveEntityView(db, getCruisesRegistry(), "cruises", id, projection, context.scope)
}

export async function listResolvedCruises(
  db: AnyDrizzleDb,
  rows: ReadonlyArray<typeof cruises.$inferSelect>,
  context: CruiseCatalogContext,
): Promise<ResolvedView[]> {
  const registry = getCruisesRegistry()
  const views: ResolvedView[] = []
  for (const row of rows) {
    const projection = cruiseRowToProjection(row, {
      sellerOperatorId: context.sellerOperatorId,
      sourceKind: context.sourceKind,
      sourceRef: context.sourceRef,
    })
    const view = await resolveEntityView(db, registry, "cruises", row.id, projection, context.scope)
    views.push(view)
  }
  return views
}

/**
 * Build a `CaptureSnapshotInput` for a cruise. Fetches the cruise, resolves
 * its view, and returns the snapshot input shape ready to pass into
 * `captureSnapshot` or `captureSnapshotGraph`.
 *
 * Sourced cruises (Voyant Connect from a cruise line) carry their actual
 * source kind / ref through the context.
 */
export async function buildCruiseSnapshotInput(
  db: AnyDrizzleDb,
  cruiseId: string,
  context: CruiseCatalogContext & { pricingBasis?: PricingBasis },
): Promise<Omit<CaptureSnapshotInput, "bookingId"> | null> {
  const view = await getResolvedCruiseById(db, cruiseId, context)
  if (!view) return null
  return buildSnapshotInputFromView(view, {
    entityModule: "cruises",
    entityId: cruiseId,
    sourceKind: context.sourceKind ?? "owned",
    sourceRef: context.sourceRef,
    pricingBasis: context.pricingBasis,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexer document emission
// ─────────────────────────────────────────────────────────────────────────────

export function createCruiseDocumentEmitter(context: {
  sellerOperatorId: string
  sourceKind?: string
  sourceRef?: string
}): DocumentEmitter<typeof cruises.$inferSelect> {
  const registry = getCruisesRegistry()
  return {
    vertical: "cruises",
    emit(source, slice) {
      const projection = cruiseRowToProjection(source, {
        sellerOperatorId: context.sellerOperatorId,
        sourceKind: context.sourceKind,
        sourceRef: context.sourceRef,
      })
      return buildIndexerDocument(registry, projection, slice, source.id)
    },
  }
}

export function createCruiseDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): DocumentBuilder {
  const emitter = createCruiseDocumentEmitter(context)
  return async (entityId: string, slice: IndexerSlice): Promise<IndexerDocument | null> => {
    const rows = await db.select().from(cruises).where(eq(cruises.id, entityId)).limit(1)
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
