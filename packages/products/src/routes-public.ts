import { parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"

import { publicProductsService } from "./service-public.js"
import {
  publicCatalogCategoryListQuerySchema,
  publicCatalogDestinationListQuerySchema,
  publicCatalogProductListQuerySchema,
  publicCatalogProductLookupBySlugQuerySchema,
  publicCatalogTagListQuerySchema,
} from "./validation-public.js"
import { booleanQueryParam } from "./validation-shared.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

/**
 * Shared edge/CDN policy for the public catalog reads. These endpoints are
 * not personalized (they never read the authenticated identity), so short
 * shared caching keeps storefront list traffic off Worker isolates (#1686).
 * Applied per-handler on successful responses only — a framework-level
 * cache middleware lives in `@voyantjs/hono` and supersedes this later.
 */
const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function setPublicCacheHeaders(c: Context) {
  c.header("Cache-Control", PUBLIC_CACHE_CONTROL)
}

/**
 * Pagination guard for public list endpoints: clamps out-of-range or
 * malformed `limit` values to `[1, maxLimit]` instead of rejecting the
 * request, so no public list can run unbounded (#1686).
 */
function clampedLimitParam(defaultLimit: number, maxLimit: number) {
  return z.coerce
    .number()
    .int()
    .default(defaultLimit)
    .catch(defaultLimit)
    .transform((value) => Math.min(Math.max(value, 1), maxLimit))
}

const PRODUCT_LIST_DEFAULT_LIMIT = 20
const PUBLIC_LIST_MAX_LIMIT = 100

const trimmedProductListQuerySchema = publicCatalogProductListQuerySchema.extend({
  limit: clampedLimitParam(PRODUCT_LIST_DEFAULT_LIMIT, PUBLIC_LIST_MAX_LIMIT),
  /**
   * The list payload excludes heavy richtext content (`inclusionsHtml`,
   * `exclusionsHtml`, `termsHtml`, full-length `description`) by default.
   * `?includeContent=true` opts back into the full content shape.
   */
  includeContent: booleanQueryParam.optional(),
})

const clampedCategoryListQuerySchema = publicCatalogCategoryListQuerySchema.extend({
  limit: clampedLimitParam(PUBLIC_LIST_MAX_LIMIT, PUBLIC_LIST_MAX_LIMIT),
})

const clampedTagListQuerySchema = publicCatalogTagListQuerySchema.extend({
  limit: clampedLimitParam(PUBLIC_LIST_MAX_LIMIT, PUBLIC_LIST_MAX_LIMIT),
})

const clampedDestinationListQuerySchema = publicCatalogDestinationListQuerySchema.extend({
  limit: clampedLimitParam(PUBLIC_LIST_MAX_LIMIT, PUBLIC_LIST_MAX_LIMIT),
})

export const publicProductRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = await parseQuery(c, trimmedProductListQuerySchema)
    const result = await publicProductsService.listCatalogProducts(c.get("db"), query)
    setPublicCacheHeaders(c)
    return c.json(result)
  })
  .get("/slug/:slug", async (c) => {
    const query = await parseQuery(c, publicCatalogProductLookupBySlugQuerySchema)
    const row = await publicProductsService.getCatalogProductBySlug(
      c.get("db"),
      c.req.param("slug"),
      query,
    )

    if (!row) {
      return c.json({ error: "Catalog product not found" }, 404)
    }

    setPublicCacheHeaders(c)
    return c.json({ data: row })
  })
  .get("/categories", async (c) => {
    const query = await parseQuery(c, clampedCategoryListQuerySchema)
    const result = await publicProductsService.listCatalogCategories(c.get("db"), query)
    setPublicCacheHeaders(c)
    return c.json(result)
  })
  .get("/tags", async (c) => {
    const query = await parseQuery(c, clampedTagListQuerySchema)
    const result = await publicProductsService.listCatalogTags(c.get("db"), query)
    setPublicCacheHeaders(c)
    return c.json(result)
  })
  .get("/destinations", async (c) => {
    const query = await parseQuery(c, clampedDestinationListQuerySchema)
    const result = await publicProductsService.listCatalogDestinations(c.get("db"), query)
    setPublicCacheHeaders(c)
    return c.json(result)
  })
  .get("/:id", async (c) => {
    const query = await parseQuery(c, publicCatalogProductLookupBySlugQuerySchema)
    const row = await publicProductsService.getCatalogProductById(
      c.get("db"),
      c.req.param("id"),
      query,
    )

    if (!row) {
      return c.json({ error: "Catalog product not found" }, 404)
    }

    setPublicCacheHeaders(c)
    return c.json({ data: row })
  })
  .get("/:id/brochure", async (c) => {
    const query = await parseQuery(c, publicCatalogProductLookupBySlugQuerySchema)
    const row = await publicProductsService.getCatalogProductBrochure(
      c.get("db"),
      c.req.param("id"),
      query,
    )

    if (!row) {
      return c.json({ error: "Catalog product brochure not found" }, 404)
    }

    setPublicCacheHeaders(c)
    return c.json({ data: row })
  })

export type PublicProductRoutes = typeof publicProductRoutes
