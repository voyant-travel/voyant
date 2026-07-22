/**
 * Catalog-plane integration for the cruises service.
 *
 * Mirrors the pattern in `packages/products/src/service-catalog-plane.ts`.
 * Adds catalog-aware methods alongside the existing service surface.
 *
 * See `docs/architecture/catalog-architecture.md` §9.1.
 */

import {
  buildIndexerDocument,
  buildSnapshotInputFromView,
  readSourcedEntry,
  type CaptureSnapshotInput,
  createFieldPolicyRegistry,
  type DocumentBuilder,
  type DocumentBuilderContext,
  type DocumentEmitter,
  type FieldPolicy,
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
import { eq } from "drizzle-orm"

import { cruiseCatalogPolicy } from "./catalog-policy.js"
import { CRUISE_SHIP_REFERENCE_FIELD_POLICY } from "./catalog-policy-ships.js"
import { isCustomerCruiseBookable } from "./customer-bookability.js"
import { cruises } from "./schema-core.js"
import {
  findSourcedCruiseShipSubjectId,
  projectEffectiveCruiseShipReference,
  readEffectiveCruiseShipReferenceProjection,
} from "./service-presentation-subjects.js"

let _registry: FieldPolicyRegistry | undefined
function getCruisesRegistry(): FieldPolicyRegistry {
  if (!_registry) {
    _registry = createFieldPolicyRegistry([
      ...cruiseCatalogPolicy,
      ...CRUISE_SHIP_REFERENCE_FIELD_POLICY,
    ])
  }
  return _registry
}

export interface CruiseProjectionExtension {
  readonly name: string
  project(
    db: AnyDrizzleDb,
    cruiseId: string,
    slice: IndexerSlice,
  ): Promise<ReadonlyMap<string, unknown>>
}

export function createCruisesRegistry(
  ...extensionPolicies: ReadonlyArray<ReadonlyArray<FieldPolicy>>
): FieldPolicyRegistry {
  if (extensionPolicies.length === 0) return getCruisesRegistry()
  const composed: FieldPolicy[] = [
    ...cruiseCatalogPolicy,
    ...CRUISE_SHIP_REFERENCE_FIELD_POLICY,
  ]
  for (const policies of extensionPolicies) {
    composed.push(...policies)
  }
  return createFieldPolicyRegistry(composed)
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
    ["thumbnailUrl", row.heroImageUrl],
    ["mapImageUrl", row.mapImageUrl],

    // Structural
    ["cruiseType", row.cruiseType],
    ["status", row.status],
    ["lineSupplierId", row.lineSupplierId],
    ["defaultShipId", row.defaultShipId],
    ["nights", row.nights],
    ["embarkPortFacilityId", row.embarkPortFacilityId],
    ["embarkPortCanonicalPlaceId", row.embarkPortCanonicalPlaceId],
    ["disembarkPortFacilityId", row.disembarkPortFacilityId],
    ["disembarkPortCanonicalPlaceId", row.disembarkPortCanonicalPlaceId],
    ["region_ids[]", row.regionIds],
    ["waterway_ids[]", row.waterwayIds],
    ["port_ids[]", row.portIds],
    ["country_iso[]", row.countryIso],
    ["regions[]", row.regions],
    ["waterways[]", row.waterways],
    ["ports[]", row.ports],
    ["countries[]", row.countries],
    ["themes[]", row.themes],

    // Volatile-indexed (browse-time approximations)
    ["lowestPriceCached", moneyStringToCents(row.lowestPriceCached)],
    ["lowestPriceCurrencyCached", row.lowestPriceCurrencyCached],
    ["lowestPriceUnit", "minor"],
    ["earliestDepartureCached", row.earliestDepartureCached],
    ["latestDepartureCached", row.latestDepartureCached],
  ])
}

function moneyStringToCents(value: string | null | undefined): number | null {
  if (!value) return null
  const major = Number.parseFloat(value)
  if (!Number.isFinite(major)) return null
  return Math.round(major * 100)
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
  registry?: FieldPolicyRegistry
}): DocumentEmitter<typeof cruises.$inferSelect> {
  const registry = context.registry ?? getCruisesRegistry()
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
  context: {
    sellerOperatorId: string
    sourceKind?: string
    sourceRef?: string
    extensions?: ReadonlyArray<CruiseProjectionExtension>
    registry?: FieldPolicyRegistry
  },
): DocumentBuilder {
  const registry = context.registry ?? getCruisesRegistry()
  const extensions = context.extensions ?? []
  return async (
    entityId: string,
    slice: IndexerSlice,
    builderContext?: DocumentBuilderContext,
  ): Promise<IndexerDocument | null> => {
    const rows = await db.select().from(cruises).where(eq(cruises.id, entityId)).limit(1)
    const row = rows[0]
    if (row && slice.audience === "customer" && !(await isCustomerCruiseBookable(db, row))) {
      return null
    }
    const sourced = row ? null : await readSourcedEntry(db, "cruises", entityId)
    if (!row && (!sourced || sourced.status !== "active")) return null

    const baseProjection = row
      ? cruiseRowToProjection(row, {
          sellerOperatorId: context.sellerOperatorId,
          sourceKind: context.sourceKind,
          sourceRef: context.sourceRef,
        })
      : new Map<string, unknown>(Object.entries(sourced!.projection))
    const extensionProjections = await Promise.all(
      extensions.map((ext) => ext.project(db, entityId, slice)),
    )
    const shipSubjectId = row?.defaultShipId ?? (await findSourcedCruiseShipSubjectId(db, sourced))
    const canonicalShipProjection =
      shipSubjectId && builderContext
        ? await builderContext.resolveReferencedSubject({
            entityModule: "cruise-ships",
            entityId: shipSubjectId,
            scope: {
              locale: slice.locale,
              audience: slice.audience === "staff-admin" ? "staff" : slice.audience,
              market: slice.market,
            },
          })
        : null
    const shipProjection =
      canonicalShipProjection ??
      (shipSubjectId
        ? await readEffectiveCruiseShipReferenceProjection(db, shipSubjectId, slice)
        : null)
    const merged = new Map<string, unknown>(baseProjection)
    for (const projection of extensionProjections) {
      for (const [path, value] of projection) {
        merged.set(path, value)
      }
    }
    if (shipProjection) {
      for (const [path, value] of projectEffectiveCruiseShipReference(shipProjection)) {
        merged.set(path, value)
      }
    }
    return buildIndexerDocument(registry, merged, slice, entityId)
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
