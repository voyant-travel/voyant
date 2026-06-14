import type { KVStore } from "@voyant-travel/utils/cache"

/**
 * KV-backed read model for the public product detail surface (RFC
 * voyant#1687 Phase 2.2 — the "document plane"; browse/search is the
 * Typesense "query plane" and already serves cards without Postgres).
 *
 * Model: read-through with exact invalidation. The first read of a
 * (product, variant) materializes the render-ready document into KV;
 * repeat reads cost one KV get and ZERO Postgres queries. Admin
 * mutations to a product delete its documents (see
 * `productsReadModelInvalidation` in routes.ts), and a generous TTL
 * bounds staleness for anything invalidation misses.
 *
 * Slug lookups resolve through a short-lived slug→id mapping so the
 * id-keyed document is shared between `/:id` and `/slug/:slug`. The
 * mapping is deliberately NOT invalidated on mutation: it's cheap to
 * refill, and its short TTL bounds the only affected case (a renamed
 * slug serving the old document) to a few minutes.
 */

const RM_PREFIX = "rm:v1:product"
/** Product documents live long — exact invalidation keeps them fresh. */
const PRODUCT_DOC_TTL_SECONDS = 24 * 60 * 60
/** Slug→id mappings are refill-cheap; the TTL bounds rename staleness. */
const SLUG_MAP_TTL_SECONDS = 5 * 60

export function productDocKey(productId: string, variant: string): string {
  return `${RM_PREFIX}:${productId}:${variant}`
}

export function productSlugMapKey(slug: string): string {
  return `rm:v1:product-slug:${slug}`
}

/** Stable variant id from the detail query (currently just the locale). */
export function productDocVariant(query: { languageTag?: string | null }): string {
  return query.languageTag ? `lang=${query.languageTag}` : "default"
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
      await kv.put(key, JSON.stringify(data), { expirationTtl: PRODUCT_DOC_TTL_SECONDS })
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
  resolve: () => Promise<string | null>,
): Promise<string | null> {
  if (kv) {
    try {
      const hit = await kv.get<string>(productSlugMapKey(slug), { type: "text" })
      if (hit) return hit
    } catch {
      // fall through
    }
  }
  const id = await resolve()
  if (id && kv) {
    try {
      await kv.put(productSlugMapKey(slug), id, { expirationTtl: SLUG_MAP_TTL_SECONDS })
    } catch {
      // best-effort
    }
  }
  return id
}

/**
 * Drop every cached document variant for a product. Uses KV `list` by
 * prefix (optional on the KVStore contract — silently a no-op without
 * it, where the TTL becomes the only freshness bound).
 */
export async function invalidateProductReadModel(kv: KVStore, productId: string): Promise<void> {
  if (!kv.list) return
  try {
    const { keys } = await kv.list({ prefix: `${RM_PREFIX}:${productId}:` })
    await Promise.all(keys.map((key) => kv.delete(key.name)))
  } catch {
    // best-effort — the document TTL bounds staleness if this fails
  }
}
