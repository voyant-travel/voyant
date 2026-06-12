// agent-quality: file-size exception -- owner: catalog-contracts; existing module stays co-located until a dedicated split preserves behavior and tests.
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
import type {
  CancelRequest,
  CancelResult,
  ReserveRequest,
  ReserveResult,
  SourceAdapterRequestScope,
} from "./booking-forwarding.js"
import type {
  PushAvailabilityRequest,
  PushAvailabilityResult,
  PushBookingRequest,
  PushBookingResult,
  PushContentRequest,
  PushContentResult,
} from "./channel-push-contracts.js"
import type { ProviderCapabilityDeclaration } from "./provider-contracts.js"

export type {
  CancelRequest,
  CancelResult,
  ReserveRequest,
  ReserveResult,
  SourceAdapterRequestScope,
} from "./booking-forwarding.js"
export type {
  PushAvailabilityRequest,
  PushAvailabilityResult,
  PushBookingRequest,
  PushBookingResult,
  PushContentRequest,
  PushContentResult,
} from "./channel-push-contracts.js"
export type {
  AvailabilityBadge,
  AvailabilityBadgeKind,
  AvailabilityProjection,
  AvailabilityRowKind,
  AvailabilityStatus,
  AvailabilityUnitPrecision,
  CapabilitySupport,
  PromotionApplicability,
  PromotionApplicabilityConstraint,
  PromotionApplicabilityConstraintKind,
  PromotionApplicabilityEvaluation,
  PromotionApplicabilityResolution,
  PromotionDisplayFields,
  PromotionMediaAsset,
  PromotionMediaKind,
  PromotionPriceEffect,
  PromotionStackingSemantics,
  ProviderCapabilityDeclaration,
  ProviderCapabilityKey,
  ProviderPromotion,
} from "./provider-contracts.js"

// ─────────────────────────────────────────────────────────────────────────────
// Reservation retrieval
// ─────────────────────────────────────────────────────────────────────────────

export interface GetReservationRequest {
  upstream_ref: string
  scope?: SourceAdapterRequestScope
}

export type ReservationStatus = ReserveResult["status"] | CancelResult["status"] | "cancelling"

export interface GetReservationResult {
  upstream_ref: string
  status: ReservationStatus
  /** When the upstream itself last modified this reservation. */
  source_updated_at?: Date
  /** Opaque per-vertical payload (itinerary, pricing snapshot, traveler details). */
  upstream_payload?: Record<string, unknown>
}

export interface ListReservationsQuery {
  cursor?: DiscoveryCursor
  limit?: number
  /** Filter by status. Empty / omitted means all statuses. */
  status?: ReadonlyArray<ReservationStatus>
  /** Incremental sync helper — return reservations modified since this instant. */
  updated_after?: Date
  scope?: SourceAdapterRequestScope
}

