/**
 * OverlayService — drizzle-bound entry point for the catalog overlay store.
 *
 * Wraps the pure `resolveOverlay` logic (in `../overlay/resolver.ts`) with
 * the DB queries verticals actually need: fetch active overlays for an
 * entity, write a new overlay row, soft-delete an overlay, list by origin,
 * and the all-in-one `resolveEntityView` helper that fetches + resolves in
 * one call.
 *
 * Functions take an `AnyDrizzleDb` as their first parameter to match the
 * existing voyant convention (see `packages/products/src/service.ts`). Pure
 * resolver logic stays separate and remains unit-testable without a DB.
 *
 * See `docs/architecture/catalog-architecture.md` §5.2 for the design.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import type { FieldPolicyRegistry, Visibility } from "../contract.js"
import {
  type OverlayLookup,
  type ResolvedView,
  type ResolverOverlay,
  type ResolverScope,
  resolveOverlay,
} from "../overlay/resolver.js"
import {
  catalogOverlayTable,
  OVERLAY_DEFAULT_SCOPE,
  type OverlayOrigin,
  type SelectCatalogOverlay,
} from "../overlay/schema.js"

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all active (not soft-deleted) overlays for an entity in one query.
 * The resolver expects this exact shape; downstream callers pass the result
 * straight into `resolveOverlay`.
 */
