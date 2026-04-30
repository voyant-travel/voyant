/**
 * Public source-adapter contract — the seam through which any external feed
 * projects into the catalog plane.
 *
 * Implementations come from anywhere: Voyant Connect, a wholesaler's own
 * engineering team (e.g. TUI building a TUI-to-catalog adapter), a cruise
 * line's first-party feed, an operator's hand-rolled CSV importer, a
 * third-party integrator. No implementer is privileged.
 *
 * The contract is intentionally narrow at the edges (a small surface adapters
 * must implement) and broad at the center (the field-policy contract that
 * emitted projections must satisfy). This asymmetry maximizes who can build
 * an adapter while keeping every projection coherent.
 *
 * See `docs/architecture/catalog-architecture.md` §5.6 for the full design.
 */

import type { CatalogDriftEvent } from "../drift/events.js"
import type { Provenance } from "../provenance.js"

// ─────────────────────────────────────────────────────────────────────────────
// Connection lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capability declaration. Adapters return their capabilities at registration
 * so the catalog plane can route operations correctly and fail fast on
 * unsupported actions rather than producing wrong results silently.
 */
export interface AdapterCapabilities {
  /** Verticals this adapter feeds (e.g. ["products", "hospitality"]). */
  verticals: string[]
  /** Whether the adapter can resolve volatile-live fields on demand. */
  supportsLiveResolution: boolean
  /** Whether the adapter can emit drift events. */
  supportsDriftDetection: boolean
  /** Whether the adapter forwards bookings to the upstream source. */
  supportsBookingForwarding: boolean
  /** Post-book operations the adapter supports (modify, cancel, status, refund). */
  postBookOperations: ReadonlyArray<"modify" | "cancel" | "status" | "refund" | "exchange" | "void">
  /**
   * Optional internal-cache TTL hint in seconds. Source adapters may cache
   * volatile-live calls inside themselves; declaring the TTL lets the
   * catalog plane fail soft on staleness expectations without prescribing
   * the cache mechanism.
   */
  cacheTtlSeconds?: number | null
}

/** Connection lifecycle state. Aligned with §5.10's two-mode disconnect model. */
export type ConnectionState = "active" | "paused" | "disconnected" | "error"

/**
 * Context passed to every adapter call. Identifies the connection and may
 * carry credentials, tenant scope, and tracing identifiers.
 */
export interface SourceAdapterContext {
  /** Connection identifier (typed-id pointing at the connection record). */
  connection_id: string
  /**
   * Credentials bag, keyed by adapter convention. Templates pass these in;
   * adapters decode per their needs.
   */
  credentials?: Record<string, string>
  /** Optional tenant identifier when the adapter serves multiple tenants. */
  tenant_id?: string
  /** Correlation id for tracing across the catalog pipeline. */
  correlation_id?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery and projection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One emitted CatalogEntry projection. Carries provenance, the vertical's
 * shape, and the field-keyed values the adapter discovered.
 */
export interface CatalogProjection {
  entity_module: string
  entity_id: string
  provenance: Provenance
  /** Field-keyed source values (matches the vertical's field-policy paths). */
  fields: Record<string, unknown>
}

/**
 * Discovery cursor. Adapters with paginated upstreams use this to checkpoint
 * progress; opaque to the catalog plane.
 */
export type DiscoveryCursor = string | undefined

/** Discovery result page. */
export interface DiscoveryPage {
  projections: CatalogProjection[]
  next_cursor: DiscoveryCursor
}

// ─────────────────────────────────────────────────────────────────────────────
// Live resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live-resolve request. Carries enough context for the adapter to fetch
 * volatile-live values for one or more entities.
 */
export interface LiveResolveRequest {
  ids: string[]
  /** Variant scope for the request (mirrors the resolver's scope). */
  scope: {
    locale: string
    audience: string
    market: string
    currency?: string
  }
  /** Date range or other vertical-specific parameters. */
  parameters?: Record<string, unknown>
}

export interface LiveResolveResult {
  /** Entity-keyed live field values. */
  values: Record<string, Record<string, unknown>>
  /** Entities the adapter could not resolve, with reason codes. */
  failed?: Record<string, "timeout" | "not_found" | "unsupported" | "error">
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking forwarding
// ─────────────────────────────────────────────────────────────────────────────

export interface ReserveRequest {
  entity_module: string
  entity_id: string
  parameters: Record<string, unknown>
  /** Customer / passenger identity, vertical-shaped. */
  party?: Record<string, unknown>
  /** Payment intent for verticals that distinguish hold vs ticket. */
  payment_intent?: Record<string, unknown>
}

export interface ReserveResult {
  /** Upstream order / booking identifier — used as `source_ref` in snapshots. */
  upstream_ref: string
  /** Status returned by the upstream system. */
  status: "held" | "confirmed" | "ticketed" | "failed"
  /** Opaque per-vertical payload echoed back to the snapshot graph. */
  upstream_payload?: Record<string, unknown>
}

export interface CancelRequest {
  upstream_ref: string
  reason?: string
}

export interface CancelResult {
  status: "cancelled" | "refused" | "failed"
  refund_amount?: number
  refund_currency?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// The adapter contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public source-adapter contract. All implementations satisfy this same
 * surface — no implementer is privileged.
 *
 * Capability-gated methods (`liveResolve`, `reserve`, `cancel`, `modifyBooking`,
 * post-book operations) return `CAPABILITY_NOT_SUPPORTED` if the adapter
 * declares it does not support them, allowing the catalog plane to fail
 * fast rather than producing wrong results.
 */
export interface SourceAdapter {
  /** Adapter identifier (e.g. "voyant-connect", "direct:tui", "bedbank:hotelbeds"). */
  readonly kind: string

