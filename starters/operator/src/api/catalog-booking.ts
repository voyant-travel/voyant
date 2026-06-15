/**
 * Catalog booking-engine routes for the operator starter.
 *
 * The booking-engine lifecycle (quote / book / drafts / holds) and order
 * management (orders list / get / cancel) now live in
 * `@voyant-travel/catalog/booking-engine` — this deployment supplies the
 * options and mounts them via `mountCatalogBookingRoutes`. The package mounts
 * on **two** surfaces:
 *
 *   /v1/admin/catalog/...   (staff actor — operator dashboard)
 *   /v1/public/catalog/...  (customer / partner / supplier — storefront,
 *                            partner portal, embedded widgets)
 *
 * Two handlers STAY here as a thin deployment extension because the packages
 * they read (`@voyant-travel/inventory`, `@voyant-travel/operations`) already
 * depend on `@voyant-travel/catalog` — hosting them in the package would
 * create an import cycle:
 *
 *   GET /v1/{admin,public}/catalog/slots             → availability slots
 *   GET /v1/admin/bookings/:id/catalog-snapshot      → frozen catalog snapshot
 *
 * Auth posture comes from the operator starter's `createApp` middleware
 * chain — `/v1/admin/...` requires staff, `/v1/public/...` accepts the
 * configured public actors. Per booking-journey-architecture §10 Phase B.
 */

import { mountCatalogBookingRoutes as mountPackageCatalogBookingRoutes } from "@voyant-travel/catalog/booking-engine"
import { readSourcedEntry } from "@voyant-travel/catalog/services/sourced-entry"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { getProductContent } from "@voyant-travel/inventory/service-content"
import { availabilitySlots } from "@voyant-travel/operations"
import { and, asc, eq, gte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

import {
  createOperatorCatalogBookingRoutesOptions,
  getCatalogBookingDb,
} from "./catalog-booking-runtime"
import { getBookingEngineRegistryFromContext } from "./lib/booking-engine-runtime"

function getDb(c: Context): AnyDrizzleDb {
  return getCatalogBookingDb(c)
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  // Booking-engine lifecycle + order management live in the catalog package;
  // this deployment only supplies the options + registry resolver.
  mountPackageCatalogBookingRoutes(hono, {
    booking: createOperatorCatalogBookingRoutesOptions(),
    resolveRegistry: getBookingEngineRegistryFromContext,
  })

  // ── Deployment-local extension (cross-package — stays here to avoid a
  //    catalog ↔ inventory/operations import cycle) ──────────────────────

  // List available departures / slots for a product. Drives the
  // storefront's departure-select on the product detail page —
  // customers pick from real available options, not a free-form
  // calendar (per booking-journey-architecture §10).
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.get(`${prefix}/slots`, handleListSlots)
  }

  // Admin-only — read the catalog snapshot tied to a booking.
  // Backs the BookingCatalogSourceCard on the booking detail page;
  // surfaces the frozen entity reference + pricing + (optionally) the
  // captured content payload so operators can see exactly what the
  // customer was quoted at booking time.
  hono.get("/v1/admin/bookings/:id/catalog-snapshot", handleGetBookingSnapshot)
}

// ─────────────────────────────────────────────────────────────────
// Handlers (deployment-local — cross-package)
// ─────────────────────────────────────────────────────────────────