export interface ListReservationsPage {
  reservations: GetReservationResult[]
  next_cursor: DiscoveryCursor
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capability declaration. Adapters return their capabilities at registration
 * so the catalog plane can route operations correctly and fail fast on
 * unsupported actions rather than producing wrong results silently.
 *
 * Adapters can be inbound-only (sourcing inventory we sell), outbound-only
 * (channels where we syndicate our owned products), or bidirectional. The
 * `supports*` flags below cover both directions; inbound flags gate
 * `liveResolve`/`getContent`/`reserve`/`cancel`, outbound flags gate
 * `pushBooking`/`pushAvailability`/`pushContent`.
 *
 * See `docs/architecture/channel-push-architecture.md` §3.
 */
export interface AdapterCapabilities {
  /** Verticals this adapter feeds (e.g. ["products", "accommodations"]). */
  verticals: string[]
  /** Whether the adapter can resolve volatile-live fields on demand. */
  supportsLiveResolution: boolean
  /** Whether the adapter can emit drift events. */
  supportsDriftDetection: boolean
  /** Whether the adapter forwards bookings to the upstream source. */
  supportsBookingForwarding: boolean
  /**
   * Whether the adapter can retrieve upstream reservations on demand.
   * Gates `getReservation` and `listReservations`.
   */
  supportsReservationRetrieval?: boolean
  /**
   * Whether `cancel` returns a terminal upstream status synchronously.
   * When false, the adapter may return `status: "pending"` and drive the
   * final transition later through drift, polling, or connector-specific
   * reconciliation.
   */
  supportsSyncCancellation?: boolean
  /** Post-book operations the adapter supports (modify, cancel, status, refund). */
  postBookOperations: ReadonlyArray<"modify" | "cancel" | "status" | "refund" | "exchange" | "void">
  /**
   * Optional internal-cache TTL hint in seconds. Source adapters may cache
   * volatile-live calls inside themselves; declaring the TTL lets the
   * catalog plane fail soft on staleness expectations without prescribing
   * the cache mechanism.
   */
  cacheTtlSeconds?: number | null
  /**
   * Whether the adapter implements `getContent` (rich detail-page content
   * for sourced rows: itinerary, media, options, terms). When false, the
   * catalog plane synthesizes thin content from the indexed projection +
   * editorial overlay instead of calling the adapter.
   *
   * See `docs/architecture/catalog-sourced-content.md` §3.1.
   */
  supportsContentFetch?: boolean
  /**
   * BCP 47 language tags this connection can serve content in. The catalog
   * plane uses this to plan backfills (preload deployment-configured
   * locales) and to render an empty-state when the requested locale is not
   * supported. Empty / absent → unknown; the plane probes per-call.
   */
  supportedContentLocales?: ReadonlyArray<string>
  /**
   * When true, the adapter owns its content cache. The catalog plane treats
   * `getContent` as pass-through: reads call the adapter directly, skip
   * `*_sourced_content` cache reads/writes, and do not serve SWR fallback rows.
   *
   * Default false: the catalog plane owns the sourced-content cache.
   */
  ownsContentCache?: boolean
  /**
   * When true, the adapter owns its availability / live-resolve cache. The
   * catalog plane treats `liveResolve` as pass-through and must not memoize
   * live availability results.
   *
   * Default false.
   */
  ownsAvailabilityCache?: boolean

  /**
   * Per-supplier hold-release grace period in milliseconds. When the
   * booking-journey reaper finds an expired draft, it defers calling
   * the supplier's release primitive until `expires_at + grace` has
   * passed.
   *
   * Cruise lines and luxury suppliers commonly hold capacity for
   * 24–72h after a journey times out to handle "I'll be right back"
   * scenarios; mass-market verticals release immediately.
   *
   * Per booking-journey-architecture §12.9. Default `0` (immediate
   * release).
   */
  holdReleaseGraceMs?: number

  // ── Outbound (channel push) ───────────────────────────────────────────
  // Per channel-push-architecture §3. Three independent flags so an
  // adapter can opt into each push direction independently.

  /** Whether the adapter accepts booking commits pushed from us. */
  supportsBookingPush?: boolean
  /** Whether the adapter accepts availability changes pushed from us. */
  supportsAvailabilityPush?: boolean
  /** Whether the adapter accepts content updates pushed from us. */
  supportsContentPush?: boolean

