/**
 * agent-quality: file-size exception -- owner: promotions; existing promotions service keeps CRUD, link materialization, and event emission co-located until promotion services are split by responsibility.
 *
 * Promotions service — CRUD over `promotional_offers` plus link-table
 * materialization for product-shaped scopes.
 *
 * Per docs/architecture/promotions-architecture.md §13 (PR1 scope):
 *   - listOffers / getOfferById / createOffer / updateOffer / archiveOffer / deleteOffer
 *   - recomputeOfferLinks (rebuilds `promotional_offer_products` from current scope)
 *   - emit `promotion.changed` (when an `eventBus` is supplied via the runtime arg)
 *
 * The evaluator (PR2) and catalog-plane / booking-engine / scheduler wiring
 * (PR3 + PR4 + PR3.boundary) are NOT in this PR.
 *
 * Cross-module reads:
 *   - `categories` scope expands via the Product-owned `product_category_products` table
 *   - `destinations` scope expands via the Product-owned `product_destinations` table
 *     through a resolver seam or raw SQL fallback. Promotions does not import
 *     Product schemas at runtime.
 */

import type { EventBus } from "@voyant-travel/core"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { mapPromotionalOfferWriteError } from "./errors.js"
import {
  PROMOTION_CHANGED_EVENT,
  type PromotionChangedAffected,
  type PromotionChangedEvent,
  type PromotionChangedSource,
} from "./events.js"
import {
  type NewPromotionalOffer,
  type PromotionalOffer,
  promotionalOfferProducts,
  promotionalOfferRedemptions,
  promotionalOffers,
} from "./schema.js"
import type {
  InsertPromotionalOffer,
  PromotionalOfferListQuery,
  PromotionalOfferScope,
  UpdatePromotionalOffer,
} from "./validation.js"

export interface OfferMutationRuntime {
  /**
   * Optional event bus. When wired, every CRUD path emits
   * `promotion.changed` so the catalog bridge reindexes affected products.
   * Per docs/architecture/promotions-architecture.md §9.1.
   */
  eventBus?: EventBus
  /**
   * Override the emission `source`. `createOffer` / `deleteOffer` default
   * to `"created"` / `"deleted"`; `updateOffer` / `archiveOffer` default
   * to `"updated"`. The boundary scheduler (PR3) overrides with
   * `"expired"` for `validUntil` crossings.
   */
  source?: PromotionChangedSource
  /**
   * Optional resolver for Product-owned category/destination scope expansion.
   * Hosts that move Product authoring behind Inventory can inject the
   * appropriate adapter here without making Promotions depend on Product
   * schemas.
   */
  resolveScopeProductIds?: ResolvePromotionalOfferScopeProductIds
  /**
   * Optional resolver for Product-owned product id existence checks.
   * Promotions validates explicit product scopes before writing so the
   * denormalized `promotional_offer_products` table cannot materialize
   * dangling product links. The default resolver uses parameter-bound raw SQL
   * against the Product-owned `products` table to keep this package decoupled
   * from Inventory schemas.
   */
  resolveExistingProductIds?: ResolveExistingPromotionalOfferProductIds
}

export type ResolvePromotionalOfferScopeProductIds = (
  db: PostgresJsDatabase,
  scope: Extract<PromotionalOfferScope, { kind: "categories" | "destinations" }>,
) => Promise<string[]>

export type ResolveExistingPromotionalOfferProductIds = (
  db: PostgresJsDatabase,
  productIds: string[],
) => Promise<string[]>

/** Fields whose change does NOT affect projection or evaluation — safe to skip emit. */
const NON_PROJECTION_FIELDS = new Set<keyof UpdatePromotionalOffer>(["description", "metadata"])

function shouldEmitForUpdate(patch: Partial<UpdatePromotionalOffer>): boolean {
  const keys = Object.keys(patch) as Array<keyof UpdatePromotionalOffer>
  return keys.some((key) => !NON_PROJECTION_FIELDS.has(key))
}

