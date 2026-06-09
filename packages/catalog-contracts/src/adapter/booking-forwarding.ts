export interface SourceAdapterRequestScope {
  locale: string
  audience: string
  market: string
  currency?: string
}

export interface ReserveRequest {
  entity_module: string
  entity_id: string
  /**
   * Vertical-specific selection. Free-form, but adapters recognize well-known
   * keys such as departure/date/pax fields and, for sourced stays/packages,
   * `roomTypeId` / `ratePlanId` / `board` to re-resolve the exact room + rate
   * the operator picked. The per-search offer id is not replay-safe.
   */
  parameters: Record<string, unknown>
  /** Customer / passenger identity, vertical-shaped. */
  party?: Record<string, unknown>
  /** Payment intent for verticals that distinguish hold vs ticket. */
  payment_intent?: Record<string, unknown>
  /** Per-request scope. Mirrors `LiveResolveRequest.scope`. */
  scope?: SourceAdapterRequestScope
  /** Replay-safe write key. Same key on retries means same upstream effect. */
  idempotency_key?: string
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
  /** Per-request scope. Mirrors `LiveResolveRequest.scope`. */
  scope?: SourceAdapterRequestScope
  /** Replay-safe write key. Same key on retries means same upstream effect. */
  idempotency_key?: string
}

export interface CancelResult {
  status: "cancelled" | "pending" | "refused" | "failed"
  refund_amount?: number
  refund_currency?: string
  /**
   * Free-text channel through which an async cancellation was submitted
   * when `status` is "pending" (email, partner portal, batch, etc.).
   */
  pending_channel?: string
}
