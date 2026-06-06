import { productsService } from "@voyantjs/products"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type CloneContext, copyProductContent, withoutSystemColumns } from "./clone-content.js"
import { copyPricingAndAvailability } from "./clone-pricing.js"
import { productAuthoringRequests } from "./schema.js"

type Product = typeof products.$inferSelect

export interface CloneProductOptions {
  /** New product name. Defaults to `"{source} (Copy)"` (preserves the UI's no-body call). */
  name?: string
  /** New product status. Defaults to `draft`. */
  status?: Product["status"]
  /** New product visibility. Defaults to the source's. */
  visibility?: Product["visibility"]
  /**
   * Copy availability slots/rules/start-times + departure price overrides.
   * Defaults to `true` (the operator UI clones a full working copy). The Max AI
   * agent passes `false` per #1493 — departures are date-specific, so the clone
   * starts with none and the agent adds fresh ones.
   */
  copyDepartures?: boolean
  /** Author of the initial `product_versions` snapshot. When omitted, no snapshot is taken. */
  userId?: string
  /** Dedup key; a retried request with the same key returns the first clone. */
  idempotencyKey?: string
}

export interface ClonedOption {
  id: string
  units: { id: string }[]
}

export type CloneProductOutcome =
  | { status: "ok"; product: Product; options: ClonedOption[]; reused: boolean }
  | { status: "not_found" }

function copyName(name: string) {
  return `${name} (Copy)`
}

/**
 * Reads a product's options + units back into the {@link ClonedOption} shape.
 * Used to reconstruct the result for an idempotent retry, so a re-sent clone
 * returns the same option/unit ids a fresh response would (the agent needs them
 * to continue authoring after the exact lost-response case idempotency covers).
 */
async function loadClonedOptions(
  tx: PostgresJsDatabase,
  productId: string,
): Promise<ClonedOption[]> {
  const optionRows = await tx
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(eq(productOptions.productId, productId))
  if (optionRows.length === 0) return []

  const unitRows = await tx
    .select({ id: optionUnits.id, optionId: optionUnits.optionId })
    .from(optionUnits)
    .where(
      inArray(
        optionUnits.optionId,
        optionRows.map((o) => o.id),
      ),
    )

  return optionRows.map((o) => ({
    id: o.id,
    units: unitRows.filter((u) => u.optionId === o.id).map((u) => ({ id: u.id })),
  }))
}

function newContext(
  tx: PostgresJsDatabase,
  sourceId: string,
  targetId: string,
  copyDepartures: boolean,
): CloneContext {
  return {
    tx,
    sourceId,
    targetId,
    copyDepartures,
    optionIdMap: new Map(),
    unitIdMap: new Map(),
    unitsByNewOption: new Map(),
    itineraryIdMap: new Map(),
    dayIdMap: new Map(),
    startTimeIdMap: new Map(),
    ruleIdMap: new Map(),
    slotIdMap: new Map(),
    optionPriceRuleIdMap: new Map(),
    optionUnitPriceRuleIdMap: new Map(),
    pricingCategoryIdMap: new Map(),
    productExtraIdMap: new Map(),
    optionExtraConfigIdMap: new Map(),
  }
}

/**
 * Deep-clone a product graph as a draft (#1493): the new product row, then its
 * content (options/units, pricing categories, itinerary, media, extras) and its
 * pricing/availability — copied with correct id remapping. Availability is
 * copied only when `copyDepartures`. MUST run inside the caller's transaction.
 */
async function cloneGraph(
  tx: PostgresJsDatabase,
  sourceId: string,
  opts: {
    name?: string
    status?: Product["status"]
    visibility?: Product["visibility"]
    copyDepartures: boolean
  },
): Promise<{ product: Product; options: ClonedOption[] } | null> {
  const [sourceProduct] = await tx.select().from(products).where(eq(products.id, sourceId))
  if (!sourceProduct) return null

  const [targetProduct] = await tx
    .insert(products)
    .values({
      ...withoutSystemColumns(sourceProduct),
      name: opts.name ?? copyName(sourceProduct.name),
      status: opts.status ?? "draft",
      ...(opts.visibility ? { visibility: opts.visibility } : {}),
      activated: false,
    })
    .returning()

  if (!targetProduct) {
    throw new Error("Failed to duplicate product")
  }

  const ctx = newContext(tx, sourceId, targetProduct.id, opts.copyDepartures)
  await copyProductContent(ctx)
  await copyPricingAndAvailability(ctx)

  const options: ClonedOption[] = [...ctx.optionIdMap.values()].map((id) => ({
    id,
    units: ctx.unitsByNewOption.get(id) ?? [],
  }))

  return { product: targetProduct, options }
}

/**
 * Deep-clone a product (#1493). Wraps {@link cloneGraph} with idempotency and an
 * optional `product_versions` snapshot. The operator UI calls this with no
 * overrides (full copy, `"{X} (Copy)"`, departures included); the agent passes
 * `name` + `copyDepartures: false` + an `Idempotency-Key`.
 */
export async function cloneProduct(
  db: PostgresJsDatabase,
  sourceProductId: string,
  options: CloneProductOptions = {},
): Promise<CloneProductOutcome> {
  const [exists] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, sourceProductId))
    .limit(1)
  if (!exists) return { status: "not_found" }

  const copyDepartures = options.copyDepartures ?? true
  const key = options.idempotencyKey

  const result = await db.transaction(async (tx) => {
    if (key) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
      const [prev] = await tx
        .select({ productId: productAuthoringRequests.productId })
        .from(productAuthoringRequests)
        .where(eq(productAuthoringRequests.idempotencyKey, key))
        .limit(1)
      if (prev) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, prev.productId))
          .limit(1)
        if (product) {
          return { product, options: await loadClonedOptions(tx, product.id), reused: true }
        }
      }
    }

    const cloned = await cloneGraph(tx, sourceProductId, {
      name: options.name,
      status: options.status,
      visibility: options.visibility,
      copyDepartures,
    })
    if (!cloned) return null

    if (options.userId) {
      await productsService.createVersion(tx, cloned.product.id, options.userId, {})
    }
    if (key) {
      await tx
        .insert(productAuthoringRequests)
        .values({ idempotencyKey: key, productId: cloned.product.id, operation: "duplicate" })
    }
    return { ...cloned, reused: false }
  })

  if (!result) return { status: "not_found" }
  return { status: "ok", ...result }
}