  /**
   * Provider-specific capability and limitation facts that are more granular
   * than method-level gates. These rows are advisory but explicit: a provider
   * can declare category inventory counts as supported while declaring exact
   * physical inventory units as unsupported.
   */
  providerCapabilities?: ReadonlyArray<ProviderCapabilityDeclaration>
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
  scope: SourceAdapterRequestScope
  /**
   * Date range or other vertical-specific parameters. Adapters recognize
   * well-known keys such as date/pax fields and, for sourced stays/packages,
   * `roomTypeId` / `ratePlanId` / `board` to re-resolve the exact room + rate
   * the operator picked.
   */
  parameters?: Record<string, unknown>
}

export interface LiveResolveResult {
  /** Entity-keyed live field values. */
  values: Record<string, Record<string, unknown>>
  /** Entities the adapter could not resolve, with reason codes. */
  failed?: Record<
    string,
    | "timeout"
    | "not_found"
    | "unavailable"
    | "departure_not_found"
    | "departure_unavailable"
    | "unsupported"
    | "error"
  >
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich content
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get-content request. Asks the adapter for one entity's full detail-page
 * content (itinerary, media, options, terms, room types, departures) in one
 * locale. Distinct from `liveResolve` — this returns durable content, not
 * volatile-live values.
 *
 * The catalog plane's content cache calls this on a refresh cadence (TTL or
 * drift event) and stores the result in the per-vertical, per-locale
 * content table.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.1.
 */
export interface GetContentRequest {
  entity_module: string
  entity_id: string
  /**
   * BCP 47 language tag (e.g. "ro-RO", "de-DE", "en-GB"). Required —
   * locale is load-bearing in this contract. Adapters that genuinely have
   * only one locale accept any value and return their canonical content
   * with `returned_locale` pointing at what they actually have. The
   * contract is "tell me your best for this locale" — never "give me
   * whatever you have."
   */
  locale: string
  /** Other scope axes — kept separate from locale for clarity. */
  market?: string
  currency?: string
}

export interface GetContentResult {
  entity_module: string
  entity_id: string
  source_ref: string
  /**
   * The locale this payload is in. May differ from `request.locale` when
   * the upstream did its own fallback (e.g. requested ro-RO, returned
   * en-GB because it had no Romanian content). The catalog plane records
   * this so subsequent fallback decisions know what's actually cached vs.
   * what was requested.
   */
  returned_locale: string
  /**
   * True when the upstream marks the payload as machine-translated (rather
   * than authored content). Read paths can opt out of machine-translated
   * rows for ops-side views.
   */
  machine_translated?: boolean
  /**
   * Vertical-specific content payload. The catalog plane treats it as
   * opaque; the vertical's content service knows how to read it (and
   * validates against `content_schema_version` before writing to the
   * cache). The shape is the vertical's existing owned-content shape (e.g.
   * for products: `{ product, options[], days[], media[] }`).
   */
  content: unknown
  /**
   * Vertical-managed schema version of the `content` payload (e.g.
   * "products/v3", "cruises/v1"). Cache writes are gated on the vertical's
   * validator for this version; cache reads ignore rows with an unknown /
   * older version. Lets us evolve content shapes without invalidating /
   * mass-rewriting cache rows.
   */
  content_schema_version: string
  /**
   * When the upstream itself last modified this content (their
   * `updated_at`, ETag-derived timestamp, etc.). Used by the reconciler /
   * drift detector and by snapshot audit trails.
   */
  source_updated_at?: Date
  /**
   * When the upstream considers this content fresh until. Hint for the
   * catalog plane's cache; not load-bearing if absent.
   */
  fresh_until?: Date
  /** ETag-style marker for HTTP-cache revalidation on the next pull. */
  etag?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// The adapter contract
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public source-adapter contract. All implementations satisfy this same
 * surface — no implementer is privileged. Adapters can be inbound-only,
 * outbound-only (channel push to a syndication target), or bidirectional
 * (per channel-push-architecture §3). Every method except `kind` and
 * `capabilities` is optional: presence is the gate for inbound methods,
 * the new outbound methods are gated by their `supports*Push` capability
 * flags so the channel-push pipeline can reject calls before dispatching.
 */
export interface SourceAdapter {
  /** Adapter identifier (e.g. "voyant-connect", "direct:tui", "bedbank:hotelbeds"). */
  readonly kind: string

  /** Capability declaration. Static; returned at adapter construction. */
  readonly capabilities: AdapterCapabilities

  // ── Connection lifecycle ──────────────────────────────────────────────
  // All optional — outbound-only adapters (channels we syndicate to but
  // never source from) leave these undefined.

  /** Establish the connection. Idempotent. */
  connect?(ctx: SourceAdapterContext): Promise<void>

  /** Pause polling / events without destroying cached data (soft disconnect). */
  pause?(ctx: SourceAdapterContext): Promise<void>

  /**
   * Hard disconnect — explicit admin action. Adapter releases credentials,
   * stops polling, declares itself disconnected. Catalog plane runs the
   * data-cleanup pipeline separately (see §5.10.3).
   */
  disconnect?(ctx: SourceAdapterContext): Promise<void>

  /** Returns the adapter's current connection state. */
  getState?(ctx: SourceAdapterContext): Promise<ConnectionState>

  // ── Discovery ─────────────────────────────────────────────────────────

  /**
   * Emit normalized projections of catalog entries the source provides.
   * Paginated; the adapter checkpoints progress via the opaque cursor.
   * Optional — outbound-only adapters leave this undefined.
   */
  discover?(ctx: SourceAdapterContext, cursor?: DiscoveryCursor): Promise<DiscoveryPage>

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

  // ── Rich content ──────────────────────────────────────────────────────