  /** Capability declaration. Static; returned at adapter construction. */
  readonly capabilities: AdapterCapabilities

  // ── Connection lifecycle ──────────────────────────────────────────────

  /** Establish the connection. Idempotent. */
  connect(ctx: SourceAdapterContext): Promise<void>

  /** Pause polling / events without destroying cached data (soft disconnect). */
  pause(ctx: SourceAdapterContext): Promise<void>

  /**
   * Hard disconnect — explicit admin action. Adapter releases credentials,
   * stops polling, declares itself disconnected. Catalog plane runs the
   * data-cleanup pipeline separately (see §5.10.3).
   */
  disconnect(ctx: SourceAdapterContext): Promise<void>

  /** Returns the adapter's current connection state. */
  getState(ctx: SourceAdapterContext): Promise<ConnectionState>

  // ── Discovery ─────────────────────────────────────────────────────────

  /**
   * Emit normalized projections of catalog entries the source provides.
   * Paginated; the adapter checkpoints progress via the opaque cursor.
   */
  discover(ctx: SourceAdapterContext, cursor?: DiscoveryCursor): Promise<DiscoveryPage>

  /**
   * Lightweight HEAD-equivalent for HTTP-cache revalidation. Returns the
   * source's current freshness marker without the full payload. Optional;
   * adapters that don't support it return `undefined`.
   */
  freshnessCheck?(
    ctx: SourceAdapterContext,
    entity_id: string,
  ): Promise<{ etag: string; updated_at: Date } | undefined>

  // ── Live resolution ───────────────────────────────────────────────────

  /**
   * Fetch volatile-live fields on demand (price quote, availability check,
   * inventory count). Capability-gated by `supportsLiveResolution`.
   */
  liveResolve?(ctx: SourceAdapterContext, request: LiveResolveRequest): Promise<LiveResolveResult>

  // ── Booking forwarding ────────────────────────────────────────────────

  /** Forward a reserve / book request to the upstream source. */
  reserve?(ctx: SourceAdapterContext, request: ReserveRequest): Promise<ReserveResult>

  /** Forward a cancel request. */
  cancel?(ctx: SourceAdapterContext, request: CancelRequest): Promise<CancelResult>

  // ── Drift signals ─────────────────────────────────────────────────────

  /**
   * Optional handle for the catalog plane to subscribe to drift events
   * detected by the adapter (push-based). Adapters that don't push drift
   * leave this undefined; the catalog plane falls back to scheduled
   * comparison passes.
   */
  onDrift?(handler: (event: CatalogDriftEvent) => void | Promise<void>): {
    unsubscribe(): void
  }
}

/**
 * Stable error code adapters return when a capability-gated method is
 * called but the capability is not declared. The catalog plane translates
 * this into structured error responses for callers.
 */
export const CAPABILITY_NOT_SUPPORTED = "CAPABILITY_NOT_SUPPORTED" as const

export class CapabilityNotSupportedError extends Error {
  readonly code = CAPABILITY_NOT_SUPPORTED
  constructor(
    public readonly adapter_kind: string,
    public readonly operation: string,
  ) {
    super(
      `adapter "${adapter_kind}" does not support operation "${operation}" (capability not declared)`,
    )
    this.name = "CapabilityNotSupportedError"
  }
}