/**
 * Expand an offer's scope to the product set it covers. Used by
 * `recomputeOfferLinks` and by the event emitter to populate
 * `affected.productIds`.
 *
 * Returns `null` for slice-shaped or checkout-shaped scopes (`global`,
 * `markets`, `audiences`, `fare_codes`, `cabin_grades`)
 * to signal that the link table should be empty AND that the event payload
 * should fall back to `affected: { kind: "all" }` — these scopes can match
 * an unbounded product set and we don't enumerate them at write time
 * (per §9.1's resolution rules).
 */
export async function resolveScopeProductIds(
  db: PostgresJsDatabase,
  scope: PromotionalOfferScope,
  resolver?: ResolvePromotionalOfferScopeProductIds,
): Promise<string[] | null> {
  switch (scope.kind) {
    case "products":
      return [...new Set(scope.productIds)]
    case "categories": {
      if (scope.categoryIds.length === 0) return []
      return resolver ? resolver(db, scope) : loadProductIdsForCategoryScope(db, scope.categoryIds)
    }
    case "destinations": {
      if (scope.destinationIds.length === 0) return []
      return resolver
        ? resolver(db, scope)
        : loadProductIdsForDestinationScope(db, scope.destinationIds)
    }
    case "global":
    case "markets":
    case "audiences":
    case "fare_codes":
    case "cabin_grades":
      return null
  }
}

function readProductIdRows(result: unknown): string[] {
  const rows = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: unknown[] } | null)?.rows)
      ? (result as { rows: unknown[] }).rows
      : []
  return rows
    .map((row) => (row as { product_id?: unknown }).product_id)
    .filter((productId): productId is string => typeof productId === "string")
}

function readIdRows(result: unknown): string[] {
  const rows = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: unknown[] } | null)?.rows)
      ? (result as { rows: unknown[] }).rows
      : []
  return rows
    .map((row) => (row as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string")
}

function isMissingProductsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; message?: unknown }
  return (
    record.code === "42P01" ||
    (typeof record.message === "string" &&
      record.message.includes('relation "products" does not exist'))
  )
}

async function loadExistingProductIds(
  db: PostgresJsDatabase,
  productIds: string[],
): Promise<string[]> {
  if (productIds.length === 0) return []
  const dbAny = db as { execute(query: unknown): Promise<unknown> }
  const ids = sql.join(
    productIds.map((productId) => sql`${productId}`),
    sql`, `,
  )
  let result: unknown
  try {
    result = await dbAny.execute(
      // agent-quality: raw-sql reviewed -- owner: promotions; Product owns this table, and ids are parameter-bound through Drizzle.
      sql`SELECT id FROM products WHERE id IN (${ids})`,
    )
  } catch (error) {
    if (isMissingProductsTableError(error)) return []
    throw error
  }
  return readIdRows(result)
}

async function resolveExistingProductIds(
  db: PostgresJsDatabase,
  productIds: string[],
  runtime: OfferMutationRuntime,
): Promise<string[]> {
  const uniqueIds = [...new Set(productIds)]
  return runtime.resolveExistingProductIds
    ? runtime.resolveExistingProductIds(db, uniqueIds)
    : loadExistingProductIds(db, uniqueIds)
}

async function validatePromotionalOfferScopeReferences(
  db: PostgresJsDatabase,
  scope: PromotionalOfferScope,
  runtime: OfferMutationRuntime,
): Promise<void> {
  if (scope.kind !== "products") return
  const productIds = [...new Set(scope.productIds)]
  const existingIds = new Set(await resolveExistingProductIds(db, productIds, runtime))
  const missingProductIds = productIds.filter((productId) => !existingIds.has(productId))
  if (missingProductIds.length === 0) return

  throw new ApiHttpError("Promotional offer references unknown product ids", {
    status: 400,
    code: "invalid_reference",
    details: {
      resource: "promotional_offer",
      field: "scope.productIds",
      missingProductIds,
      issues: missingProductIds.map((productId) => ({
        code: "unknown_product_id",
        path: ["scope", "productIds"],
        message: `Unknown product id: ${productId}`,
      })),
    },
  })
}

