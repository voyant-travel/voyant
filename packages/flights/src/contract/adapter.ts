/**
 * `FlightConnectorAdapter` contract — the seam through which any flight
 * provider integrates with Voyant.
 *
 * Five core methods every adapter must implement; capability-gated
 * methods exist as optional members on the interface and stub with
 * `CAPABILITY_NOT_SUPPORTED` if the adapter doesn't declare them.
 *
 * Implementations come from anywhere — Voyant Connect, a wholesaler's own
 * engineering team, a cruise line direct API, an operator-built GDS
 * connector, a third-party integrator. No implementer is privileged.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §3.
 */

import type {
  FlightBookRequest,
  FlightCapability,
  FlightOffer,
  FlightOrder,
  FlightSearchRequest,
} from "./types.js"

/**
 * Context passed to every adapter call. Identifies the connection and
 * carries credentials, optional point-of-sale, tracing identifiers.
 */
export interface FlightAdapterContext {
  connectionId: string
  credentials?: Record<string, string>
  /** Operator's IATA office id / pseudo-city / point-of-sale, when applicable. */
  pointOfSale?: string
  correlationId?: string
}

export interface FlightSearchResponse {
  offers: FlightOffer[]
  /** Provider-specific data, opaque to the consumer. */
  providerData?: Record<string, unknown>
}

export interface FlightPriceRequest {
  offerId: string
  /** Some providers require the offer payload echoed back to re-price. */
  offer?: FlightOffer
}

export interface FlightPriceResponse {
  offer: FlightOffer
  /** Whether the offer's price/availability is still valid for booking. */
  valid: boolean
  /** When `valid: false`, why the offer was invalidated. */
  invalidReason?: string
}

export interface FlightBookResponse {
  order: FlightOrder
}

export interface FlightGetOrderResponse {
  order: FlightOrder
}

export interface FlightCancelResponse {
  order: FlightOrder
  refundedAmount?: { amount: string; currency: string }
}

export type FlightCancelReason = "customer_request" | "schedule_change" | "operational" | "fraud"

/**
 * Capability declaration returned by the adapter at registration time.
 * The orchestration layer reads `capabilities` to route requests and to
 * fail fast on unsupported operations.
 */
export interface FlightAdapterCapabilities {
  /** Provider identifier — e.g. `"hisky"`, `"amadeus"`, `"duffel"`, `"sabre"`, `"travelport-ndc"`. */
  provider: string
  /** Capabilities declared by this connection. */
  declared: FlightCapability[]
  /**
   * Maximum slices per search request supported. Many providers cap at
   * 1 (single-carrier point-to-point), 2 (round-trip), or 4-6 (multi-city).
   */
  maxSlicesPerSearch?: number
  /**
   * Default per-source timeout hint for the orchestration layer.
   */
  defaultTimeoutMs?: number
}

/**
 * The flight connector contract. Five core methods + optional capability-
 * gated methods. Adapters that don't support a capability either omit the
 * method or have it throw `CAPABILITY_NOT_SUPPORTED`.
 */
export interface FlightConnectorAdapter {
  readonly capabilities: FlightAdapterCapabilities

  // ── Core (5 methods every adapter implements) ────────────────────────

  /** Search flights matching the request's slices + passengers + cabin. */
  searchFlights(
    ctx: FlightAdapterContext,
    request: FlightSearchRequest,
  ): Promise<FlightSearchResponse>

  /** Re-price an offer immediately before booking. */
  priceOffer(ctx: FlightAdapterContext, request: FlightPriceRequest): Promise<FlightPriceResponse>

  /**
   * Book the flight. Behavior depends on `paymentIntent`:
   *   - `hold` → returns order with status `confirmed`; caller must call
   *     `ticketOrder` later (capability-gated).
   *   - `card` / `ticket_on_credit` → returns order with status `ticketed`.
   */
  bookFlight(ctx: FlightAdapterContext, request: FlightBookRequest): Promise<FlightBookResponse>

  /** Get an order by id (for status checks, post-book operations). */
  getOrder(ctx: FlightAdapterContext, orderId: string): Promise<FlightGetOrderResponse>

  /** Cancel an order. */
  cancelOrder(
    ctx: FlightAdapterContext,
    orderId: string,
    reason?: FlightCancelReason,
  ): Promise<FlightCancelResponse>

  // ── Capability-gated (optional) ──────────────────────────────────────
  // Implementations that declare the capability provide these methods;
  // others can either omit them entirely or throw the standard
  // `CAPABILITY_NOT_SUPPORTED` error.

  /** `flight/holds` — promote a held order to ticketed. */
  ticketOrder?(ctx: FlightAdapterContext, orderId: string): Promise<FlightGetOrderResponse>
}

/**
 * Standard error code for capability-gated methods that aren't supported
 * by the adapter. Mirrors voyant-cloud's convention so behavior is
 * portable across runtimes.
 */
export const CAPABILITY_NOT_SUPPORTED = "CAPABILITY_NOT_SUPPORTED" as const

export class FlightCapabilityNotSupportedError extends Error {
  readonly code = CAPABILITY_NOT_SUPPORTED
  constructor(
    public readonly provider: string,
    public readonly capability: FlightCapability,
    public readonly operation: string,
  ) {
    super(
      `Flight provider "${provider}" does not declare capability "${capability}" (operation: ${operation}). ` +
        `Either configure the request to skip this operation or register a connector that supports it.`,
    )
    this.name = "FlightCapabilityNotSupportedError"
  }
}

/**
 * Helper for adapters that want to short-circuit at the start of a method
 * when a required capability isn't declared.
 */
export function requireCapability(
  capabilities: FlightAdapterCapabilities,
  capability: FlightCapability,
  operation: string,
): void {
  if (!capabilities.declared.includes(capability)) {
    throw new FlightCapabilityNotSupportedError(capabilities.provider, capability, operation)
  }
}
