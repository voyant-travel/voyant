/**
 * Catalog content routes for the dmc template.
 *
 * Mirrors `templates/operator/src/api/catalog-content.ts` — mounts
 * the per-vertical sourced-content endpoint:
 *
 *   GET /v1/admin/products/:id/content
 *
 * The dmc template ships without any upstream adapters by default,
 * so this endpoint returns 404 for every product (no sourced-entry
 * rows exist). It's wired regardless so deployments adding a
 * Voyant Connect / TUI / bedbank adapter only need to register the
 * adapter — the route surface is already there.
 */

import { createProductContentRoutes } from "@voyantjs/products/routes-content"
import type { Hono } from "hono"

import { getBookingEngineRegistryFromContext } from "./lib/booking-engine-runtime"

export function mountCatalogContentRoutes(hono: Hono): void {
  const productContentRoutes = createProductContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    defaultAcceptMachineTranslated: false,
  })

  hono.route("/v1/admin/products", productContentRoutes)
}
