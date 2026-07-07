import type { KVStore } from "@voyant-travel/utils/cache"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { publicProductsService } from "./service-public.js"

/**
 * KV-backed read model for the public product detail surface (RFC
 * voyant#1687 Phase 2.2 — the "document plane"; browse/search is the
 * Typesense "query plane" and already serves cards without Postgres).
 *
 * Model: read-through with exact invalidation. The first read of a
 * (product, variant) materializes the render-ready document into KV;
 * repeat reads cost one KV get and ZERO Postgres queries. Admin
 * mutations to a product recompute or delete its documents (see
 * `readModelInvalidation` in routes.ts), and a generous TTL bounds
 * staleness for anything invalidation misses.
 *
 * Slug lookups resolve through a short-lived slug→product+locale mapping
 * so the id-keyed document is shared between `/:id` and `/slug/:slug`. The
 * mapping is deliberately NOT invalidated on mutation: it's cheap to
 * refill, and its short TTL bounds the only affected case (a renamed
 * slug serving the old document) to a few minutes.
 */

const RM_PREFIX = "rm:v1:product"
/** Product documents live long — exact invalidation keeps them fresh. */
const PRODUCT_DOC_TTL_SECONDS = 24 * 60 * 60
/** Slug→id mappings are refill-cheap; the TTL bounds rename staleness. */
const SLUG_MAP_TTL_SECONDS = 5 * 60

export interface ProductReadModelQuery {
  languageTag?: string | null
  /**
   * Fold the product's default itinerary (days + day-services, localized)
   * into the document. Opt-in so callers that don't render the day-by-day
   * plan don't pay the join (issue voyant#2910). Encoded in the variant so
   * itinerary and non-itinerary documents cache — and warm — independently.
   */
  includeItinerary?: boolean
}

/** Variant suffix marking a document that carries the folded itinerary. */
const ITINERARY_VARIANT_SUFFIX = "+itinerary"

export interface ProductReadModelVariant {
  variant: string
  query?: ProductReadModelQuery
}

export type ProductReadModelVariantInput = string | ProductReadModelVariant

export interface WarmProductReadModelInput {
  db: PostgresJsDatabase
  kv: KVStore
  productId: string
  variants?: ProductReadModelVariantInput[]
}

export interface WarmProductReadModelResult {
  warmed: string[]
  missing: string[]
}

export function productDocKey(productId: string, variant: string): string {
  return `${RM_PREFIX}:${productId}:${variant}`
}

export function productSlugMapKey(slug: string, variant: string): string {
  return `rm:v1:product-slug:${variant}:${slug}`
}

/** Stable variant id from the detail query (locale + itinerary inclusion). */
export function productDocVariant(query: ProductReadModelQuery): string {
  const base = query.languageTag ? `lang=${query.languageTag}` : "default"
  return query.includeItinerary ? `${base}${ITINERARY_VARIANT_SUFFIX}` : base
}

export function productDocQueryFromVariant(variant: string): ProductReadModelQuery {
  const includeItinerary = variant.endsWith(ITINERARY_VARIANT_SUFFIX)
  const rest = includeItinerary
    ? variant.slice(0, variant.length - ITINERARY_VARIANT_SUFFIX.length)
    : variant
  const query: ProductReadModelQuery = rest.startsWith("lang=")
    ? { languageTag: rest.slice("lang=".length) }
    : {}
  if (includeItinerary) query.includeItinerary = true
  return query
}

export async function buildProductReadModelDoc(
  db: PostgresJsDatabase,
  productId: string,
  query: ProductReadModelQuery = {},
) {
  return publicProductsService.getCatalogProductById(db, productId, query)
}

export interface ProductSlugResolution {
  productId: string
  languageTag: string | null
}

/**
 * Read-through document fetch. `null` compute results (missing/inactive
 * product) are never cached — a 404 must not mask a product that
 * activates a second later. Cache failures degrade to the live path.
 */
export async function readThroughProductDoc<T>(
  kv: KVStore | undefined,
  key: string,
  compute: () => Promise<T | null>,
): Promise<{ data: T | null; fromReadModel: boolean }> {
  if (kv) {
    try {
      const hit = await kv.get<T>(key, { type: "json" })
      if (hit !== null && hit !== undefined) return { data: hit, fromReadModel: true }
    } catch {
      // fall through to live compute
    }
  }
  const data = await compute()
  if (data !== null && kv) {
    try {
      await putProductDoc(kv, key, data)
    } catch {
      // best-effort materialization
    }
  }
  return { data, fromReadModel: false }
}

/** Resolve a slug to a product id through the KV mapping. */
export async function readThroughSlugMapping(
  kv: KVStore | undefined,
  slug: string,
  variant: string,
  resolve: () => Promise<ProductSlugResolution | null>,
): Promise<ProductSlugResolution | null> {
  const key = productSlugMapKey(slug, variant)
  if (kv) {
    try {
      const hit = await kv.get<ProductSlugResolution>(key, { type: "json" })
      if (hit) return hit
    } catch {
      // fall through
    }
  }
  const resolution = await resolve()
  if (resolution && kv) {
    try {
      await kv.put(key, JSON.stringify(resolution), { expirationTtl: SLUG_MAP_TTL_SECONDS })
    } catch {
      // best-effort
    }
  }
  return resolution
}

