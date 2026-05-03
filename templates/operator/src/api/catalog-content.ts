/**
 * Catalog content routes for the operator template.
 *
 * Mounts the per-vertical sourced-content endpoints that templates
 * adopt as part of the catalog-sourced-content migration:
 *
 *   GET /v1/admin/products/:id/content
 *
 * Each endpoint dispatches through the vertical's `getXxxContent`
 * service (cache-first, SWR refresh, synthesizer fallback). The
 * catalog `SourceAdapterRegistry` is resolved via the existing
 * `getBookingEngineRegistryFromContext` helper — same singleton the
 * booking-engine routes use.
 *
 * Cruises content endpoint isn't mounted here because the operator
 * template doesn't include `cruisesHonoModule`. When it does (or for
 * deployments that do), add a parallel `createCruiseContentRoutes`
 * mount under `/v1/admin/cruises`.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import { createProductContentRoutes } from "@voyantjs/products/routes-content"
import type { Hono } from "hono"

import { getBookingEngineRegistryFromContext } from "./lib/booking-engine-runtime"

export function mountCatalogContentRoutes(hono: Hono): void {
  const productContentRoutes = createProductContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    // Operator-side default: false — ops sees authored content from
    // upstream before deciding to override. Storefront templates
    // override this to true (default).
    defaultAcceptMachineTranslated: false,
  })

  // Mount under the products admin prefix. The /:id/content path
  // doesn't conflict with productsHonoModule's existing /:id route —
  // Hono's matcher prefers the longer path. When productsHonoModule
  // ever adds a /:id/something route, ordering matters; this mount
  // runs after createApp finishes module registration so it lands at
  // the same prefix without overlap.
  hono.route("/v1/admin/products", productContentRoutes)
}
