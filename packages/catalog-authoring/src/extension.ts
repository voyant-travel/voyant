import type { Extension } from "@voyantjs/core"
import type { HonoExtension } from "@voyantjs/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

/**
 * Catalog authoring rides on the `products` admin prefix as a HonoExtension,
 * so its routes land at `/v1/admin/products/...` without `packages/products`
 * depending on this package (which would cycle, since this package depends on
 * both products and pricing). Same mechanism as `bookingsSupplierExtension`.
 *
 *   POST /v1/admin/products/{id}/duplicate   — clone   (#1493)
 *   POST /v1/admin/products/compose          — compose (#1495)
 *
 * Phase 0: routes are mounted but not yet implemented. The builder, clone,
 * validator and compose land in later phases.
 */

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const catalogAuthoringRoutes = new Hono<Env>()
  .post("/compose", (c) => c.json({ error: "not_implemented" }, 501))
  .post("/:id/duplicate", (c) => c.json({ error: "not_implemented" }, 501))

const catalogAuthoringExtensionDef: Extension = {
  name: "catalog-authoring",
  module: "products",
}

export const catalogAuthoringExtension: HonoExtension = {
  extension: catalogAuthoringExtensionDef,
  adminRoutes: catalogAuthoringRoutes,
}
