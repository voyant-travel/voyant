/**
 * Catalog content routes for the operator template.
 *
 * Mounts the per-vertical sourced-content endpoints that templates
 * adopt as part of the catalog-sourced-content migration:
 *
 *   GET /v1/{admin,public}/products/:id/content
 *   GET /v1/{admin,public}/cruises/:id/content
 *   GET /v1/{admin,public}/hospitality/:id/content
 *
 * Each endpoint dispatches through the vertical's `getXxxContent`
 * service (cache-first, SWR refresh, synthesizer fallback). The
 * catalog `SourceAdapterRegistry` is resolved via the existing
 * `getBookingEngineRegistryFromContext` helper — same singleton the
 * booking-engine routes use.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import { createCruiseContentRoutes } from "@voyantjs/cruises/routes-content"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { getHospitalityContent } from "@voyantjs/hospitality/service-content"
import { createProductContentRoutes } from "@voyantjs/products/routes-content"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

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

  // ── Hospitality ──────────────────────────────────────────────
  // Hospitality doesn't ship a `routes-content.ts` factory yet, so
  // we wire a thin handler inline. Same shape as the products /
  // cruises factories — read the locale-resolved content,
  // synthesize / overlay applied, return the payload + resolution
  // metadata.
  hono.get("/v1/admin/hospitality/:id/content", handleHospitalityContent)
  hono.get("/v1/public/hospitality/:id/content", handleHospitalityContent)
}

async function handleHospitalityContent(c: Context): Promise<Response> {
  const entityId = c.req.param("id")
  if (!entityId) return c.json({ error: "id_required" }, 400)

  const db = (c.var as { db: AnyDrizzleDb }).db as PostgresJsDatabase
  const registry = getBookingEngineRegistryFromContext(c)
  const acceptHeader = c.req.header("accept-language") ?? ""
  const preferredLocales = acceptHeader
    .split(",")
    .map((s) => s.split(";")[0]?.trim())
    .filter((s): s is string => Boolean(s))

  const result = await getHospitalityContent(
    db,
    entityId,
    { preferredLocales: preferredLocales.length > 0 ? preferredLocales : ["en-GB"] },
    { registry },
  )

  if (!result) {
    return c.json(
      {
        error: "not_found",
        detail: `Hospitality property ${entityId} not found.`,
      },
      404,
    )
  }

  return c.json({
    data: {
      content: result.content,
      served_locale: result.resolution.served_locale,
      match_kind: result.resolution.match_kind,
      source: result.source,
      served_stale: result.served_stale,
      synthesized: result.synthesized,
      machine_translated: result.machine_translated,
    },
  })
}