  /**
   * Fetch rich entity content for one entity, in one locale. Returns the
   * durable detail-page content (itinerary, media, options, terms) — NOT
   * volatile-live values (`liveResolve` covers those).
   *
   * Capability-gated by `supportsContentFetch`. Adapters that don't
   * implement this leave it undefined; the catalog plane synthesizes thin
   * content from the indexed projection + editorial overlay instead.
   *
   * See `docs/architecture/catalog-sourced-content.md` §3.1.
   */
  getContent?(ctx: SourceAdapterContext, request: GetContentRequest): Promise<GetContentResult>

  // ── Booking forwarding (inbound — sourced bookings) ───────────────────

  /** Forward a reserve / book request to the upstream source. */
  reserve?(ctx: SourceAdapterContext, request: ReserveRequest): Promise<ReserveResult>

  /** Forward a cancel request. */
  cancel?(ctx: SourceAdapterContext, request: CancelRequest): Promise<CancelResult>

  /**
   * Fetch one reservation by upstream reference. Capability-gated by
   * `supportsReservationRetrieval`. Returns `null` when the upstream cannot
   * find the reservation; transport / auth errors should reject.
   */
  getReservation?(
    ctx: SourceAdapterContext,
    request: GetReservationRequest,
  ): Promise<GetReservationResult | null>

  /**
   * Paginated list of reservations attributed to this connection. Capability-
   * gated by `supportsReservationRetrieval`; supports pagination, status
   * filtering, and incremental sync by `updated_after`.
   */
  listReservations?(
    ctx: SourceAdapterContext,
    query: ListReservationsQuery,
  ): Promise<ListReservationsPage>

  // ── Channel push (outbound — owned product syndication) ──────────────
  // Per channel-push-architecture §3. Each method is independently
  // capability-gated; the channel-push pipeline checks the corresponding
  // `supports*Push` flag before dispatching.

  /**
   * Push a booking commit to the upstream channel. Called by the
   * channel-push booking workflow when a booking commits against an
   * owned product syndicated to this channel. Idempotent on
   * `request.idempotencyKey`.
   *
   * Capability-gated by `supportsBookingPush`.
   */
  pushBooking?(ctx: SourceAdapterContext, request: PushBookingRequest): Promise<PushBookingResult>

  /**
   * Push an availability change for one slot. Idempotent on
   * `(slotId, remainingPax)` — pushing the same value twice is a no-op
   * upstream.
   *
   * Capability-gated by `supportsAvailabilityPush`.
   */
  pushAvailability?(
    ctx: SourceAdapterContext,
    request: PushAvailabilityRequest,
  ): Promise<PushAvailabilityResult>

  /**
   * Push a content update. Idempotent on `(productId, contentHash)`.
   * Content shape mirrors `GetContentResult` (same vertical-specific
   * payload, just outbound).
   *
   * Capability-gated by `supportsContentPush`.
   */
  pushContent?(ctx: SourceAdapterContext, request: PushContentRequest): Promise<PushContentResult>

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

/**
 * Stable code an adapter throws when an upstream returns 429
 * (Too Many Requests). The channel-push pipeline catches this,
 * drains the local rate-limit bucket per `Retry-After`, and stamps the
 * delivery row with `error_class = "rate_limited"` so the bucket
 * self-corrects when our outbound estimate drifts from reality.
 *
 * Per docs/architecture/channel-push-architecture.md §14.4.
 */
export const ADAPTER_RATE_LIMITED = "ADAPTER_RATE_LIMITED" as const

export class AdapterRateLimitedError extends Error {
  readonly code = ADAPTER_RATE_LIMITED
  constructor(
    public readonly adapter_kind: string,
    /**
     * Milliseconds to wait before the next attempt, derived from the
     * upstream's `Retry-After` response header (seconds → ms) or the
     * adapter's own backoff hint. The processor uses this to drain the
     * shared rate-limit bucket so concurrent dispatchers also back off.
     */
    public readonly retryAfterMs: number,
    /** Optional context — e.g. which endpoint hit the limit. */
    public readonly operation?: string,
    /** Optional upstream payload echoed for diagnostics. */
    public readonly upstreamPayload?: unknown,
  ) {
    super(
      `adapter "${adapter_kind}" rate-limited${operation ? ` on "${operation}"` : ""} (retry after ${retryAfterMs}ms)`,
    )
    this.name = "AdapterRateLimitedError"
  }
}
