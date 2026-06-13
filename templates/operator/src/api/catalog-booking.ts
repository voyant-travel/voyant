/**
 * Catalog booking-engine routes for the operator template.
 *
 * Mounts the cross-vertical lifecycle from `@voyantjs/catalog/booking-engine`
 * on **two** surfaces:
 *
 *   /v1/admin/catalog/...   (staff actor — operator dashboard)
 *   /v1/public/catalog/...  (customer / partner / supplier — storefront,
 *                            partner portal, embedded widgets)
 *
 * Endpoints:
 *
 *   POST /v1/{admin,public}/catalog/quote          → quoteEntity
 *   POST /v1/{admin,public}/catalog/book           → bookEntity
 *   POST /v1/admin/catalog/orders/:id/cancel       → cancelEntity
 *   GET  /v1/admin/catalog/orders                  → listOrders
 *   GET  /v1/admin/catalog/orders/:id              → getOrderById
 *   PUT  /v1/{admin,public}/catalog/drafts/:id     → upsert booking draft
 *   GET  /v1/{admin,public}/catalog/drafts/:id     → read booking draft
 *   DELETE /v1/{admin,public}/catalog/drafts/:id   → delete booking draft
 *
 * The handlers parse minimal JSON bodies, delegate to the engine, and
 * translate `BookingEngineError` codes into appropriate HTTP statuses.
 *
 * Auth posture comes from the operator template's `createApp` middleware
 * chain — `/v1/admin/...` requires staff, `/v1/public/...` accepts the
 * configured public actors. Per booking-journey-architecture §10 Phase B.
 */

import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  BookingEngineError,
  cancelEntity,
  createCatalogBookingRoutes,
  getOrderById,
  listOrders,
  NO_ADAPTER_REGISTERED,
  NO_HANDLER_REGISTERED,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  RESERVE_FAILED,
} from "@voyantjs/catalog/booking-engine"
import { readSourcedEntry } from "@voyantjs/catalog/services/sourced-entry"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { getProductContent } from "@voyantjs/inventory/service-content"
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

interface CancelBody {
  bookingId?: string
  entityModule?: string
  entityId?: string
  reason?: string
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  const options = createOperatorCatalogBookingRoutesOptions()
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.route(prefix, createCatalogBookingRoutes(options))
    // List available departures / slots for a product. Drives the
    // storefront's departure-select on the product detail page —
    // customers pick from real available options, not a free-form
    // calendar (per booking-journey-architecture §10).
    hono.get(`${prefix}/slots`, handleListSlots)
  }

  // Admin-only — order management.
  hono.post("/v1/admin/catalog/orders/:id/cancel", handleCancel)
  hono.get("/v1/admin/catalog/orders", handleListOrders)
  hono.get("/v1/admin/catalog/orders/:id", handleGetOrder)

  // Admin-only — read the catalog snapshot tied to a booking.
  // Backs the BookingCatalogSourceCard on the booking detail page;
  // surfaces the frozen entity reference + pricing + (optionally) the
  // captured content payload so operators can see exactly what the
  // customer was quoted at booking time.
  hono.get("/v1/admin/bookings/:id/catalog-snapshot", handleGetBookingSnapshot)
}

// ─────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────

async function handleCancel(c: Context): Promise<Response> {
  let body: CancelBody
  try {
    body = await c.req.json<CancelBody>()
  } catch {
    body = {}
  }

  if (!body.bookingId || !body.entityModule || !body.entityId) {
    return c.json({ error: "bookingId, entityModule, and entityId are required in the body" }, 400)
  }

  const db = getDb(c)
  const registry = getBookingEngineRegistryFromContext(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

  try {
    const result = await cancelEntity(
      db,
      { registry },
      {
        bookingId: body.bookingId,
        entityModule: body.entityModule,
        entityId: body.entityId,
        reason: body.reason,
        adapterContext: { connection_id: "engine", correlation_id: correlationId },
      },
    )
    return c.json(result)
  } catch (err) {
    return errorResponse(c, err)
  }
}

async function handleListOrders(c: Context): Promise<Response> {
  const db = getDb(c)
  const url = new URL(c.req.url)
  const bookingId = url.searchParams.get("bookingId") ?? undefined
  const entityModule = url.searchParams.get("entityModule") ?? undefined
  const sourceKindsParam = url.searchParams.get("sourceKinds")
  const sourceKinds = sourceKindsParam ? sourceKindsParam.split(",") : undefined
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10)

  const result = await listOrders(db, {
    bookingId,
    entityModule,
    sourceKinds,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  })
  return c.json({ rows: result.rows })
}

async function handleGetOrder(c: Context): Promise<Response> {
  const db = getDb(c)
  const id = c.req.param("id")
  if (!id) return c.json({ error: "id is required" }, 400)
  const row = await getOrderById(db, id)
  if (!row) return c.json({ error: "order not found" }, 404)
  return c.json(row)
}

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

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof BookingEngineError) {
    const status = statusForCode(err.code)
    return c.json({ error: err.message, code: err.code, context: err.context }, status as never)
  }
  const message = err instanceof Error ? err.message : String(err)
  return c.json({ error: message }, 500)
}

function statusForCode(code: string): number {
  switch (code) {
    case NO_ADAPTER_REGISTERED:
    case NO_HANDLER_REGISTERED:
      return 503
    case QUOTE_NOT_FOUND:
    case ORDER_NOT_FOUND:
      return 404
    case QUOTE_EXPIRED:
    case QUOTE_MISMATCH:
    case ORDER_ALREADY_CANCELLED:
      return 409
    case RESERVE_FAILED:
      return 502
    default:
      return 500
  }
}

function cryptoRandom(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
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

  const { bookingCatalogSnapshotTable } = await import("@voyantjs/catalog")
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
    const { catalogSourcedEntriesTable } = await import("@voyantjs/catalog")
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
      const { productsService } = await import("@voyantjs/inventory")
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
