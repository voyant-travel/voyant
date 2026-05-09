/**
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
 *   - `categories` scope expands via `product_category_products` (in @voyantjs/products)
 *   - `destinations` scope expands via `product_destinations` (in @voyantjs/products)
 */

import type { EventBus } from "@voyantjs/core"
import { productCategoryProducts, productDestinations } from "@voyantjs/products/schema"
import { and, count, desc, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

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
}

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
 * Returns `null` for slice-shaped scopes (`global`, `markets`, `audiences`)
 * to signal that the link table should be empty AND that the event payload
 * should fall back to `affected: { kind: "all" }` — these scopes can match
 * an unbounded product set and we don't enumerate them at write time
 * (per §9.1's resolution rules).
 */
export async function resolveScopeProductIds(
  db: PostgresJsDatabase,
  scope: PromotionalOfferScope,
): Promise<string[] | null> {
  switch (scope.kind) {
    case "products":
      return [...new Set(scope.productIds)]
    case "categories": {
      if (scope.categoryIds.length === 0) return []
      const rows = await db
        .selectDistinct({ productId: productCategoryProducts.productId })
        .from(productCategoryProducts)
        .where(inArray(productCategoryProducts.categoryId, scope.categoryIds))
      return rows.map((r) => r.productId)
    }
    case "destinations": {
      if (scope.destinationIds.length === 0) return []
      const rows = await db
        .selectDistinct({ productId: productDestinations.productId })
        .from(productDestinations)
        .where(inArray(productDestinations.destinationId, scope.destinationIds))
      return rows.map((r) => r.productId)
    }
    case "global":
    case "markets":
    case "audiences":
      return null
  }
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
): Promise<{ productIds: string[] | null }> {
  const productIds = await resolveScopeProductIds(db, scope)
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
  const [row] = await db.insert(promotionalOffers).values(toRowValues(input)).returning()
  if (!row) throw new Error("createOffer: insert returned no row")

  const { productIds } = await recomputeOfferLinks(db, row.id, input.scope)

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

  const [row] = await db
    .update(promotionalOffers)
    .set(updateValues)
    .where(eq(promotionalOffers.id, id))
    .returning()
  if (!row) return null

  // Re-materialize links if the scope changed. The link table reflects
  // the current scope at all times, so any scope edit (including a
  // category-id list edit) requires a rebuild.
  let productIds: string[] | null
  if (patch.scope !== undefined) {
    productIds = (await recomputeOfferLinks(db, id, patch.scope)).productIds
  } else {
    productIds = await resolveScopeProductIds(db, row.scope)
  }

  if (shouldEmitForUpdate(patch)) {
    await emitChange(runtime, {
      offerId: row.id,
      source: runtime.source ?? "updated",
      affected: toAffected(productIds),
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

  const productIds = await resolveScopeProductIds(db, row.scope)
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
  const productIds = await resolveScopeProductIds(db, existing.scope)

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
}

export type PromotionsService = typeof promotionsService
