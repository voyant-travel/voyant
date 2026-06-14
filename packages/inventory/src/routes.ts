import type { KVStore } from "@voyant-travel/utils/cache"
import { Hono } from "hono"

import { invalidateProductReadModel } from "./read-model.js"
import type { Env } from "./route-env.js"
import { productAssociationRoutes } from "./routes-associations.js"
import { productCatalogRoutes } from "./routes-catalog.js"
import { productConfigurationRoutes } from "./routes-configuration.js"
import { productCoreRoutes } from "./routes-core.js"
import { productItineraryRoutes } from "./routes-itinerary.js"
import { productMaintenanceRoutes } from "./routes-maintenance.js"
import { productMediaRoutes } from "./routes-media.js"
import { productMerchandisingRoutes } from "./routes-merchandising.js"
import { productOptionRoutes } from "./routes-options.js"
import { productTranslationRoutes } from "./routes-translations.js"

export type { Env } from "./route-env.js"

/** Matches the product TypeID anywhere in an admin mutation path. */
const PRODUCT_ID_IN_PATH = /(prod_[a-z0-9]+)/

/**
 * Exact read-model invalidation for the public product-detail documents
 * (see read-model.ts): after any successful admin mutation whose path
 * names a product, that product's cached KV documents are dropped —
 * regardless of which route group (core, media, translations, options,
 * itinerary, …) performed the write. Runs after the response via
 * `waitUntil` when available; deployments without the CACHE binding (or
 * outside Workers) skip it and rely on the document TTL.
 */
export function readModelInvalidation() {
  return async (
    c: {
      req: { method: string; path: string }
      res?: Response
      env?: { CACHE?: KVStore }
      executionCtx?: unknown
    },
    next: () => Promise<void>,
  ) => {
    await next()
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") return
    if (!c.res || c.res.status >= 400) return
    const kv = c.env?.CACHE
    if (!kv) return
    const match = PRODUCT_ID_IN_PATH.exec(c.req.path)
    if (!match?.[1]) return
    const pending = invalidateProductReadModel(kv, match[1])
    try {
      const ctx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(pending)
        return
      }
    } catch {
      // Hono throws on executionCtx access outside Workers
    }
    await pending
  }
}

// Product route groups stay split by domain area; mount at root to preserve public paths.
export const productRoutes = new Hono<Env>()
  // biome-ignore lint/suspicious/noExplicitAny: the structural middleware shape doesn't need the full Env generics -- owner: inventory; existing suppression is intentional pending typed cleanup.
  .use("*", readModelInvalidation() as any)
  .route("/", productConfigurationRoutes)
  .route("/", productMerchandisingRoutes)
  .route("/", productOptionRoutes)
  .route("/", productTranslationRoutes)
  .route("/", productCatalogRoutes)
  .route("/", productMediaRoutes)
  .route("/", productItineraryRoutes)
  .route("/", productAssociationRoutes)
  .route("/", productMaintenanceRoutes)
  .route("/", productCoreRoutes)

export type ProductRoutes = typeof productRoutes
