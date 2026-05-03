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

import {
  BookingEngineError,
  type BookingPaymentIntent,
  bookEntity,
  cancelEntity,
  createBookingDraft,
  DEFAULT_DRAFT_TTL_MS,
  deleteBookingDraft,
  getBookingDraft,
  getOrderById,
  listOrders,
  NO_ADAPTER_REGISTERED,
  NO_HANDLER_REGISTERED,
  ORDER_ALREADY_CANCELLED,
  ORDER_NOT_FOUND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  quoteEntity,
  RESERVE_FAILED,
  updateBookingDraft,
} from "@voyantjs/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyantjs/db"
import type { Context, Hono } from "hono"

import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"

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
  /** Optional draft state — when present, the engine reads pax / addons /
   *  accommodation / billing country off this for live re-quoting. */
  draft?: Record<string, unknown>
  ttlMs?: number
}

interface BookBody {
  quoteId?: string
  bookingId?: string
  party?: Record<string, unknown>
  paymentIntent?: BookingPaymentIntent
  parameters?: Record<string, unknown>
  /** Optional draft id — when present, the engine resolves the most
   *  recent quote and full draft payload from `booking_drafts`. */
  draftId?: string
  /** Idempotency key — same key in 24h returns the existing booking. */
  idempotencyKey?: string
}

interface CancelBody {
  bookingId?: string
  entityModule?: string
  entityId?: string
  reason?: string
}

interface DraftBody {
  entityModule?: string
  entityId?: string
  sourceKind?: string
  sourceConnectionId?: string
  sourceRef?: string
  draftPayload?: Record<string, unknown>
  currentStep?: string
  currentQuoteId?: string
  ttlMs?: number
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  // /quote — both surfaces
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.post(`${prefix}/quote`, handleQuote)
    hono.post(`${prefix}/book`, handleBook)
    hono.put(`${prefix}/drafts/:id`, handleDraftPut)
    hono.get(`${prefix}/drafts/:id`, handleDraftGet)
    hono.delete(`${prefix}/drafts/:id`, handleDraftDelete)
  }

  // Admin-only — order management.
  hono.post("/v1/admin/catalog/orders/:id/cancel", handleCancel)
  hono.get("/v1/admin/catalog/orders", handleListOrders)
  hono.get("/v1/admin/catalog/orders/:id", handleGetOrder)
}

// ─────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────

async function handleQuote(c: Context): Promise<Response> {
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
  const ownedHandlers = getOwnedBookingHandlerRegistryFromContext(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

  try {
    const result = await quoteEntity(
      db,
      { registry, ownedHandlers },
      {
        entityModule: body.entityModule,
        entityId: body.entityId,
        sourceKind: body.sourceKind,
        sourceProvider: body.sourceProvider,
        sourceConnectionId: body.sourceConnectionId,
        sourceRef: body.sourceRef,
        scope: {
          locale: body.scope?.locale ?? "en-GB",
          audience: body.scope?.audience ?? defaultAudienceForPath(c),
          market: body.scope?.market ?? "default",
          currency: body.scope?.currency,
        },
        // Both `parameters` and the optional draft are forwarded; the
        // engine routes the draft into the owned handler / sourced
        // adapter when present.
        parameters: { ...body.parameters, draft: body.draft },
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
}

async function handleBook(c: Context): Promise<Response> {
  let body: BookBody
  try {
    body = await c.req.json<BookBody>()
  } catch {
    body = {}
  }

  if (!body.quoteId && !body.draftId) {
    return c.json({ error: "either quoteId or draftId is required" }, 400)
  }

  const db = getDb(c)
  const registry = getBookingEngineRegistryFromContext(c)
  const ownedHandlers = getOwnedBookingHandlerRegistryFromContext(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

  // When the caller passes a draftId without a quoteId, resolve the
  // current quote off the draft. Phase B's draft-first flow.
  let quoteId = body.quoteId
  let draftPayload: Record<string, unknown> | undefined
  if (!quoteId && body.draftId) {
    const draft = await getBookingDraft(db, body.draftId)
    if (!draft) return c.json({ error: "draft not found" }, 404)
    if (!draft.current_quote_id) {
      return c.json({ error: "draft has no current quote — call /quote first" }, 409)
    }
    quoteId = draft.current_quote_id
    draftPayload = draft.draft_payload
  }
  if (!quoteId) return c.json({ error: "quoteId could not be resolved" }, 400)

  try {
    const result = await bookEntity(
      db,
      { registry, ownedHandlers },
      {
        quoteId,
        bookingId: body.bookingId,
        party: body.party,
        paymentIntent: body.paymentIntent,
        parameters: { ...body.parameters, draft: draftPayload ?? body.parameters?.draft },
        idempotencyKey: body.idempotencyKey,
        adapterContext: { connection_id: "engine", correlation_id: correlationId },
      },
    )
    return c.json(result)
  } catch (err) {
    return errorResponse(c, err)
  }
}

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

async function handleDraftPut(c: Context): Promise<Response> {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "id is required" }, 400)

  let body: DraftBody
  try {
    body = await c.req.json<DraftBody>()
  } catch {
    body = {}
  }

  if (!body.draftPayload) {
    return c.json({ error: "draftPayload is required" }, 400)
  }

  const db = getDb(c)

  // Upsert: if a draft exists, patch; else create with the supplied id.
  const existing = await getBookingDraft(db, id)
  if (existing) {
    const updated = await updateBookingDraft(db, id, {
      draftPayload: body.draftPayload,
      currentStep: body.currentStep,
      currentQuoteId: body.currentQuoteId,
      refreshTtlMs: body.ttlMs ?? DEFAULT_DRAFT_TTL_MS,
    })
    return c.json(updated)
  }

  if (!body.entityModule || !body.entityId || !body.sourceKind) {
    return c.json(
      { error: "entityModule, entityId, sourceKind required when creating a draft" },
      400,
    )
  }

  const created = await createBookingDraft(db, {
    id,
    entityModule: body.entityModule,
    entityId: body.entityId,
    sourceKind: body.sourceKind,
    sourceConnectionId: body.sourceConnectionId,
    sourceRef: body.sourceRef,
    draftPayload: body.draftPayload,
    currentStep: body.currentStep,
    currentQuoteId: body.currentQuoteId,
    createdBy: extractActorId(c),
    ttlMs: body.ttlMs,
  })
  return c.json(created, 201)
}

async function handleDraftGet(c: Context): Promise<Response> {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "id is required" }, 400)
  const db = getDb(c)
  const row = await getBookingDraft(db, id)
  if (!row) return c.json({ error: "draft not found" }, 404)
  return c.json(row)
}

async function handleDraftDelete(c: Context): Promise<Response> {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "id is required" }, 400)
  const db = getDb(c)
  await deleteBookingDraft(db, id)
  return c.body(null, 204)
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function defaultAudienceForPath(c: Context): string {
  return c.req.path.startsWith("/v1/public/") ? "customer" : "staff"
}

function extractActorId(c: Context): string | null {
  const userId = (c.var as { userId?: string }).userId
  return typeof userId === "string" ? userId : null
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
