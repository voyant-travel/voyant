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
  OWNED_SOURCE_KIND,
  QUOTE_EXPIRED,
  QUOTE_MISMATCH,
  QUOTE_NOT_FOUND,
  quoteEntity,
  RESERVE_FAILED,
  updateBookingDraft,
} from "@voyantjs/catalog/booking-engine"
import { readSourcedEntry } from "@voyantjs/catalog/services/sourced-entry"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { getProductContent } from "@voyantjs/products/service-content"
import { and, asc, eq, gte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

/**
 * Resolve provenance for an `(entity_module, entity_id)` pair.
 * Sourced rows live in `catalog_sourced_entries` and carry their
 * upstream pointer; everything else is owned. Customer-facing
 * surfaces shouldn't have to know which is which — they pass the
 * entity, the engine resolves the kind.
 */
async function resolveEntityProvenance(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<{
  sourceKind: string
  sourceProvider?: string
  sourceConnectionId?: string
  sourceRef?: string
}> {
  const row = await readSourcedEntry(db, entityModule, entityId)
  if (!row) {
    return { sourceKind: OWNED_SOURCE_KIND }
  }
  return {
    sourceKind: row.source_kind,
    sourceProvider: row.source_provider ?? undefined,
    sourceConnectionId: row.source_connection_id ?? undefined,
    sourceRef: row.source_ref ?? undefined,
  }
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

interface HoldPlaceBody {
  entityModule?: string
  entityId?: string
  draftId?: string
  ttlMs?: number
  parameters?: Record<string, unknown>
}

interface HoldReleaseBody {
  entityModule?: string
  holdToken?: string
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  // /quote — both surfaces
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.post(`${prefix}/quote`, handleQuote)
    hono.post(`${prefix}/book`, handleBook)
    hono.put(`${prefix}/drafts/:id`, handleDraftPut)
    hono.get(`${prefix}/drafts/:id`, handleDraftGet)
    hono.delete(`${prefix}/drafts/:id`, handleDraftDelete)
    hono.post(`${prefix}/holds/place`, handleHoldPlace)
    hono.post(`${prefix}/holds/release`, handleHoldRelease)
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

  if (!body.entityModule || !body.entityId) {
    return c.json({ error: "entityModule and entityId are required" }, 400)
  }

  const db = getDb(c)
  const registry = getBookingEngineRegistryFromContext(c)
  const ownedHandlers = getOwnedBookingHandlerRegistryFromContext(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()

  // Resolve source provenance from the catalog plane when the
  // caller hasn't supplied it. Customer-facing surfaces don't (and
  // shouldn't) carry source kind in URLs — it's an operator
  // concern. Operator surfaces still pass it explicitly.
  const provenance = body.sourceKind
    ? {
        sourceKind: body.sourceKind,
        sourceProvider: body.sourceProvider,
        sourceConnectionId: body.sourceConnectionId,
        sourceRef: body.sourceRef,
      }
    : await resolveEntityProvenance(db, body.entityModule, body.entityId)

  try {
    const result = await quoteEntity(
      db,
      { registry, ownedHandlers },
      {
        entityModule: body.entityModule,
        entityId: body.entityId,
        sourceKind: provenance.sourceKind,
        sourceProvider: provenance.sourceProvider,
        sourceConnectionId: provenance.sourceConnectionId,
        sourceRef: provenance.sourceRef,
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
          connection_id: provenance.sourceConnectionId ?? provenance.sourceKind,
          correlation_id: correlationId,
        },
      },
    )
    return c.json({ ...result, pricing: toPricingBreakdownV1(result.pricing) })
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
    return c.json({ ...result, pricing: toPricingBreakdownV1(result.pricing) })
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

async function handleListSlots(c: Context): Promise<Response> {
  const url = new URL(c.req.url)
  const entityModule = url.searchParams.get("entityModule")
  const entityId = url.searchParams.get("entityId")
  if (!entityModule || !entityId) {
    return c.json({ error: "entityModule and entityId are required" }, 400)
  }
  // Cruises + hospitality have vertical-specific scheduling
  // (sailings, rate plans) surfaced by the detail page directly off
  // their content payloads. This endpoint only serves products.
  if (entityModule !== "products") {
    return c.json({ rows: [] })
  }

  const db = (c.var as { db: AnyDrizzleDb }).db as PostgresJsDatabase

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
      { registry },
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

async function handleHoldPlace(c: Context): Promise<Response> {
  let body: HoldPlaceBody
  try {
    body = await c.req.json<HoldPlaceBody>()
  } catch {
    body = {}
  }

  if (!body.entityModule || !body.entityId || !body.draftId) {
    return c.json({ error: "entityModule, entityId, and draftId are required" }, 400)
  }

  const ownedHandlers = getOwnedBookingHandlerRegistryFromContext(c)
  const handler = ownedHandlers.resolve(body.entityModule)
  if (!handler?.placeHold) {
    return c.json({ error: "no hold primitive registered for this vertical" }, 503)
  }

  const db = getDb(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()
  try {
    const result = await handler.placeHold(
      { db, adapterContext: { connection_id: "engine", correlation_id: correlationId } },
      {
        entityModule: body.entityModule,
        entityId: body.entityId,
        draftId: body.draftId,
        ttlMs: body.ttlMs ?? 30 * 60 * 1000,
        parameters: body.parameters,
      },
    )
    return c.json({ holdToken: result.holdToken, expiresAt: result.expiresAt.toISOString() })
  } catch (err) {
    return errorResponse(c, err)
  }
}

async function handleHoldRelease(c: Context): Promise<Response> {
  let body: HoldReleaseBody
  try {
    body = await c.req.json<HoldReleaseBody>()
  } catch {
    body = {}
  }

  if (!body.entityModule || !body.holdToken) {
    return c.json({ error: "entityModule and holdToken are required" }, 400)
  }

  const ownedHandlers = getOwnedBookingHandlerRegistryFromContext(c)
  const handler = ownedHandlers.resolve(body.entityModule)
  if (!handler?.releaseHold) {
    return c.body(null, 204) // graceful no-op
  }

  const db = getDb(c)
  const correlationId = c.req.header("x-request-id") ?? cryptoRandom()
  try {
    await handler.releaseHold(
      { db, adapterContext: { connection_id: "engine", correlation_id: correlationId } },
      body.holdToken,
    )
    return c.body(null, 204)
  } catch (err) {
    return errorResponse(c, err)
  }
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

  if (!body.entityModule || !body.entityId) {
    return c.json({ error: "entityModule and entityId are required when creating a draft" }, 400)
  }

  // Customer-facing surfaces don't carry sourceKind in URLs / drafts —
  // the engine resolves provenance from (entityModule, entityId) via
  // the catalog plane's sourced-entry lookup (same as /quote and
  // /book). Operator surfaces still send it explicitly when known.
  const provenance = body.sourceKind
    ? {
        sourceKind: body.sourceKind,
        sourceConnectionId: body.sourceConnectionId,
        sourceRef: body.sourceRef,
      }
    : await resolveEntityProvenance(db, body.entityModule, body.entityId)

  const created = await createBookingDraft(db, {
    id,
    entityModule: body.entityModule,
    entityId: body.entityId,
    sourceKind: provenance.sourceKind,
    sourceConnectionId: provenance.sourceConnectionId,
    sourceRef: provenance.sourceRef,
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

interface PricingBasisShape {
  base_amount: number
  taxes: number
  fees: number
  surcharges: number
  currency: string
  breakdown?: Record<string, unknown>
}

/**
 * Map the engine's `PricingBasis` (base/taxes/fees/surcharges totals)
 * onto the wire shape `pricingBreakdownV1` (lines + tax rows + totals)
 * that V1 clients expect. The basis is what adapters report; the
 * breakdown is what the storefront renders. A line-aware breakdown
 * may eventually flow through the engine and override this projection.
 */
function toPricingBreakdownV1(basis: PricingBasisShape | undefined):
  | {
      currency: string
      lines: Array<{
        kind: "base" | "addon" | "accommodation" | "supplement" | "discount" | "fee"
        label: string
        quantity?: number
        unitAmount: number
        totalAmount: number
      }>
      taxes: Array<{ code: string; label: string; rate: number; amount: number; base: number }>
      subtotal: number
      taxTotal: number
      total: number
    }
  | undefined {
  if (!basis) return undefined
  const lines: Array<{
    kind: "base" | "fee" | "supplement"
    label: string
    quantity?: number
    unitAmount: number
    totalAmount: number
  }> = [
    {
      kind: "base",
      label: "Base",
      quantity: 1,
      unitAmount: basis.base_amount,
      totalAmount: basis.base_amount,
    },
  ]
  if (basis.fees > 0) {
    lines.push({ kind: "fee", label: "Fees", unitAmount: basis.fees, totalAmount: basis.fees })
  }
  if (basis.surcharges > 0) {
    lines.push({
      kind: "supplement",
      label: "Surcharges",
      unitAmount: basis.surcharges,
      totalAmount: basis.surcharges,
    })
  }
  const subtotal = basis.base_amount + basis.fees + basis.surcharges
  return {
    currency: basis.currency,
    lines,
    taxes:
      basis.taxes > 0
        ? [
            {
              code: "tax",
              label: "Tax",
              rate: 0,
              amount: basis.taxes,
              base: basis.base_amount,
            },
          ]
        : [],
    subtotal,
    taxTotal: basis.taxes,
    total: subtotal + basis.taxes,
  }
}
