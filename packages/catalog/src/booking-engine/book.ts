/**
 * `bookEntity` — the second step in the booking engine lifecycle.
 *
 * Validates the supplied quote, calls `adapter.reserve`, and writes a
 * `booking_catalog_snapshot` row with the frozen view, source pointer,
 * and pricing breakdown. The snapshot is the audit record; the source
 * pointer is what subsequent `cancelEntity` / status calls dispatch
 * against.
 *
 * `bookingId` is plain text (no FK), so the engine accepts an existing
 * id from the caller (when a `bookings` row already exists) or generates
 * one on demand. This keeps the engine decoupled from `packages/bookings`
 * — the engine and the bookings module evolve independently and are
 * joined at read time via the shared `booking_id` text column.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"
import { eq } from "drizzle-orm"

import type { ReserveRequest, SourceAdapterContext } from "../adapter/contract.js"
import { type CaptureSnapshotInput, captureSnapshot } from "../services/snapshot-service.js"
import type { PricingBasis, SelectBookingCatalogSnapshot } from "../snapshot/schema.js"

import {
  BookingEngineError,
  QUOTE_NOT_FOUND,
  QuoteExpiredError,
  QuoteMismatchError,
  ReserveFailedError,
} from "./errors.js"
import type { OwnedBookingHandlerRegistry } from "./owned-handler.js"
import { OWNED_SOURCE_KIND } from "./owned-handler.js"
import type { SourceAdapterRegistry } from "./registry.js"
import { catalogQuotesTable, type SelectCatalogQuote } from "./schema.js"
import type { SnapshotContentCapture, SnapshotContentCapturer } from "./snapshot-content.js"

/**
 * Mirrors flights' `paymentIntent` discriminated union from
 * `catalog-flights-architecture.md` §3.1. Default `{ type: "hold" }`
 * when omitted.
 */
export type BookingPaymentIntent =
  | { type: "hold" }
  | { type: "card"; tokenizedCard: string }
  | { type: "ticket_on_credit"; agencyAccount: string }

export interface BookEntityRequest {
  /** Quote previously returned from `quoteEntity`. */
  quoteId: string

  /**
   * Existing or newly-created booking shell id. Generated when omitted,
   * using the `bookings` typeid prefix so the value is shape-compatible
   * with `packages/bookings`.
   */
  bookingId?: string

  /** Customer / passenger payload echoed to the adapter's reserve call. */
  party?: Record<string, unknown>

  /** Defaults to `{ type: "hold" }` — see `BookingPaymentIntent`. */
  paymentIntent?: BookingPaymentIntent

  /** Vertical-specific parameters passed to the adapter. */
  parameters?: Record<string, unknown>

  adapterContext: SourceAdapterContext

  /**
   * Locale / market / currency scope for snapshot content capture per
   * sourced-content §5.1. Required when `deps.captureSnapshotContent`
   * is wired — the engine refreshes content from the adapter at commit
   * time using this scope and embeds the result as `content_capture`
   * in `frozen_payload`. When the deps callback isn't set, this field
   * is ignored and snapshot behavior is unchanged.
   */
  contentScope?: {
    locale: string
    market?: string
    currency?: string
  }
}

export interface BookEntityResult {
  bookingId: string
  orderRef: string
  status: "held" | "confirmed" | "ticketed" | "failed"
  snapshotId: string
  pricing?: PricingBasis
  upstreamPayload?: Record<string, unknown>
}

export interface BookEntityDeps {
  registry: SourceAdapterRegistry
  /**
   * Owned-arm dispatch — when set and the quote's source kind is
   * `"owned"`, the engine commits via a handler keyed by
   * `entity_module` instead of the SourceAdapterRegistry. Per
   * booking-journey-architecture §6.
   */
  ownedHandlers?: OwnedBookingHandlerRegistry
  /**
   * Optional snapshot content capture orchestrator (sourced-content
   * §5.1). When set, called after `adapter.reserve` succeeds. Returns a
   * `SnapshotContentCapture` envelope embedded in `frozen_payload` so
   * audit can later distinguish a fresh capture from a cache fallback.
   *
   * Throws `SnapshotContentUnavailableError` when neither a fresh
   * adapter fetch nor a cache fallback can produce content; the engine
   * propagates that error and aborts the commit. When the entity is
   * owned (no sourced-entry row), the orchestrator should return null
   * and the engine skips the capture.
   *
   * Implementations live in templates: each template composes per-
   * vertical content services into one capturer and threads it through
   * deps.
   */
  captureSnapshotContent?: SnapshotContentCapturer
}

