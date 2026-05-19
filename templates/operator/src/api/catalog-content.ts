/**
 * Catalog content routes for the operator template.
 *
 * Mounts the per-vertical sourced-content endpoints that templates
 * adopt as part of the catalog-sourced-content migration:
 *
 *   GET /v1/{admin,public}/products/:id/content
 *   GET /v1/{admin,public}/cruises/:id/content
 *   GET /v1/{admin,public}/accommodations/:id/content
 *
 * Each endpoint dispatches through the vertical's `getXxxContent`
 * service (cache-first, SWR refresh, synthesizer fallback). The
 * catalog `SourceAdapterRegistry` is resolved via the existing
 * `getBookingEngineRegistryFromContext` helper — same singleton the
 * booking-engine routes use.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import { createAccommodationContentRoutes } from "@voyantjs/accommodations/routes-content"
import { createCruiseContentRoutes } from "@voyantjs/cruises/routes-content"
import { createProductContentRoutes } from "@voyantjs/products/routes-content"
import type { Hono } from "hono"

import { getBookingEngineRegistryFromContext } from "./lib/booking-engine-runtime"

export function mountCatalogContentRoutes(hono: Hono): void {
  // ── Products ─────────────────────────────────────────────────
  const adminProductContentRoutes = createProductContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    // Operator-side default: false — ops sees authored content from
    // upstream before deciding to override.
    defaultAcceptMachineTranslated: false,
  })

  const publicProductContentRoutes = createProductContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    // Storefront default: true — the customer sees the best content
    // available, including machine-translated when no human-authored
    // version exists for their locale.
    defaultAcceptMachineTranslated: true,
  })

  hono.route("/v1/admin/products", adminProductContentRoutes)
  hono.route("/v1/public/products", publicProductContentRoutes)

  // ── Cruises ──────────────────────────────────────────────────
  const adminCruiseContentRoutes = createCruiseContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    defaultAcceptMachineTranslated: false,
    allowOwnedKeys: true,
  })

  const publicCruiseContentRoutes = createCruiseContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    defaultAcceptMachineTranslated: true,
    allowOwnedKeys: true,
  })

  hono.route("/v1/admin/cruises", adminCruiseContentRoutes)
  hono.route("/v1/public/cruises", publicCruiseContentRoutes)

  // ── Accommodations ─────────────────────────────────────────────
  const adminAccommodationContentRoutes = createAccommodationContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    defaultAcceptMachineTranslated: false,
  })

  const publicAccommodationContentRoutes = createAccommodationContentRoutes({
    resolveRegistry: (c) => getBookingEngineRegistryFromContext(c),
    defaultAcceptMachineTranslated: true,
  })

  hono.route("/v1/admin/accommodations", adminAccommodationContentRoutes)
  hono.route("/v1/public/accommodations", publicAccommodationContentRoutes)
}
