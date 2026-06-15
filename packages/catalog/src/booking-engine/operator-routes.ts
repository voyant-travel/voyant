/**
 * Catalog booking-engine route module — the full admin + public booking
 * surface, owned by `@voyant-travel/catalog`.
 *
 * A deployment composes this and supplies two structural options:
 *   - `booking` — the `CatalogBookingRoutesOptions` (db / registries /
 *     hold-ttl / promotions / tax hooks) it already builds today, and
 *   - `resolveRegistry(c)` — pulls the process-local `SourceAdapterRegistry`
 *     off the request context (cancel needs it to dispatch to adapters).
 *
 * The module mounts the shared lifecycle from `./routes.js` on **two**
 * surfaces and adds the admin-only order-management endpoints:
 *
 *   POST   /v1/{admin,public}/catalog/quote          → quoteEntity
 *   POST   /v1/{admin,public}/catalog/book           → bookEntity
 *   PUT    /v1/{admin,public}/catalog/drafts/:id      → upsert booking draft
 *   GET    /v1/{admin,public}/catalog/drafts/:id      → read booking draft
 *   DELETE /v1/{admin,public}/catalog/drafts/:id      → delete booking draft
 *   POST   /v1/{admin,public}/catalog/holds/place     → place hold
 *   POST   /v1/{admin,public}/catalog/holds/release   → release hold
 *   GET    /v1/admin/catalog/orders                   → listOrders
 *   GET    /v1/admin/catalog/orders/:id               → getOrderById
 *   POST   /v1/admin/catalog/orders/:id/cancel        → cancelEntity
 *
 * Auth posture comes from the deployment's `createApp` middleware chain —
 * `/v1/admin/...` requires staff, `/v1/public/...` accepts the configured
 * public actors. Per booking-journey-architecture §10 Phase B.
 *
 * The catalog-snapshot (`/v1/admin/bookings/:id/catalog-snapshot`) and slots
 * (`/v1/{admin,public}/catalog/slots`) handlers are intentionally NOT here:
 * they read `@voyant-travel/inventory` / `@voyant-travel/operations`, both of
 * which already depend on `@voyant-travel/catalog`. Hosting them here would
 * create an import cycle, so they stay in the deployment as a thin extension.
 */

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { type Context, Hono } from "hono"

import { cancelEntity } from "./cancel.js"
import {
  BookingEngineError,
  NO_ADAPTER_REGISTERED,
  NO_HANDLER_REGISTERED,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  RESERVE_FAILED,
} from "./errors.js"
import { getOrderById, listOrders } from "./orders.js"
import type { SourceAdapterRegistry } from "./registry.js"
import { type CatalogBookingRoutesOptions, createCatalogBookingRoutes } from "./routes.js"

/**
 * Deployment-supplied options for the catalog booking-engine route module.
 * Structural only — no deployment imports, no platform bindings.
 */
export interface CatalogBookingRouteModuleOptions {
  /**
   * The booking-engine lifecycle options (db, source/owned registries,
   * hold-ttl, promotions, tax transforms). The deployment already builds
   * these for `createCatalogBookingRoutes`.
   */
  booking: CatalogBookingRoutesOptions
  /**
   * Resolve the process-local source-adapter registry for a request. Used by
   * the order-cancel handler to dispatch to the registered adapter.
   */
  resolveRegistry(c: Context): SourceAdapterRegistry
}

interface CancelBody {
  bookingId?: string
  entityModule?: string
  entityId?: string
  reason?: string
}

function getDb(options: CatalogBookingRouteModuleOptions, c: Context): AnyDrizzleDb {
  return options.booking.resolveDb(c)
}

/**
 * Admin-only order-management routes (relative paths; mount at
 * `/v1/admin/catalog`). Surfaces snapshot rows cross-vertically and routes
 * cancels back through the registered source adapter.
 */
export function createCatalogBookingOrdersRoutes(options: CatalogBookingRouteModuleOptions): Hono {
  const hono = new Hono()

  hono.get("/orders", async (c) => handleListOrders(c, options))
  hono.get("/orders/:id", async (c) => handleGetOrder(c, options))
  hono.post("/orders/:id/cancel", async (c) => handleCancel(c, options))

  return hono
}

/**
 * Mount the full catalog booking-engine surface (both surfaces + admin
 * orders) onto an absolute-path Hono app. Mirrors the operator's previous
 * `mountCatalogBookingRoutes`, minus the cross-package snapshot/slots
 * handlers that have to stay in the deployment (cycle).
 */
export function mountCatalogBookingRoutes(
  hono: Hono,
  options: CatalogBookingRouteModuleOptions,
): void {
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.route(prefix, createCatalogBookingRoutes(options.booking))
  }

  // Admin-only — order management (list / get / cancel).
  hono.route("/v1/admin/catalog", createCatalogBookingOrdersRoutes(options))
}

// ─────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────

async function handleListOrders(
  c: Context,
  options: CatalogBookingRouteModuleOptions,
): Promise<Response> {
  const db = getDb(options, c)
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

async function handleGetOrder(
  c: Context,
  options: CatalogBookingRouteModuleOptions,
): Promise<Response> {
  const db = getDb(options, c)
  const id = c.req.param("id")
  if (!id) return c.json({ error: "id is required" }, 400)
  const row = await getOrderById(db, id)
  if (!row) return c.json({ error: "order not found" }, 404)
  return c.json(row)
}

async function handleCancel(
  c: Context,
  options: CatalogBookingRouteModuleOptions,
): Promise<Response> {
  let body: CancelBody
  try {
    body = await c.req.json<CancelBody>()
  } catch {
    body = {}
  }

  if (!body.bookingId || !body.entityModule || !body.entityId) {
    return c.json({ error: "bookingId, entityModule, and entityId are required in the body" }, 400)
  }

  const db = getDb(options, c)
  const registry = options.resolveRegistry(c)
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