async function loadProductIdsForCategoryScope(
  db: PostgresJsDatabase,
  categoryIds: string[],
): Promise<string[]> {
  const dbAny = db as { execute(query: unknown): Promise<unknown> }
  const ids = sql.join(
    categoryIds.map((categoryId) => sql`${categoryId}`),
    sql`, `,
  )
  const result = await dbAny.execute(
    // agent-quality: raw-sql reviewed -- owner: promotions; Product owns this link table, and ids are parameter-bound through Drizzle.
    sql`SELECT DISTINCT product_id FROM product_category_products WHERE category_id IN (${ids})`,
  )
  return readProductIdRows(result)
}

async function loadProductIdsForDestinationScope(
  db: PostgresJsDatabase,
  destinationIds: string[],
): Promise<string[]> {
  const dbAny = db as { execute(query: unknown): Promise<unknown> }
  const ids = sql.join(
    destinationIds.map((destinationId) => sql`${destinationId}`),
    sql`, `,
  )
  const result = await dbAny.execute(
    // agent-quality: raw-sql reviewed -- owner: promotions; Product owns this link table, and ids are parameter-bound through Drizzle.
    sql`SELECT DISTINCT product_id FROM product_destinations WHERE destination_id IN (${ids})`,
  )
  return readProductIdRows(result)
}

/**
 * Rebuild the `promotional_offer_products` rows for an offer from its
 * current scope. Idempotent: deletes any prior rows, inserts the
 * freshly-resolved set. Slice-shaped scopes leave the table empty.
 */
export async function recomputeOfferLinks(
  db: PostgresJsDatabase,
  offerId: string,
  scope: PromotionalOfferScope,
  runtime: OfferMutationRuntime = {},
): Promise<{ productIds: string[] | null }> {
  const productIds = await resolveScopeProductIds(db, scope, runtime.resolveScopeProductIds)
  await db.delete(promotionalOfferProducts).where(eq(promotionalOfferProducts.offerId, offerId))
  if (productIds && productIds.length > 0) {
    await db
      .insert(promotionalOfferProducts)
      .values(productIds.map((productId) => ({ offerId, productId })))
  }
  return { productIds }
}

function toAffected(productIds: string[] | null): PromotionChangedAffected {
  if (productIds === null) return { kind: "all" }
  return { kind: "products", productIds }
}

function unionAffectedProductIds(
  previousProductIds: string[] | null,
  nextProductIds: string[] | null,
): string[] | null {
  if (previousProductIds === null || nextProductIds === null) return null
  return [...new Set([...previousProductIds, ...nextProductIds])]
}

async function emitChange(
  runtime: OfferMutationRuntime,
  payload: PromotionChangedEvent,
): Promise<void> {
  const eventBus = runtime.eventBus
  if (!eventBus) return
  await eventBus.emit(PROMOTION_CHANGED_EVENT, payload, {
    category: "domain",
    source: "service",
  })
}

function normalizeCode(code: string | null | undefined): string | null {
  if (code == null) return null
  return code.toLowerCase()
}

function toRowValues(input: InsertPromotionalOffer): NewPromotionalOffer {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    discountType: input.discountType,
    discountPercent: input.discountPercent != null ? String(input.discountPercent) : null,
    discountAmountCents: input.discountAmountCents ?? null,
    currency: input.currency ?? null,
    scope: input.scope,
    conditions: input.conditions ?? {},
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    code: normalizeCode(input.code),
    stackable: input.stackable ?? false,
    active: input.active ?? true,
    metadata: input.metadata ?? null,
  }
}

function toUpdateValues(patch: UpdatePromotionalOffer): Partial<NewPromotionalOffer> {
  const out: Partial<NewPromotionalOffer> = {
    updatedAt: new Date(),
  }
  if (patch.name !== undefined) out.name = patch.name
  if (patch.slug !== undefined) out.slug = patch.slug
  if (patch.description !== undefined) out.description = patch.description ?? null
  if (patch.discountType !== undefined) out.discountType = patch.discountType
  if (patch.discountPercent !== undefined) {
    out.discountPercent = patch.discountPercent != null ? String(patch.discountPercent) : null
  }
  if (patch.discountAmountCents !== undefined) {
    out.discountAmountCents = patch.discountAmountCents ?? null
  }
  if (patch.currency !== undefined) out.currency = patch.currency ?? null
  if (patch.scope !== undefined) out.scope = patch.scope
  if (patch.conditions !== undefined) out.conditions = patch.conditions
  if (patch.validFrom !== undefined) out.validFrom = patch.validFrom ?? null
  if (patch.validUntil !== undefined) out.validUntil = patch.validUntil ?? null
  if (patch.code !== undefined) out.code = normalizeCode(patch.code)
  if (patch.stackable !== undefined) out.stackable = patch.stackable
  if (patch.active !== undefined) out.active = patch.active
  if (patch.metadata !== undefined) out.metadata = patch.metadata ?? null
  return out
}

