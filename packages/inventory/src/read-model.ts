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
}

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

/** Stable variant id from the detail query (currently just the locale). */
export function productDocVariant(query: { languageTag?: string | null }): string {
  return query.languageTag ? `lang=${query.languageTag}` : "default"
}

export function productDocQueryFromVariant(variant: string): ProductReadModelQuery {
  return variant.startsWith("lang=") ? { languageTag: variant.slice("lang=".length) } : {}
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