async function handleListSlots(c: Context): Promise<Response> {
  const url = new URL(c.req.url)
  const entityModule = url.searchParams.get("entityModule")
  const entityId = url.searchParams.get("entityId")
  if (!entityModule || !entityId) {
    return c.json({ error: "entityModule and entityId are required" }, 400)
  }
  // Cruises + accommodations have vertical-specific scheduling
  // (sailings, rate plans) surfaced by the detail page directly off
  // their content payloads. This endpoint only serves products.
  if (entityModule !== "products") {
    return c.json({ rows: [] })
  }

  const db = getDb(c) as PostgresJsDatabase

  // Sourced products carry their schedule in the sourced-content
  // payload — the upstream's `getContent` is the source of truth, not
  // any owned `availability_slots` row. Owned products keep using the
  // owned table since `buildOwnedProductContent` doesn't project
  // availability_slots into ProductContent.departures.
  const sourcedEntry = await readSourcedEntry(db, "products", entityId)
  if (sourcedEntry) {
    const registry = getBookingEngineRegistryFromContext(c)
    const acceptHeader = c.req.header("accept-language") ?? ""
    const preferredLocales = acceptHeader
      .split(",")
      .map((s) => s.split(";")[0]?.trim())
      .filter((s): s is string => Boolean(s))
    const resolved = await getProductContent(
      db,
      entityId,
      { preferredLocales: preferredLocales.length > 0 ? preferredLocales : ["en-GB"] },
      { registry, forceFresh: true },
    )
    const today = new Date().toISOString().slice(0, 10)
    const rows = (resolved?.content.departures ?? [])
      .filter((d) => {
        if (d.status === "sold_out" || d.status === "closed") return false
        return d.starts_at.slice(0, 10) >= today
      })
      .slice(0, 60)
      .map((d) => ({
        id: d.id,
        dateLocal: d.starts_at.slice(0, 10),
        startsAt: d.starts_at,
        endsAt: d.ends_at ?? null,
        timezone: "UTC",
        status: d.status ?? "open",
        unlimited: d.capacity == null && d.remaining == null,
        remainingPax: d.remaining ?? null,
        initialPax: d.capacity ?? null,
        nights: null,
        days: null,
      }))
    return c.json({ rows })
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = await db
    .select({
      id: availabilitySlots.id,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      timezone: availabilitySlots.timezone,
      status: availabilitySlots.status,
      unlimited: availabilitySlots.unlimited,
      remainingPax: availabilitySlots.remainingPax,
      initialPax: availabilitySlots.initialPax,
      nights: availabilitySlots.nights,
      days: availabilitySlots.days,
    })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.productId, entityId),
        eq(availabilitySlots.status, "open"),
        gte(availabilitySlots.dateLocal, today),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(60)

  return c.json({ rows })
}

/**
 * GET /v1/admin/bookings/:id/catalog-snapshot
 *
 * Returns the `booking_catalog_snapshot` row for this booking — the
 * frozen view of what the customer actually purchased: which entity
 * (product / cruise / accommodations), which source (owned / Bokun / Mews),
 * the quoted pricing breakdown, and the captured content payload.
 *
 * The response is **enriched server-side** with operator-friendly
 * resolved fields so the admin UI doesn't have to chase ids:
 *   - `resolved.entity.title`       — human title from the sourced
 *     projection (`name`/`title`) or the owned product's `name`.
 *   - `resolved.entity.description` — short description when present.
 *   - `resolved.entity.supplierName` — supplier label when present.
 *   - `resolved.source.label`       — friendly source name.
 *
 * Used by the booking detail page's "Catalog source" card so
 * operators see "Demo · Reykjavík Northern Lights Hunt" instead of
 * `cdmi_01kqp28138f69btmp1n15yjj7r`. Returns 404 when no snapshot
 * exists (legacy bookings).
 */
async function handleGetBookingSnapshot(c: Context): Promise<Response> {
  const bookingId = c.req.param("id")
  if (!bookingId) return c.json({ error: "id is required" }, 400)
  const db = getDb(c) as PostgresJsDatabase

  const { bookingCatalogSnapshotTable } = await import("@voyant-travel/catalog")
  const [snapshot] = await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(eq(bookingCatalogSnapshotTable.booking_id, bookingId))
    .limit(1)

  if (!snapshot) {
    return c.json({ error: "snapshot_not_found" }, 404)
  }

  const resolved = await resolveSnapshotForAdmin(db, {
    entity_module: snapshot.entity_module,
    entity_id: snapshot.entity_id,
    source_kind: snapshot.source_kind,
    source_provider: snapshot.source_provider,
    frozen_payload: (snapshot.frozen_payload ?? {}) as Record<string, unknown>,
  })
  return c.json({ data: { ...snapshot, resolved } })
}