/**
 * Drop every cached document variant for a product. Uses KV `list` by
 * prefix (optional on the KVStore contract — silently a no-op without
 * it, where the TTL becomes the only freshness bound).
 */
export async function invalidateProductReadModel(kv: KVStore, productId: string): Promise<void> {
  const keys = await listProductDocKeys(kv, productId)
  if (!keys) return
  await deleteProductDocKeys(kv, keys)
}

export async function warmProductReadModel(
  input: WarmProductReadModelInput,
): Promise<WarmProductReadModelResult> {
  const explicitVariants = input.variants?.map(normalizeVariantInput)
  const existingVariants = explicitVariants
    ? null
    : await listProductDocVariants(input.kv, input.productId)
  const variants =
    explicitVariants && explicitVariants.length > 0
      ? explicitVariants
      : existingVariants && existingVariants.length > 0
        ? existingVariants.map((variant) => ({
            variant,
            query: productDocQueryFromVariant(variant),
          }))
        : [{ variant: "default", query: {} }]

  const warmed: string[] = []
  const missing: string[] = []

  for (const { variant, query } of variants) {
    const key = productDocKey(input.productId, variant)
    await safeDeleteProductDoc(input.kv, key)
    const data = await buildProductReadModelDoc(input.db, input.productId, query)
    if (data === null) {
      missing.push(variant)
      continue
    }
    try {
      await putProductDoc(input.kv, key, data)
      warmed.push(variant)
    } catch {
      // best-effort materialization; the next read can still recompute
    }
  }

  return { warmed, missing }
}

/**
 * The slice of a request context read-model invalidation needs: the KV
 * binding, an optional runtime `waitUntil` for background scheduling, and
 * `db` for the recompute path.
 */
export interface ReadModelInvalidationContext {
  // `unknown` so a Hono `Context` whose `Bindings` don't declare `CACHE` (the
  // admin route groups) is still assignable; the binding is narrowed at use.
  env?: unknown
  waitUntil?: (p: Promise<unknown>) => void
  executionCtx?: unknown
  get?: (key: "db") => PostgresJsDatabase
}

function buildReadModelInvalidationTask(
  c: Pick<ReadModelInvalidationContext, "get">,
  kv: KVStore,
  productId: string,
  mode: "delete" | "recompute",
): Promise<unknown> {
  if (mode === "recompute" && typeof c.get === "function") {
    try {
      return warmProductReadModel({ db: c.get("db"), kv, productId }).catch(() =>
        invalidateProductReadModel(kv, productId),
      )
    } catch {
      // fall through to delete-only invalidation
    }
  }
  return invalidateProductReadModel(kv, productId)
}

/**
 * Schedule read-model invalidation/recompute for a product whose id the caller
 * already knows. Used both by the path-matching admin middleware and directly
 * by write routes whose path is keyed on a child resource id (e.g. an itinerary
 * id) rather than the product id, so the middleware's path regex can't see the
 * product (issue voyant#2910). Runs in the background via `waitUntil` when
 * available; otherwise returns the pending promise for the caller to await. A
 * no-op (returns `undefined`) when the CACHE binding is absent.
 */
export function scheduleReadModelInvalidation(
  c: ReadModelInvalidationContext,
  productId: string,
  mode: "delete" | "recompute" = "recompute",
): Promise<unknown> | undefined {
  const kv = (c.env as { CACHE?: KVStore } | undefined)?.CACHE
  if (!kv) return undefined
  const pending = buildReadModelInvalidationTask(c, kv, productId, mode)
  if (typeof c.waitUntil === "function") {
    c.waitUntil(pending)
    return undefined
  }
  try {
    const ctx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(pending)
      return undefined
    }
  } catch {
    // Hono throws on executionCtx access outside Workers
  }
  return pending
}

async function putProductDoc<T>(kv: KVStore, key: string, data: T) {
  await kv.put(key, JSON.stringify(data), { expirationTtl: PRODUCT_DOC_TTL_SECONDS })
}

async function listProductDocKeys(kv: KVStore, productId: string): Promise<string[] | null> {
  if (!kv.list) return null
  try {
    const { keys } = await kv.list({ prefix: `${RM_PREFIX}:${productId}:` })
    return keys.map((key) => key.name)
  } catch {
    // best-effort — the document TTL bounds staleness if this fails
    return null
  }
}

async function listProductDocVariants(kv: KVStore, productId: string): Promise<string[] | null> {
  const keys = await listProductDocKeys(kv, productId)
  if (!keys) return null
  const prefix = `${RM_PREFIX}:${productId}:`
  return keys.map((key) => key.slice(prefix.length)).filter(Boolean)
}

async function deleteProductDocKeys(kv: KVStore, keys: string[]) {
  await Promise.all(keys.map((key) => safeDeleteProductDoc(kv, key)))
}

async function safeDeleteProductDoc(kv: KVStore, key: string) {
  try {
    await kv.delete(key)
  } catch {
    // best-effort — the document TTL bounds staleness if this fails
  }
}

function normalizeVariantInput(input: ProductReadModelVariantInput): {
  variant: string
  query: ProductReadModelQuery
} {
  if (typeof input === "string") {
    return { variant: input, query: productDocQueryFromVariant(input) }
  }
  return { variant: input.variant, query: input.query ?? productDocQueryFromVariant(input.variant) }
}
