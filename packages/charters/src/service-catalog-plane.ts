/**
 * Catalog-plane integration for the charters service.
 *
 * Mirrors the products / cruises / accommodations pattern. Charters carry a
 * couple of vertical-specific managed fields — `defaultMybaTemplateId` and
 * `defaultApaPercent` — that participate in the snapshot at quote/book time.
 *
 * See `docs/architecture/catalog-architecture.md` §9.1 and
 * `docs/architecture/charters-module.md`.
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

import { charterCatalogPolicy } from "./catalog-policy.js"
import { charterProducts } from "./schema-core.js"

let _registry: FieldPolicyRegistry | undefined
function getChartersRegistry(): FieldPolicyRegistry {
  if (!_registry) {
    _registry = createFieldPolicyRegistry(charterCatalogPolicy)
  }
  return _registry
}

/**
 * Maps a charter-product row to a field-keyed projection. Most charters are
 * operator-owned (yacht agencies typically own the inventory they sell);
 * sourced charters from a brand's central booking system would carry their
 * actual provenance.
 */
export function charterProductRowToProjection(
  row: typeof charterProducts.$inferSelect,
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
    ["heroImageUrl", row.heroImageUrl],
    ["thumbnailUrl", row.heroImageUrl],
    ["mapImageUrl", row.mapImageUrl],

    // Structural
    ["status", row.status],
    ["lineSupplierId", row.lineSupplierId],
    ["defaultYachtId", row.defaultYachtId],
    ["regions[]", row.regions],
    ["themes[]", row.themes],
    ["defaultBookingModes[]", row.defaultBookingModes],

    // Charter-specific managed fields (legal-sensitive — captured in snapshot)
    ["defaultMybaTemplateId", row.defaultMybaTemplateId],
    ["defaultApaPercent", row.defaultApaPercent],

    // Volatile-indexed
    ["lowestPriceCachedAmount", row.lowestPriceCachedAmount],
    ["lowestPriceCachedCurrency", row.lowestPriceCachedCurrency],
    ["earliestVoyageCached", row.earliestVoyageCached],
    ["latestVoyageCached", row.latestVoyageCached],
  ])
}

export function charterProvenance(
  _row: typeof charterProducts.$inferSelect,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): Provenance {
  return {
    source_kind: context.sourceKind ?? "owned",
    source_freshness: context.sourceKind && context.sourceKind !== "owned" ? "sync" : "static",
    source_ref: context.sourceRef,
  }
}

export interface CharterCatalogContext {
  sellerOperatorId: string
  scope: ResolverScope
  sourceKind?: string
  sourceRef?: string
}

export async function getResolvedCharterById(
  db: AnyDrizzleDb,
  id: string,
  context: CharterCatalogContext,
): Promise<ResolvedView | null> {
  const rows = await db.select().from(charterProducts).where(eq(charterProducts.id, id)).limit(1)
  const row = rows[0]
  if (!row) return null

  const projection = charterProductRowToProjection(row, {
    sellerOperatorId: context.sellerOperatorId,
    sourceKind: context.sourceKind,
    sourceRef: context.sourceRef,
  })
  return resolveEntityView(db, getChartersRegistry(), "charters", id, projection, context.scope)
}

export async function listResolvedCharters(
  db: AnyDrizzleDb,
  rows: ReadonlyArray<typeof charterProducts.$inferSelect>,
  context: CharterCatalogContext,
): Promise<ResolvedView[]> {
  const registry = getChartersRegistry()
  const views: ResolvedView[] = []
  for (const row of rows) {
    const projection = charterProductRowToProjection(row, {
      sellerOperatorId: context.sellerOperatorId,
      sourceKind: context.sourceKind,
      sourceRef: context.sourceRef,
    })
    const view = await resolveEntityView(
      db,
      registry,
      "charters",
      row.id,
      projection,
      context.scope,
    )
    views.push(view)
  }
  return views
}

/**
 * Build a `CaptureSnapshotInput` for a charter product. Charters' MYBA
 * template id and APA percent participate in the snapshot per the policy
 * (snapshot mode `on-book` and `on-quote-and-book` respectively) — the
 * resolved view already includes them, so no special handling needed here.
 */
export async function buildCharterSnapshotInput(
  db: AnyDrizzleDb,
  charterProductId: string,
  context: CharterCatalogContext & { pricingBasis?: PricingBasis },
): Promise<Omit<CaptureSnapshotInput, "bookingId"> | null> {
  const view = await getResolvedCharterById(db, charterProductId, context)
  if (!view) return null
  return buildSnapshotInputFromView(view, {
    entityModule: "charters",
    entityId: charterProductId,
    sourceKind: context.sourceKind ?? "owned",
    sourceRef: context.sourceRef,
    pricingBasis: context.pricingBasis,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexer document emission
// ─────────────────────────────────────────────────────────────────────────────

export function createCharterDocumentEmitter(context: {
  sellerOperatorId: string
  sourceKind?: string
  sourceRef?: string
}): DocumentEmitter<typeof charterProducts.$inferSelect> {
  const registry = getChartersRegistry()
  return {
    vertical: "charters",
    emit(source, slice) {
      const projection = charterProductRowToProjection(source, {
        sellerOperatorId: context.sellerOperatorId,
        sourceKind: context.sourceKind,
        sourceRef: context.sourceRef,
      })
      return buildIndexerDocument(registry, projection, slice, source.id)
    },
  }
}

export function createCharterDocumentBuilder(
  db: AnyDrizzleDb,
  context: { sellerOperatorId: string; sourceKind?: string; sourceRef?: string },
): DocumentBuilder {
  const emitter = createCharterDocumentEmitter(context)
  return async (entityId: string, slice: IndexerSlice): Promise<IndexerDocument | null> => {
    const rows = await db
      .select()
      .from(charterProducts)
      .where(eq(charterProducts.id, entityId))
      .limit(1)
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
