/**
 * Stable error codes returned from the booking engine.
 *
 * Mirrors the catalog plane's `CAPABILITY_NOT_SUPPORTED` convention:
 * codes are stable strings, callers branch on them, and each carries a
 * dedicated `Error` subclass for stack-trace clarity.
 */

/** No SourceAdapter was registered for the row's `source.kind`. */
export const NO_ADAPTER_REGISTERED = "NO_ADAPTER_REGISTERED" as const

/**
 * No OwnedBookingHandler was registered for the row's `entity_module`.
 * Sibling to `NO_ADAPTER_REGISTERED` — sourced rows dispatch through
 * adapters keyed by connection, owned rows dispatch through handlers
 * keyed by entity module. Per booking-journey-architecture §6.
 */
export const NO_HANDLER_REGISTERED = "NO_HANDLER_REGISTERED" as const

/** The supplied `quoteId` is unknown or already consumed. */
export const QUOTE_NOT_FOUND = "QUOTE_NOT_FOUND" as const

/** The quote's `expires_at` has passed; caller must re-quote. */
export const QUOTE_EXPIRED = "QUOTE_EXPIRED" as const

/** The quote's entity_module/entity_id doesn't match the book request. */
export const QUOTE_MISMATCH = "QUOTE_MISMATCH" as const

/** The adapter returned `failed` for the requested entity. */
export const RESERVE_FAILED = "RESERVE_FAILED" as const

/** No snapshot row exists for the given (booking_id, entity_*). */
export const ORDER_NOT_FOUND = "ORDER_NOT_FOUND" as const

/** The order has already been cancelled. */
export const ORDER_ALREADY_CANCELLED = "ORDER_ALREADY_CANCELLED" as const

/**
 * Snapshot content capture failed: neither a fresh adapter fetch nor a
 * cache fallback produced a content payload. Per sourced-content §5.1,
 * we deliberately fail the commit rather than snapshot from the
 * indexed projection — refunds and audit need real "what was sold"
 * content, not a stub.
 */
export const SNAPSHOT_CONTENT_UNAVAILABLE = "SNAPSHOT_CONTENT_UNAVAILABLE" as const

export type BookingEngineErrorCode =
  | typeof NO_ADAPTER_REGISTERED
  | typeof NO_HANDLER_REGISTERED
  | typeof QUOTE_NOT_FOUND
  | typeof QUOTE_EXPIRED
  | typeof QUOTE_MISMATCH
  | typeof RESERVE_FAILED
  | typeof ORDER_NOT_FOUND
  | typeof ORDER_ALREADY_CANCELLED
  | typeof SNAPSHOT_CONTENT_UNAVAILABLE

export class BookingEngineError extends Error {
  constructor(
    public readonly code: BookingEngineErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "BookingEngineError"
  }
}

export class NoAdapterRegisteredError extends BookingEngineError {
  /**
   * Thrown when the registry has no adapter for the given identifier.
   * The identifier is a connection id when dispatched per-connection
   * (channel push, sourced bookings with a known connection) or a source
   * kind when the caller has no connection id (legacy dispatch).
   */
  constructor(identifier: string) {
    super(NO_ADAPTER_REGISTERED, `no SourceAdapter registered for "${identifier}"`, {
      identifier,
    })
    this.name = "NoAdapterRegisteredError"
  }
}

export class NoOwnedHandlerRegisteredError extends BookingEngineError {
  /** Thrown when the owned-handler registry has no entry for the
   *  given `entity_module`. */
  constructor(entityModule: string) {
    super(NO_HANDLER_REGISTERED, `no OwnedBookingHandler registered for "${entityModule}"`, {
      entityModule,
    })
    this.name = "NoOwnedHandlerRegisteredError"
  }
}

export class QuoteExpiredError extends BookingEngineError {
  constructor(quoteId: string, expiredAt: Date) {
    super(QUOTE_EXPIRED, `quote ${quoteId} expired at ${expiredAt.toISOString()}`, {
      quoteId,
      expiredAt: expiredAt.toISOString(),
    })
    this.name = "QuoteExpiredError"
  }
}

export class QuoteMismatchError extends BookingEngineError {
  constructor(
    quoteId: string,
    expected: { entityModule: string; entityId: string },
    actual: { entityModule: string; entityId: string },
  ) {
    super(
      QUOTE_MISMATCH,
      `quote ${quoteId} is for ${expected.entityModule}:${expected.entityId} but book request is for ${actual.entityModule}:${actual.entityId}`,
      { quoteId, expected, actual },
    )
    this.name = "QuoteMismatchError"
  }
}

export class ReserveFailedError extends BookingEngineError {
  constructor(
    public readonly upstreamPayload: unknown,
    public readonly sourceKind: string,
    public readonly entityId: string,
  ) {
    super(RESERVE_FAILED, `adapter "${sourceKind}" returned failed status for ${entityId}`, {
      sourceKind,
      entityId,
      upstreamPayload,
    })
    this.name = "ReserveFailedError"
  }
}

export class SnapshotContentUnavailableError extends BookingEngineError {
  constructor(
    public readonly entityModule: string,
    public readonly entityId: string,
    public readonly fallbackReason: string,
  ) {
    super(
      SNAPSHOT_CONTENT_UNAVAILABLE,
      `cannot capture snapshot content for ${entityModule}:${entityId} — adapter fetch failed and no cache row available (reason: ${fallbackReason})`,
      { entityModule, entityId, fallbackReason },
    )
    this.name = "SnapshotContentUnavailableError"
  }
}
