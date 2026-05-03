/**
 * Catalog booking-engine routes for the operator template.
 *
 * Mounts the cross-vertical lifecycle from `@voyantjs/catalog/booking-engine`:
 *
 *   POST /v1/admin/catalog/quote                  → quoteEntity
 *   POST /v1/admin/catalog/book                   → bookEntity
 *   POST /v1/admin/catalog/orders/:id/cancel      → cancelEntity (id = snapshot id)
 *   GET  /v1/admin/catalog/orders                 → listOrders
 *   GET  /v1/admin/catalog/orders/:id             → getOrderById
 *
 * The handlers parse minimal JSON bodies, delegate to the engine, and
 * translate `BookingEngineError` codes into appropriate HTTP statuses
 * (4xx vs 5xx). Authorization comes from the operator template's
 * `requireAuth` chain — this file doesn't add additional checks.
 */

import {
  BookingEngineError,
  type BookingPaymentIntent,
  bookEntity,
  cancelEntity,
  getOrderById,
  listOrders,
  NO_ADAPTER_REGISTERED,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  quoteEntity,
  RESERVE_FAILED,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { Context, Hono } from "hono"

import { getBookingEngineRegistryFromContext } from "./lib/booking-engine-runtime"

// `c.var.db` is set by the createApp DB middleware; the global ContextVariableMap
// doesn't declare it, so we cast at the call site to keep type-safety local.
function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

interface QuoteBody {
  entityModule?: string
  entityId?: string
  sourceKind?: string
  sourceProvider?: string
  sourceConnectionId?: string
  sourceRef?: string
  scope?: { locale?: string; audience?: string; market?: string; currency?: string }
  parameters?: Record<string, unknown>
  ttlMs?: number
}

interface BookBody {
  quoteId?: string
  bookingId?: string
  party?: Record<string, unknown>
  paymentIntent?: BookingPaymentIntent
  parameters?: Record<string, unknown>
}

interface CancelBody {
  bookingId?: string
  entityModule?: string
  entityId?: string
  reason?: string
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  hono.post("/v1/admin/catalog/quote", async (c) => {
    let body: QuoteBody
    try {
      body = await c.req.json<QuoteBody>()
    } catch {
      body = {}
    }

    if (!body.entityModule || !body.entityId || !body.sourceKind) {
      return c.json({ error: "entityModule, entityId, and sourceKind are required" }, 400)
    }

    const db = getDb(c)
    const registry = getBookingEngineRegistryFromContext(c)
    const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

    try {
      const result = await quoteEntity(
        db,
        { registry },
        {
          entityModule: body.entityModule,
          entityId: body.entityId,
          sourceKind: body.sourceKind,
          sourceProvider: body.sourceProvider,
          sourceConnectionId: body.sourceConnectionId,
          sourceRef: body.sourceRef,
          scope: {
            locale: body.scope?.locale ?? "en-GB",
            audience: body.scope?.audience ?? "staff",
            market: body.scope?.market ?? "default",
            currency: body.scope?.currency,
          },
          parameters: body.parameters,
          ttlMs: body.ttlMs,
          adapterContext: {
            connection_id: body.sourceConnectionId ?? body.sourceKind,
            correlation_id: correlationId,
          },
        },
      )
      return c.json(result)
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  hono.post("/v1/admin/catalog/book", async (c) => {
    let body: BookBody
    try {
      body = await c.req.json<BookBody>()
    } catch {
      body = {}
    }

    if (!body.quoteId) {
      return c.json({ error: "quoteId is required" }, 400)
    }

    const db = getDb(c)
    const registry = getBookingEngineRegistryFromContext(c)
    const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

    try {
      const result = await bookEntity(
        db,
        { registry },
        {
          quoteId: body.quoteId,
          bookingId: body.bookingId,
          party: body.party,
          paymentIntent: body.paymentIntent,
          parameters: body.parameters,
          adapterContext: { connection_id: "engine", correlation_id: correlationId },
        },
      )
      return c.json(result)
    } catch (err) {
      return errorResponse(c, err)
    }
  })

  hono.post("/v1/admin/catalog/orders/:id/cancel", async (c) => {
    let body: CancelBody
    try {
      body = await c.req.json<CancelBody>()
    } catch {
      body = {}
    }

    // The path id is the snapshot row id; cancellation needs the
    // (booking_id, entity_module, entity_id) triple. The body carries
    // those because a single snapshot id is not unique across the cancel
    // dispatch shape (kept for forward compatibility with multi-line
    // orders sharing a booking id).
    if (!body.bookingId || !body.entityModule || !body.entityId) {
      return c.json(
        { error: "bookingId, entityModule, and entityId are required in the body" },
        400,
      )
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
  })

  hono.get("/v1/admin/catalog/orders", async (c) => {
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
  })

  hono.get("/v1/admin/catalog/orders/:id", async (c) => {
    const db = getDb(c)
    const id = c.req.param("id")
    if (!id) return c.json({ error: "id is required" }, 400)
    const row = await getOrderById(db, id)
    if (!row) return c.json({ error: "order not found" }, 404)
    return c.json(row)
  })
}

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
  // Lightweight correlation id for environments without `crypto.randomUUID`
  // available — falls back to timestamp-prefixed random hex.
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