export async function fetchOverlaysForEntity(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<ResolverOverlay[]> {
  const rows = await db
    .select({
      field_path: catalogOverlayTable.field_path,
      locale: catalogOverlayTable.locale,
      audience: catalogOverlayTable.audience,
      market: catalogOverlayTable.market,
      value: catalogOverlayTable.value,
    })
    .from(catalogOverlayTable)
    .where(
      and(
        eq(catalogOverlayTable.entity_module, entityModule),
        eq(catalogOverlayTable.entity_id, entityId),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )

  return rows.map((row) => ({
    field_path: row.field_path,
    locale: row.locale,
    audience: row.audience,
    market: row.market,
    value: row.value,
  }))
}

/**
 * Batched form of `fetchOverlaysForEntity`: fetch all active overlays for
 * many entities of one module in a single query, grouped by entity id.
 *
 * Every requested id is present in the returned map (entities without
 * overlays map to an empty array), so callers can index without null
 * checks. Pass the per-entity array straight into
 * `resolveEntityViewWithOverlays` — the result is identical to calling
 * `resolveEntityView` once per entity, minus the N-1 round trips.
 */
export async function fetchOverlaysForEntities(
  db: AnyDrizzleDb,
  entityModule: string,
  entityIds: ReadonlyArray<string>,
): Promise<Map<string, ResolverOverlay[]>> {
  const byEntity = new Map<string, ResolverOverlay[]>()
  for (const id of entityIds) {
    if (!byEntity.has(id)) byEntity.set(id, [])
  }
  if (byEntity.size === 0) return byEntity

  const rows = await db
    .select({
      entity_id: catalogOverlayTable.entity_id,
      field_path: catalogOverlayTable.field_path,
      locale: catalogOverlayTable.locale,
      audience: catalogOverlayTable.audience,
      market: catalogOverlayTable.market,
      value: catalogOverlayTable.value,
    })
    .from(catalogOverlayTable)
    .where(
      and(
        eq(catalogOverlayTable.entity_module, entityModule),
        inArray(catalogOverlayTable.entity_id, [...byEntity.keys()]),
        isNull(catalogOverlayTable.deleted_at),
      ),
    )

  for (const row of rows) {
    byEntity.get(row.entity_id)?.push({
      field_path: row.field_path,
      locale: row.locale,
      audience: row.audience,
      market: row.market,
      value: row.value,
    })
  }
  return byEntity
}

/**
 * Resolve an entity's view in one call: fetch overlays, run the resolver,
 * return the merged view filtered by the actor's visibility.
 *
 * The caller supplies the source projection (typically gathered from the
 * vertical's own service layer) and the requesting scope. Verticals call
 * this in their `getEntity` / `listEntities` paths.
 */
export async function resolveEntityView(
  db: AnyDrizzleDb,
  registry: FieldPolicyRegistry,
  entityModule: string,
  entityId: string,
  sourceProjection: ReadonlyMap<string, unknown>,
  scope: ResolverScope,
): Promise<ResolvedView> {
  const overlays = await fetchOverlaysForEntity(db, entityModule, entityId)
  return resolveOverlay(registry, sourceProjection, overlays, scope)
}

/**
 * Lower-level helper for callers that have already fetched overlays (e.g.
 * batch read-paths that pre-fetch overlays for many entities in one query).
 */
export function resolveEntityViewWithOverlays(
  registry: FieldPolicyRegistry,
  sourceProjection: ReadonlyMap<string, unknown>,
  overlays: OverlayLookup,
  scope: ResolverScope,
): ResolvedView {
  return resolveOverlay(registry, sourceProjection, overlays, scope)
}

/**
 * List overlay rows by their origin discriminator. Used by revert / re-sync
 * workflows ("show me everything Sanity wrote in the last week", "revert
 * all AI-generated overlays on this entity").
 */
export interface OverlayOriginFilter {
  kind: OverlayOrigin["kind"]
  /** Kind-specific narrowing — e.g. `provider: "sanity"` for `kind: "cms"`. */
  match?: Partial<OverlayOrigin>
}

export async function listOverlaysByOrigin(
  db: AnyDrizzleDb,
  filter: OverlayOriginFilter,
  options: { includeDeleted?: boolean; limit?: number } = {},
): Promise<SelectCatalogOverlay[]> {
  // agent-quality: raw-sql reviewed -- JSONB origin discriminator uses parameterized values; Drizzle has no helper for the `->>` JSON key predicate here.
  const conditions = [sql`${catalogOverlayTable.origin}->>'kind' = ${filter.kind}`]
  if (filter.match) {
    for (const [key, value] of Object.entries(filter.match)) {
      if (key === "kind") continue
      // agent-quality: raw-sql reviewed -- Origin match keys come from the typed overlay-origin filter and values stay parameterized.
      conditions.push(sql`${catalogOverlayTable.origin}->>${key} = ${String(value)}`)
    }
  }
  if (!options.includeDeleted) {
    // agent-quality: raw-sql reviewed -- Literal deleted_at null predicate is scoped to the overlay table.
    conditions.push(sql`${catalogOverlayTable.deleted_at} IS NULL`)
  }

  if (options.limit != null) {
    return db
      .select()
      .from(catalogOverlayTable)
      .where(and(...conditions))
      .limit(options.limit)
  }

  return db
    .select()
    .from(catalogOverlayTable)
    .where(and(...conditions))
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for writing a single overlay row. Variant axes default to
 * `OVERLAY_DEFAULT_SCOPE`.
 */
export interface WriteOverlayInput {
  entity_module: string
  entity_id: string
  field_path: string
  locale?: string
  audience?: Visibility | typeof OVERLAY_DEFAULT_SCOPE
  market?: string
  value: unknown
  origin: OverlayOrigin
}

/**
 * Write or replace an overlay row for the given variant tuple.
 *
 * If a row already exists for `(entity_module, entity_id, field_path,
 * locale, audience, market)` and is not soft-deleted, this updates its
 * value, origin, and `updated_at`. The partial unique index on the active
 * rows guarantees idempotency.
 *
 * Last-write-wins is the default conflict-resolution policy (see
 * architecture §5.2.3); per-field canonical-writer config is deferred.
 *
 * Note: this function does not validate that the field policy permits an
 * overlay write (e.g. that `merge` is not `source-only` or that the actor's
 * `editRole` matches). Callers are responsible for policy validation; the
 * service-layer caller typically wraps this with a check against the
 * vertical's `FieldPolicyRegistry`.
 */
export async function writeOverlay(
  db: AnyDrizzleDb,
  input: WriteOverlayInput,
): Promise<SelectCatalogOverlay> {
  const locale = input.locale ?? OVERLAY_DEFAULT_SCOPE
  const audience = input.audience ?? OVERLAY_DEFAULT_SCOPE
  const market = input.market ?? OVERLAY_DEFAULT_SCOPE

  // Insert with ON CONFLICT for the active-row composite unique key.
  // Drizzle's onConflictDoUpdate is the right primitive here.
  const inserted = await db
    .insert(catalogOverlayTable)
    .values({
      id: newId("catalog_overlay"),
      entity_module: input.entity_module,
      entity_id: input.entity_id,
      field_path: input.field_path,
      locale,
      audience,
      market,
      value: input.value,
      origin: input.origin,
    })
    .onConflictDoUpdate({
      target: [
        catalogOverlayTable.entity_module,
        catalogOverlayTable.entity_id,
        catalogOverlayTable.field_path,
        catalogOverlayTable.locale,
        catalogOverlayTable.audience,
        catalogOverlayTable.market,
      ],
      targetWhere: isNull(catalogOverlayTable.deleted_at),
      set: {
        value: input.value,
        origin: input.origin,
        updated_at: new Date(),
      },
    })
    .returning()

  if (!inserted[0]) {
    throw new Error("writeOverlay: insert returned no rows")
  }
  return inserted[0]
}

/**
 * Soft-delete an overlay row by setting `deleted_at`. The row is preserved
 * for retention / restore but no longer participates in resolver merges.
 */
export async function softDeleteOverlay(db: AnyDrizzleDb, id: string): Promise<void> {
  await db
    .update(catalogOverlayTable)
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where(eq(catalogOverlayTable.id, id))
}

/**
 * Restore a soft-deleted overlay by clearing `deleted_at`. Used by source
 * reconnection (§5.10.5) when an entity comes back within the retention
 * window.
 */
export async function restoreOverlay(db: AnyDrizzleDb, id: string): Promise<void> {
  await db
    .update(catalogOverlayTable)
    .set({ deleted_at: null, updated_at: new Date() })
    .where(eq(catalogOverlayTable.id, id))
}
