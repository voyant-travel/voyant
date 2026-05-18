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
  catalogQuotesTable,
  createCatalogBookingRoutes,
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
  type QuoteEntityResult,
  RESERVE_FAILED,
} from "@voyantjs/catalog/booking-engine"
import { readSourcedEntry } from "@voyantjs/catalog/services/sourced-entry"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { computeBookingItemTaxLine, resolveBookingSellTaxRate } from "@voyantjs/finance"
import { products } from "@voyantjs/products"
import { getProductContent } from "@voyantjs/products/service-content"
import { createCatalogPromotionEvaluator } from "@voyantjs/promotions/service-catalog-evaluator"
import { suppliers } from "@voyantjs/suppliers"
import { and, asc, eq, gte } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

import {
  getBookingEngineRegistryFromContext,
  getOwnedBookingHandlerRegistryFromContext,
} from "./lib/booking-engine-runtime"
import { resolveBookingTaxSettings } from "./settings"

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000

function getDb(c: Context): AnyDrizzleDb {
  return (c.var as { db: AnyDrizzleDb }).db
}

interface CancelBody {
  bookingId?: string
  entityModule?: string
  entityId?: string
  reason?: string
}

export function mountCatalogBookingRoutes(hono: Hono): void {
  for (const prefix of ["/v1/admin/catalog", "/v1/public/catalog"]) {
    hono.route(
      prefix,
      createCatalogBookingRoutes({
        resolveDb: getDb,
        resolveSourceRegistry: getBookingEngineRegistryFromContext,
        resolveOwnedHandlers: getOwnedBookingHandlerRegistryFromContext,
        resolveHoldTtlMs: ({ db, entityModule, entityId }) =>
          resolveHoldTtlMs(db, entityModule, entityId),
        // Promotions hook — wires the per-request `db` into the
        // evaluator. When the customer-supplied promotion code fails
        // validation, quoteEntity surfaces a `code_*` invalidReason
        // and tax recompute below sees no discount on `base_amount`.
        // Per docs/architecture/promotions-architecture.md §3.6.
        resolveEvaluatePromotions: ({ db }) => createCatalogPromotionEvaluator(db),
        transformQuoteResult: ({ db, result, request, provenance }) =>
          applyBookingTaxToQuoteResult(
            db,
            result,
            request.entityModule,
            request.entityId,
            provenance.sourceKind,
          ),
        onDraftConsumedError: ({ error }) => {
          console.warn("[catalog-booking] markDraftConsumed failed:", error)
        },
      }),
    )
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

function positiveMinutes(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

async function resolveHoldTtlMs(
  db: AnyDrizzleDb,
  entityModule: string,
  entityId: string,
): Promise<number> {
  if (entityModule !== "products") {
    return DEFAULT_HOLD_TTL_MS
  }

  const [product] = await db
    .select({
      supplierId: products.supplierId,
      reservationTimeoutMinutes: products.reservationTimeoutMinutes,
    })
    .from(products)
    .where(eq(products.id, entityId))
    .limit(1)

  const productMinutes = positiveMinutes(product?.reservationTimeoutMinutes)
  if (productMinutes !== null) {
    return productMinutes * 60 * 1000
  }

  if (!product?.supplierId) {
    return DEFAULT_HOLD_TTL_MS
  }

  const [supplier] = await db
    .select({ reservationTimeoutMinutes: suppliers.reservationTimeoutMinutes })
    .from(suppliers)
    .where(eq(suppliers.id, product.supplierId))
    .limit(1)

  return (positiveMinutes(supplier?.reservationTimeoutMinutes) ?? 30) * 60 * 1000
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

async function applyBookingTaxToQuoteResult(
  db: AnyDrizzleDb,
  result: QuoteEntityResult,
  entityModule: string,
  entityId: string,
  sourceKind: string,
): Promise<QuoteEntityResult> {
  if (!result.available || !result.pricing) return result
  // When promotional offers were applied at quote time, `quoteEntity`
  // clears `taxes` + `breakdown` because the upstream values were
  // computed against the un-discounted base (per
  // docs/architecture/promotions-architecture.md §7.1). In that case
  // we MUST recompute taxes here even for owned quotes — the owned
  // handler's pre-discount breakdown is stale. Without this branch the
  // owned discounted quote would round-trip with `taxes: 0` and a
  // missing breakdown, mis-displaying the customer-facing total.
  const hasAppliedOffers = (result.pricing.appliedOffers?.length ?? 0) > 0
  if (sourceKind === OWNED_SOURCE_KIND && !hasAppliedOffers) return result
  if (result.pricing.taxes > 0 && !hasAppliedOffers) return result

  const pricing = result.pricing
  const taxableCents = pricing.base_amount
  const taxRate = await resolveBookingSellTaxRate(
    db as PostgresJsDatabase,
    {
      productId: entityModule === "products" ? entityId : null,
      facts: { hasAccommodation: false, accommodationCountries: [] },
    },
    {
      resolveBookingTaxSettings,
    },
  )
  const taxLine = computeBookingItemTaxLine(taxRate, taxableCents, pricing.currency)
  if (!taxLine) return result

  const inclusive = taxLine.includedInPrice
  const subtotal = inclusive ? Math.max(0, taxableCents - taxLine.amountCents) : taxableCents
  const total = inclusive ? taxableCents : taxableCents + taxLine.amountCents
  const adjustedPricing = {
    ...pricing,
    base_amount: subtotal,
    taxes: taxLine.amountCents,
    breakdown: {
      currency: pricing.currency,
      lines: [
        {
          kind: "base",
          label: "Base",
          quantity: 1,
          unitAmount: taxableCents,
          totalAmount: taxableCents,
          taxIncluded: inclusive,
        },
      ],
      taxes: [
        {
          code: taxLine.code ?? "tax",
          label: taxLine.name,
          rate: (taxLine.rateBasisPoints ?? 0) / 10_000,
          amount: taxLine.amountCents,
          base: subtotal,
          includedInPrice: inclusive,
          scope: taxLine.scope,
        },
      ],
      subtotal,
      taxTotal: taxLine.amountCents,
      total,
    },
  }

  await (db as PostgresJsDatabase)
    .update(catalogQuotesTable)
    .set({
      pricing_base_amount: String(adjustedPricing.base_amount),
      pricing_taxes: String(adjustedPricing.taxes),
      pricing_fees: String(adjustedPricing.fees),
      pricing_surcharges: String(adjustedPricing.surcharges),
      pricing_currency: adjustedPricing.currency,
      pricing_breakdown: adjustedPricing.breakdown,
    })
    .where(eq(catalogQuotesTable.id, result.quoteId))

  return { ...result, pricing: adjustedPricing }
}

/**
 * GET /v1/admin/bookings/:id/catalog-snapshot
 *
 * Returns the `booking_catalog_snapshot` row for this booking — the
 * frozen view of what the customer actually purchased: which entity
 * (product / cruise / hospitality), which source (owned / Bokun / Mews),
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
  const db = getDb(c)

  const { bookingCatalogSnapshotTable } = await import("@voyantjs/catalog")
  const [snapshot] = await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(eq(bookingCatalogSnapshotTable.booking_id, bookingId))
    .limit(1)

  if (!snapshot) {
    return c.json({ error: "snapshot_not_found" }, 404)
  }

  const resolved = await resolveSnapshotForAdmin(db as unknown as PostgresJsDatabase, {
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
      const { productsService } = await import("@voyantjs/products")
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