async function listOffers(db: PostgresJsDatabase, query: PromotionalOfferListQuery) {
  const where = []
  if (query.active !== undefined) where.push(eq(promotionalOffers.active, query.active))
  if (query.code !== undefined) where.push(eq(promotionalOffers.code, query.code.toLowerCase()))
  if (query.search !== undefined) {
    const term = `%${query.search}%`
    where.push(
      or(
        ilike(promotionalOffers.name, term),
        ilike(promotionalOffers.slug, term),
        ilike(promotionalOffers.description, term),
        ilike(promotionalOffers.code, term),
      ),
    )
  }
  if (query.applicationMode === "auto") where.push(isNull(promotionalOffers.code))
  if (query.applicationMode === "code") where.push(isNotNull(promotionalOffers.code))
  if (query.scopeKind !== undefined) {
    // agent-quality: raw-sql reviewed -- owner: promotions; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    where.push(sql`${promotionalOffers.scope}->>'kind' = ${query.scopeKind}`)
  }
  if (query.status !== undefined) {
    const now = new Date()
    if (query.status === "archived") {
      where.push(eq(promotionalOffers.active, false))
    } else if (query.status === "scheduled") {
      where.push(and(eq(promotionalOffers.active, true), gte(promotionalOffers.validFrom, now)))
    } else if (query.status === "expired") {
      where.push(and(eq(promotionalOffers.active, true), lte(promotionalOffers.validUntil, now)))
    } else {
      where.push(
        and(
          eq(promotionalOffers.active, true),
          or(isNull(promotionalOffers.validFrom), lte(promotionalOffers.validFrom, now)),
          or(isNull(promotionalOffers.validUntil), gte(promotionalOffers.validUntil, now)),
        ),
      )
    }
  }
  if (query.validFrom !== undefined) {
    where.push(
      or(
        isNull(promotionalOffers.validUntil),
        gte(promotionalOffers.validUntil, startOfDay(query.validFrom)),
      ),
    )
  }
  if (query.validUntil !== undefined) {
    where.push(
      or(
        isNull(promotionalOffers.validFrom),
        lte(promotionalOffers.validFrom, endOfDay(query.validUntil)),
      ),
    )
  }

  const filter = where.length > 0 ? and(...where) : undefined
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  const [totalRow] = await db
    .select({ total: count() })
    .from(promotionalOffers)
    .where(filter ?? sql`true`)
  const total = totalRow?.total ?? 0

  const data = await db
    .select()
    .from(promotionalOffers)
    .where(filter ?? sql`true`)
    .orderBy(desc(promotionalOffers.createdAt))
    .limit(limit)
    .offset(offset)

  return { data, total, limit, offset }
}

function startOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

function endOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`)
}

async function getOfferById(db: PostgresJsDatabase, id: string): Promise<PromotionalOffer | null> {
  const [row] = await db
    .select()
    .from(promotionalOffers)
    .where(eq(promotionalOffers.id, id))
    .limit(1)
  return row ?? null
}

async function createOffer(
  db: PostgresJsDatabase,
  input: InsertPromotionalOffer,
  runtime: OfferMutationRuntime = {},
): Promise<PromotionalOffer> {
  await validatePromotionalOfferScopeReferences(db, input.scope, runtime)

  let row: PromotionalOffer | undefined
  try {
    const [inserted] = await db.insert(promotionalOffers).values(toRowValues(input)).returning()
    row = inserted
  } catch (err) {
    mapPromotionalOfferWriteError(err)
  }
  if (!row) throw new Error("createOffer: insert returned no row")

  const { productIds } = await recomputeOfferLinks(db, row.id, input.scope, runtime)

  await emitChange(runtime, {
    offerId: row.id,
    source: runtime.source ?? "created",
    affected: toAffected(productIds),
  })

  return row
}

async function updateOffer(
  db: PostgresJsDatabase,
  id: string,
  patch: UpdatePromotionalOffer,
  runtime: OfferMutationRuntime = {},
): Promise<PromotionalOffer | null> {
  const updateValues = toUpdateValues(patch)
  const previousScope =
    patch.scope !== undefined && shouldEmitForUpdate(patch)
      ? (await getOfferById(db, id))?.scope
      : null
  if (patch.scope !== undefined && previousScope === undefined) return null
  if (patch.scope !== undefined) {
    await validatePromotionalOfferScopeReferences(db, patch.scope, runtime)
  }

  let row: PromotionalOffer | undefined
  try {
    const [updated] = await db
      .update(promotionalOffers)
      .set(updateValues)
      .where(eq(promotionalOffers.id, id))
      .returning()
    row = updated
  } catch (err) {
    mapPromotionalOfferWriteError(err)
  }
  if (!row) return null

  // Re-materialize links if the scope changed. The link table reflects
  // the current scope at all times, so any scope edit (including a
  // category-id list edit) requires a rebuild.
  let productIds: string[] | null
  if (patch.scope !== undefined) {
    productIds = (await recomputeOfferLinks(db, id, patch.scope, runtime)).productIds
  } else {
    productIds = await resolveScopeProductIds(db, row.scope, runtime.resolveScopeProductIds)
  }

  if (shouldEmitForUpdate(patch)) {
    const affectedProductIds =
      patch.scope !== undefined && previousScope
        ? unionAffectedProductIds(
            await resolveScopeProductIds(db, previousScope, runtime.resolveScopeProductIds),
            productIds,
          )
        : productIds
    await emitChange(runtime, {
      offerId: row.id,
      source: runtime.source ?? "updated",
      affected: toAffected(affectedProductIds),
    })
  }

  return row
}

async function archiveOffer(
  db: PostgresJsDatabase,
  id: string,
  runtime: OfferMutationRuntime = {},
): Promise<PromotionalOffer | null> {
  const [row] = await db
    .update(promotionalOffers)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(promotionalOffers.id, id))
    .returning()
  if (!row) return null

  const productIds = await resolveScopeProductIds(db, row.scope, runtime.resolveScopeProductIds)
  await emitChange(runtime, {
    offerId: row.id,
    source: runtime.source ?? "updated",
    affected: toAffected(productIds),
  })

  return row
}

async function deleteOffer(
  db: PostgresJsDatabase,
  id: string,
  runtime: OfferMutationRuntime = {},
): Promise<{ id: string } | null> {
  // Check redemptions FIRST so the caller gets a clearer error than the raw
  // FK-violation that the RESTRICT would surface from the delete attempt.
  const [redemptionCountRow] = await db
    .select({ total: count() })
    .from(promotionalOfferRedemptions)
    .where(eq(promotionalOfferRedemptions.offerId, id))
  const redemptionCount = redemptionCountRow?.total ?? 0
  if (redemptionCount > 0) {
    throw new Error(
      `cannot delete offer ${id}: ${redemptionCount} redemption(s) exist; archive (set active = false) instead`,
    )
  }

  // Capture the resolved product set BEFORE delete so we can emit the
  // affected list after CASCADE wipes `promotional_offer_products`.
  const existing = await getOfferById(db, id)
  if (!existing) return null
  const productIds = await resolveScopeProductIds(
    db,
    existing.scope,
    runtime.resolveScopeProductIds,
  )

  const [deleted] = await db
    .delete(promotionalOffers)
    .where(eq(promotionalOffers.id, id))
    .returning({ id: promotionalOffers.id })
  if (!deleted) return null

  await emitChange(runtime, {
    offerId: deleted.id,
    source: runtime.source ?? "deleted",
    affected: toAffected(productIds),
  })

  return deleted
}

export const promotionsService = {
  listOffers,
  getOfferById,
  createOffer,
  updateOffer,
  archiveOffer,
  deleteOffer,
  recomputeOfferLinks,
  resolveScopeProductIds,
  validatePromotionalOfferScopeReferences,
}

export type PromotionsService = typeof promotionsService