interface ResolvedSnapshotEntity {
  title: string | null
  description: string | null
  supplierName: string | null
  imageUrl: string | null
}

interface ResolvedSnapshotSource {
  label: string
  providerLabel: string | null
}

/**
 * Resolve admin-friendly labels for a booking_catalog_snapshot row.
 * Tries the sourced-entry projection first (covers demo, Bokun, etc.),
 * falls back to owned products. Returns null fields rather than
 * throwing when sources are missing — the admin UI treats nulls as
 * "fall back to id".
 */
async function resolveSnapshotForAdmin(
  db: PostgresJsDatabase,
  snapshot: {
    entity_module: string
    entity_id: string
    source_kind: string
    source_provider: string | null
    frozen_payload: Record<string, unknown>
  },
): Promise<{ entity: ResolvedSnapshotEntity; source: ResolvedSnapshotSource }> {
  const entity: ResolvedSnapshotEntity = {
    title: null,
    description: null,
    supplierName: null,
    imageUrl: null,
  }

  // Attempt 1: sourced_entries projection. Covers demo + every
  // upstream provider that registers via the sourced-entry write path.
  try {
    const { catalogSourcedEntriesTable } = await import("@voyant-travel/catalog")
    const [sourced] = await db
      .select({ projection: catalogSourcedEntriesTable.projection })
      .from(catalogSourcedEntriesTable)
      .where(
        and(
          eq(catalogSourcedEntriesTable.entity_module, snapshot.entity_module),
          eq(catalogSourcedEntriesTable.entity_id, snapshot.entity_id),
        ),
      )
      .limit(1)
    if (sourced?.projection) {
      const p = sourced.projection as Record<string, unknown>
      entity.title = pickString(p.name, p.title)
      entity.description = pickString(p.description, p.summary)
      entity.supplierName = pickString(p.supplierId, p.supplier_name, p.supplierName)
      entity.imageUrl = pickString(p.heroImageUrl, p.image_url, p.imageUrl)
    }
  } catch {
    // ignore, fall through
  }

  // Attempt 2: owned products row.
  if (!entity.title && snapshot.entity_module === "products") {
    try {
      const { productsService } = await import("@voyant-travel/inventory")
      const product = await productsService.getProductById(db, snapshot.entity_id)
      if (product) {
        entity.title = product.name
        entity.description = product.description
      }
    } catch {
      // ignore
    }
  }

  // Attempt 3: pull from the snapshot's frozen upstream payload as
  // last resort (sourced quotes capture the upstream object inline).
  if (!entity.title) {
    const upstream = (snapshot.frozen_payload?.quote as Record<string, unknown> | undefined)
      ?.upstream_payload as Record<string, unknown> | undefined
    if (upstream) {
      entity.title = pickString(upstream.name, upstream.title)
      entity.description = pickString(upstream.description, upstream.summary)
    }
  }

  const source: ResolvedSnapshotSource = {
    label: friendlySourceLabel(snapshot.source_kind),
    providerLabel: snapshot.source_provider,
  }

  return { entity, source }
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c
  }
  return null
}

/**
 * Map raw `source_kind` strings to the labels operators recognise.
 * "demo" → "Demo Catalog", "owned" → "Owned (this operator)", etc.
 * Anything we don't recognise comes back title-cased.
 */
function friendlySourceLabel(sourceKind: string): string {
  const map: Record<string, string> = {
    demo: "Demo Catalog",
    owned: "Owned (this operator)",
    bokun: "Bókun",
    mews: "Mews",
    fareharbor: "FareHarbor",
    rezdy: "Rezdy",
  }
  return map[sourceKind] ?? sourceKind.replace(/^./, (c) => c.toUpperCase())
}
