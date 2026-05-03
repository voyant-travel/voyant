/**
 * `quoteEntity` — the first step in the booking engine lifecycle.
 *
 * Asks the registered adapter "is this row still bookable, and at what
 * price right now?", persists the answer in `catalog_quotes` with an
 * expiry, and returns a stable `quoteId` the subsequent `bookEntity`
 * call can validate against.
 *
 * Quotes are short-lived (default TTL: 10 minutes) and not de-duped.
 * Re-quoting the same row produces a new quote row so the audit trail
 * shows every quote attempt.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"
import { newId } from "@voyantjs/db/lib/typeid"

import type { LiveResolveResult, SourceAdapterContext } from "../adapter/contract.js"
import type { PricingBasis } from "../snapshot/schema.js"

import type { SourceAdapterRegistry } from "./registry.js"
import { catalogQuotesTable, type SelectCatalogQuote } from "./schema.js"

/** Default time-to-live for a quote. */
export const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000

export interface QuoteScope {
  locale: string
  audience: string
  market: string
  currency?: string
}

export interface QuoteEntityRequest {
  /** The catalog row to quote. */
  entityModule: string
  entityId: string

  /** Source pointer, read from the row's provenance. */
  sourceKind: string
  sourceProvider?: string
  sourceConnectionId?: string
  sourceRef?: string

  /** Variant scope for the quote. */
  scope: QuoteScope

  /** Vertical-specific parameters echoed to the adapter (date range, pax, etc.). */
  parameters?: Record<string, unknown>

  /** Override the TTL (rare — defaults to `DEFAULT_QUOTE_TTL_MS`). */
  ttlMs?: number

  /** Adapter context (connection_id, credentials, correlation_id). */
  adapterContext: SourceAdapterContext
}

export interface QuoteEntityResult {
  quoteId: string
  quotedAt: Date
  expiresAt: Date
  available: boolean
  invalidReason?: string
  pricing?: PricingBasis
  upstreamPayload?: Record<string, unknown>
}

export interface QuoteEntityDeps {
  registry: SourceAdapterRegistry
}

/**
 * Quote the row. Calls `adapter.liveResolve` (sourced) or interprets
 * `available = true` from a stub (owned, when no adapter is registered
 * for the `"owned"` kind in this MVP cut).
 *
 * Throws `NoAdapterRegisteredError` if the registry has no entry for
 * `sourceKind`. Persists the quote either way — a `failed` lookup is
 * still recorded so subsequent diagnostics can see the attempt.
 */
export async function quoteEntity(
  db: AnyDrizzleDb,
  deps: QuoteEntityDeps,
  request: QuoteEntityRequest,
): Promise<QuoteEntityResult> {
  const adapter = deps.registry.resolveOrThrow(request.sourceKind)
  const ttlMs = request.ttlMs ?? DEFAULT_QUOTE_TTL_MS
  const quotedAt = new Date()
  const expiresAt = new Date(quotedAt.getTime() + ttlMs)

  let liveResolve: LiveResolveResult = { values: {} }
  if (adapter.liveResolve) {
    liveResolve = await adapter.liveResolve(request.adapterContext, {
      ids: [request.entityId],
      scope: {
        locale: request.scope.locale,
        audience: request.scope.audience,
        market: request.scope.market,
        currency: request.scope.currency,
      },
      parameters: request.parameters,
    })
  }

  const failedReason = liveResolve.failed?.[request.entityId]
  const liveValues = liveResolve.values[request.entityId]
  const available = !failedReason && liveValues !== undefined

  const pricing = available ? liveValuesToPricing(liveValues, request.scope.currency) : undefined
  const upstreamPayload = liveValues as Record<string, unknown> | undefined

  const quoteId = newId("catalog_quotes")
  const inserted = (await db
    .insert(catalogQuotesTable)
    .values({
      id: quoteId,
      entity_module: request.entityModule,
      entity_id: request.entityId,
      source_kind: request.sourceKind,
      source_provider: request.sourceProvider,
      source_connection_id: request.sourceConnectionId,
      source_ref: request.sourceRef,
      available,
      invalid_reason: failedReason,
      locale: request.scope.locale,
      audience: request.scope.audience,
      market: request.scope.market,
      currency: request.scope.currency,
      pricing_base_amount: pricing?.base_amount != null ? String(pricing.base_amount) : undefined,
      pricing_taxes: pricing?.taxes != null ? String(pricing.taxes) : undefined,
      pricing_fees: pricing?.fees != null ? String(pricing.fees) : undefined,
      pricing_surcharges: pricing?.surcharges != null ? String(pricing.surcharges) : undefined,
      pricing_currency: pricing?.currency,
      pricing_breakdown: pricing?.breakdown,
      upstream_payload: upstreamPayload ?? null,
      created_at: quotedAt,
      expires_at: expiresAt,
    })
    .returning()) as SelectCatalogQuote[]

  if (!inserted[0]) throw new Error("quoteEntity: insert returned no rows")

  return {
    quoteId,
    quotedAt,
    expiresAt,
    available,
    invalidReason: failedReason,
    pricing,
    upstreamPayload,
  }
}

/**
 * Convert an adapter's per-entity `liveResolve` value into the catalog
 * plane's `PricingBasis` shape. The adapter's payload is opaque, so this
 * helper looks for the conventional fields (`priceCents`, `currency`,
 * `taxesCents`, `feesCents`, `surchargesCents`) and falls back to a
 * single-line "all in base_amount" basis when only a price is provided.
 */
function liveValuesToPricing(
  values: Record<string, unknown> | undefined,
  fallbackCurrency?: string,
): PricingBasis | undefined {
  if (!values) return undefined
  const priceCents = readNumber(values.priceCents) ?? readNumber(values.price)
  if (priceCents == null) return undefined
  const currency = readString(values.currency) ?? fallbackCurrency
  if (!currency) return undefined
  return {
    base_amount: priceCents,
    taxes: readNumber(values.taxesCents) ?? 0,
    fees: readNumber(values.feesCents) ?? 0,
    surcharges: readNumber(values.surchargesCents) ?? 0,
    currency,
  }
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}