/**
 * Book the row referenced by `quoteId`. End-to-end: validate quote,
 * dispatch `adapter.reserve`, capture snapshot, mark quote consumed.
 *
 * Throws:
 *   - `BookingEngineError(QUOTE_NOT_FOUND)` if the quote doesn't exist.
 *   - `QuoteExpiredError` if the quote's `expires_at` has passed.
 *   - `QuoteMismatchError` if a future caller tries to book a different
 *     entity than the quote was issued for (defensive — the engine
 *     re-reads quote.entity_*).
 *   - `NoAdapterRegisteredError` if the registry has no adapter for
 *     the quote's `source_kind`.
 *   - `ReserveFailedError` when the adapter returns `status: "failed"`.
 */
export async function bookEntity(
  db: AnyDrizzleDb,
  deps: BookEntityDeps,
  request: BookEntityRequest,
): Promise<BookEntityResult> {
  const quote = await loadQuote(db, request.quoteId)
  assertQuoteUsable(quote)

  const paymentIntent: BookingPaymentIntent = request.paymentIntent ?? { type: "hold" }
  const bookingId = request.bookingId ?? newId("bookings")
  const isOwned = quote.source_kind === OWNED_SOURCE_KIND && deps.ownedHandlers != null

  // Owned arm: dispatch to handler.commit; skip snapshot-content
  // capture (owned content lives in the operator's own DB, not in a
  // remote upstream).
  if (isOwned) {
    if (!deps.ownedHandlers) throw new Error("unreachable: ownedHandlers checked above")
    const handler = deps.ownedHandlers.resolveOrThrow(quote.entity_module)
    const quotePricing = readPricingFromQuote(quote)
    const commitResult = await handler.commit(
      { db, adapterContext: request.adapterContext },
      {
        entityModule: quote.entity_module,
        entityId: quote.entity_id,
        bookingId,
        party: request.party,
        parameters: request.parameters,
        pricing: quotePricing,
        draft: (request.parameters as { draft?: unknown } | undefined)?.draft,
      },
    )
    if (commitResult.status === "failed") {
      throw new ReserveFailedError(commitResult.upstreamPayload, quote.source_kind, quote.entity_id)
    }

    const finalPricing = commitResult.pricing ?? quotePricing
    const ownedFrozenPayload: Record<string, unknown> = {
      quote: serializeQuote(quote),
      commit: commitResult.upstreamPayload ?? null,
      paymentIntent,
    }
    const ownedSnapshot = await captureSnapshot(db, {
      bookingId,
      entityModule: quote.entity_module,
      entityId: quote.entity_id,
      sourceKind: quote.source_kind,
      sourceProvider: quote.source_provider ?? undefined,
      sourceConnectionId: quote.source_connection_id ?? undefined,
      sourceRef: commitResult.orderRef || quote.source_ref || undefined,
      frozenPayload: ownedFrozenPayload,
      pricingBasis: finalPricing,
    })
    await markQuoteConsumed(db, quote.id, bookingId)

    return {
      bookingId,
      orderRef: commitResult.orderRef || ownedSnapshot.id,
      status: commitResult.status,
      snapshotId: ownedSnapshot.id,
      pricing: finalPricing,
      upstreamPayload: commitResult.upstreamPayload,
    }
  }

  // Sourced arm — preserves the existing dispatch path verbatim.
  const adapter = quote.source_connection_id
    ? (deps.registry.resolveByConnection(quote.source_connection_id) ??
      deps.registry.resolveOrThrow(quote.source_kind))
    : deps.registry.resolveOrThrow(quote.source_kind)
  if (!adapter.reserve) {
    throw new BookingEngineError(
      "RESERVE_FAILED",
      `adapter "${adapter.kind}" does not implement reserve()`,
      { sourceKind: quote.source_kind },
    )
  }

  const reserveRequest: ReserveRequest = {
    entity_module: quote.entity_module,
    entity_id: quote.entity_id,
    parameters: request.parameters ?? {},
    party: request.party,
    payment_intent: paymentIntent as unknown as Record<string, unknown>,
  }

  const reserveResult = await adapter.reserve(request.adapterContext, reserveRequest)
  if (reserveResult.status === "failed") {
    throw new ReserveFailedError(reserveResult.upstream_payload, quote.source_kind, quote.entity_id)
  }

  const pricing = readPricingFromQuote(quote)

  // Snapshot content capture per sourced-content §5.1 — refresh from
  // the adapter, fall back to cache, throw if neither produces content.
  // Skipped entirely when the deps callback isn't wired (legacy
  // behavior).
  let contentCapture: SnapshotContentCapture | null = null
  if (deps.captureSnapshotContent && request.contentScope) {
    contentCapture = await deps.captureSnapshotContent({
      db,
      entity_module: quote.entity_module,
      entity_id: quote.entity_id,
      source_kind: quote.source_kind,
      source_connection_id: quote.source_connection_id ?? undefined,
      source_ref: reserveResult.upstream_ref || quote.source_ref || undefined,
      locale: request.contentScope.locale,
      market: request.contentScope.market,
      currency: request.contentScope.currency,
      adapterContext: request.adapterContext,
    })
  }

  const frozenPayload: Record<string, unknown> = {
    quote: serializeQuote(quote),
    reserve: reserveResult.upstream_payload ?? null,
    paymentIntent,
  }
  if (contentCapture) {
    // The content_capture envelope is alongside `content` so audit can
    // later distinguish a fresh capture from a cache fallback (per
    // §5.1). Both fields are nested under frozen_payload as opaque
    // JSONB — no schema migration required.
    frozenPayload.content = contentCapture.content
    frozenPayload.content_capture = {
      source: contentCapture.source,
      fetched_at: contentCapture.fetched_at,
      fallback_reason: contentCapture.fallback_reason,
      content_etag: contentCapture.content_etag,
      content_schema_version: contentCapture.content_schema_version,
    }
  }

  const snapshotInput: CaptureSnapshotInput = {
    bookingId,
    entityModule: quote.entity_module,
    entityId: quote.entity_id,
    sourceKind: quote.source_kind,
    sourceProvider: quote.source_provider ?? undefined,
    sourceConnectionId: quote.source_connection_id ?? undefined,
    sourceRef: reserveResult.upstream_ref || quote.source_ref || undefined,
    frozenPayload,
    pricingBasis: pricing,
  }

  const snapshot = await captureSnapshot(db, snapshotInput)
  await markQuoteConsumed(db, quote.id, bookingId)

  return {
    bookingId,
    orderRef: reserveResult.upstream_ref || snapshot.id,
    status: reserveResult.status,
    snapshotId: snapshot.id,
    pricing,
    upstreamPayload: reserveResult.upstream_payload as Record<string, unknown> | undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadQuote(db: AnyDrizzleDb, quoteId: string): Promise<SelectCatalogQuote> {
  const rows = (await db
    .select()
    .from(catalogQuotesTable)
    .where(eq(catalogQuotesTable.id, quoteId))
    .limit(1)) as SelectCatalogQuote[]
  const quote = rows[0]
  if (!quote) {
    throw new BookingEngineError(QUOTE_NOT_FOUND, `quote ${quoteId} not found`, { quoteId })
  }
  return quote
}

function assertQuoteUsable(quote: SelectCatalogQuote): void {
  if (quote.consumed_at) {
    throw new QuoteMismatchError(
      quote.id,
      { entityModule: quote.entity_module, entityId: quote.entity_id },
      { entityModule: quote.entity_module, entityId: quote.entity_id },
    )
  }
  const expiresAt = new Date(quote.expires_at)
  if (Number.isNaN(expiresAt.getTime())) {
    throw new BookingEngineError(QUOTE_NOT_FOUND, `quote ${quote.id} has invalid expires_at`, {
      quoteId: quote.id,
    })
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw new QuoteExpiredError(quote.id, expiresAt)
  }
  if (!quote.available) {
    throw new ReserveFailedError(
      { invalidReason: quote.invalid_reason },
      quote.source_kind,
      quote.entity_id,
    )
  }
}

async function markQuoteConsumed(
  db: AnyDrizzleDb,
  quoteId: string,
  bookingId: string,
): Promise<void> {
  await db
    .update(catalogQuotesTable)
    .set({
      consumed_at: new Date(),
      consumed_booking_id: bookingId,
    })
    .where(eq(catalogQuotesTable.id, quoteId))
}

function readPricingFromQuote(quote: SelectCatalogQuote): PricingBasis | undefined {
  const baseRaw = quote.pricing_base_amount
  if (baseRaw == null) return undefined
  const base = typeof baseRaw === "string" ? Number.parseFloat(baseRaw) : Number(baseRaw)
  if (!Number.isFinite(base)) return undefined
  const currency = quote.pricing_currency
  if (!currency) return undefined
  return {
    base_amount: base,
    taxes: numericOrZero(quote.pricing_taxes),
    fees: numericOrZero(quote.pricing_fees),
    surcharges: numericOrZero(quote.pricing_surcharges),
    currency,
    breakdown: quote.pricing_breakdown ?? undefined,
  }
}

function numericOrZero(v: unknown): number {
  if (v == null) return 0
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function serializeQuote(quote: SelectCatalogQuote): Record<string, unknown> {
  return {
    id: quote.id,
    entity_module: quote.entity_module,
    entity_id: quote.entity_id,
    source_kind: quote.source_kind,
    source_provider: quote.source_provider,
    source_ref: quote.source_ref,
    locale: quote.locale,
    audience: quote.audience,
    market: quote.market,
    currency: quote.currency,
    pricing_base_amount: quote.pricing_base_amount,
    pricing_currency: quote.pricing_currency,
    upstream_payload: quote.upstream_payload,
    created_at: quote.created_at,
    expires_at: quote.expires_at,
  }
}

// Re-export for callers that read the snapshot row shape directly.
export type { SelectBookingCatalogSnapshot }
