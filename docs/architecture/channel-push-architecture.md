# Channel push — architecture

Status: draft / proposal — pre-implementation
Audience: anyone designing the outbound supplier integration that pushes booking commits, availability changes, and content updates from Voyant to upstream channels (TUI, Voyant Connect peers, GDS, OTAs).

This document specifies the **outbound** direction of supplier integration. Inbound — adapters fetching catalog projections, prices, and content from upstream — is covered in [`catalog-architecture.md`](./catalog-architecture.md) and [`catalog-sourced-content.md`](./catalog-sourced-content.md). Channel push is the inverse: when something happens on Voyant (booking commits, inventory changes, content edits), push that change to one or more upstream channels.

This is **v1 scope**, not future. Real deployments need to integrate with TUI, Voyant Connect peers, and similar systems where Voyant must keep upstream in sync — otherwise inventory double-books and customer support implodes.

## 1. Three flows worth distinguishing

Channel push is not one operation. Three distinct flows share the term:

1. **Booking push** — a customer commits a booking on Voyant; we push the booking to one or more upstream channels so they know that inventory is allocated.
2. **Availability push** — an owned product's slot remaining-pax changes (booking, cancellation, manual operator update); we push the new availability to channels that resell our inventory.
3. **Content push** — operator edits an owned product's content (description, photos, itinerary); we push the new content to channels for them to display.

Each has different semantics:
- Booking push is **per-booking**, transactional, must succeed (or the operator manually intervenes).
- Availability push is **per-slot-change**, frequent, idempotent on (slot, remainingPax), eventually-consistent.
- Content push is **per-product-edit**, infrequent, idempotent on the product version.

The three should share an adapter contract but should NOT share a code path — different retry/error semantics.

## 2. Existing primitives we compose

Per the booking-journey doc's "reuse before add" rule:

- **`SourceAdapter`** — already used for inbound. Extending it for outbound is the obvious move; the same connection holds credentials for both directions.
- **EventBus** — `packages/core/src/event-bus.ts`. `booking.confirmed`, `availability.changed`, `product.updated` events fire today; channel-push handlers subscribe.
- **Workflows** — `packages/core/src/workflows.ts`. Saga primitive with compensation. Channel push for a booking that fans out to multiple channels uses this for rollback on partial push failure.
- **Webhooks** — `webhook_subscriptions` / `webhook_deliveries` schemas already model outbound HTTP calls with retries. Channel push could ride on this infrastructure for the simple case (HTTP webhook to an upstream URL).
- **Bookings module's `bookingChannelLinks`** — if a table linking bookings to upstream channel refs doesn't exist yet, we'd add it (see §6).
- **Products' `external_refs`** — `packages/external-refs/` already models per-entity upstream identifiers. Channel push reads these to know which upstream id to push to.

## 3. Adapter contract extension

`SourceAdapter` gains three optional outbound methods, mirroring the three flows:

```ts
export interface SourceAdapter {
  // ... existing inbound methods ...

  /**
   * Push a booking commit to the upstream channel. Called by the
   * booking-engine post-commit subscriber when a booking commits
   * against a product that's syndicated to this channel.
   *
   * Idempotent on `idempotency_key` — the engine generates a stable
   * key from (booking_id, channel_id) so retries don't double-push.
   *
   * Returns the upstream channel's reference id, which the engine
   * stores in booking_channel_links for subsequent ops (modify,
   * cancel) against the same upstream booking.
   */
  pushBooking?(
    ctx: SourceAdapterContext,
    request: PushBookingRequest,
  ): Promise<PushBookingResult>

  /**
   * Push an availability change for one or more slots. Idempotent on
   * (slot_id, remaining_pax) — pushing the same value twice is a no-op
   * upstream. Called by an availability-changed event subscriber.
   */
  pushAvailability?(
    ctx: SourceAdapterContext,
    request: PushAvailabilityRequest,
  ): Promise<PushAvailabilityResult>

  /**
   * Push a content update. Idempotent on (entity_id, content_version).
   * Called by a product-updated event subscriber. Content shape mirrors
   * GetContentResult from catalog-sourced-content.md (same vertical-
   * specific payload, just outbound).
   */
  pushContent?(
    ctx: SourceAdapterContext,
    request: PushContentRequest,
  ): Promise<PushContentResult>
}

export interface AdapterCapabilities {
  // ... existing ...
  /** Whether the adapter accepts booking pushes from us. */
  supportsBookingPush?: boolean
  /** Whether the adapter accepts availability pushes from us. */
  supportsAvailabilityPush?: boolean
  /** Whether the adapter accepts content pushes from us. */
  supportsContentPush?: boolean
}
```

Sourced-only adapters (TUI direct API where we sell their inventory) declare all three as `false`. Channel adapters (a Voyant Connect peer where we sell our inventory through them, or TUI's reseller API) declare the relevant ones as `true`.

**Important contract distinction:** an adapter can be inbound-only, outbound-only, or both:

- **Inbound-only**: bedbank that sells us hotel inventory. We display + book; they don't care about our bookings.
- **Outbound-only**: a channel where we syndicate our owned products. They sell our stuff; we never source from them.
- **Bidirectional**: a Voyant Connect peer who both sells us things AND resells our things.

The same adapter package may declare both directions, sharing one `connection_id` and credentials.

## 4. Booking push flow

Triggered by a `booking.confirmed` event. The handler:

1. Reads the booking's `bookingItems` and resolves each item's product → upstream channel mappings (via `bookingChannelLinks` lookup or product's `external_refs`).
2. For each (booking_item × channel) pair: if the channel's adapter declares `supportsBookingPush: true`, enqueue a push.
3. Pushes run in a workflow (`@voyantjs/core/workflows`) with per-channel compensation. If a channel fails repeatedly (after the adapter's retry budget), the saga marks that channel's link as `push_failed`, surfaces the failure to operators, and (depending on policy) either rolls back the booking or continues with the channels that succeeded.
4. On success, the workflow writes a `bookingChannelLinks` row with the upstream's reference id and `push_status: ok`.

```ts
// Pseudocode
eventBus.subscribe<BookingConfirmedPayload>("booking.confirmed", async ({ data }) => {
  const channels = await resolveChannelsForBooking(db, data.bookingId)
  if (channels.length === 0) return // owned product not syndicated; nothing to push
  await runWorkflow(channelPushWorkflow, { bookingId: data.bookingId, channels })
})
```

For multi-line bookings (composer-driven, per `booking-journey-architecture.md` §0.5), the push happens per line: each line's product has its own channel mapping; the saga fans out per (line × channel).

## 5. Availability push flow

Triggered by `availability.slot.changed` events fired when:

- A booking commits (debits the slot).
- A booking cancels (credits back).
- An operator edits the slot manually.
- A scheduled refresh recomputes effective availability.

The handler reads the new slot state, resolves which channels syndicate this product, and pushes to each. Eventually-consistent — losing a single push event isn't catastrophic, but repeated drift causes overbooking.

For channels with high-frequency syndication (TUI bedbank-style with sub-minute SLAs), the events fire in real time. For lower-frequency channels, batching every N minutes is acceptable.

Idempotency: the upstream usually accepts `(slot_id, remaining_pax, version)` as the natural key; pushing the same triple twice is a no-op. The adapter must be implemented to be safely retriable.

## 6. Content push flow

Triggered by `product.updated` events. Lower volume than availability; usually triggered by operator content edits.

The push payload mirrors what the inbound `getContent` adapter method returns (per `catalog-sourced-content.md`) — same vertical-specific shape, just outbound. Channels store our updates and re-render their own listing pages.

Versioned: each content push carries a `content_version` (monotonic per product). Upstream channels can deduplicate / reject older versions if they receive them out of order.

## 7. Schema additions

```sql
-- packages/bookings/src/schema-channels.ts (new)
booking_channel_links (
  id                    text pk           -- typeid: bcli
  booking_item_id       text not null     -- per-item, not per-booking; fan-out granularity
  channel_id            text not null     -- which channel this push targets
  source_kind           text not null     -- "voyant-connect", "direct:tui", etc.
  source_connection_id  text              -- specific connection
  upstream_ref          text              -- channel's reference id once push succeeds
  push_status           text not null     -- "pending" | "ok" | "failed" | "compensated"
  push_attempts         integer not null default 0
  last_push_at          timestamptz
  last_error            text
  pushed_payload_hash   text              -- detect drift in subsequent pushes
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()
)
-- index on (booking_item_id, channel_id) unique
-- index on (push_status, last_push_at) for retry sweepers

-- packages/products/src/schema-channels.ts (new)
product_channel_mappings (
  id                    text pk
  product_id            text not null
  channel_id            text not null
  source_kind           text not null
  source_connection_id  text not null
  upstream_product_ref  text not null     -- the channel's id for this product
  active                boolean not null default true
  push_availability     boolean not null default true
  push_content          boolean not null default true
  push_bookings         boolean not null default true
  -- per-mapping policy: which fields get pushed, override priority, etc.
  policy                jsonb
  created_at            timestamptz not null default now()
  updated_at            timestamptz not null default now()
)
```

This adds two tables to existing modules (`packages/bookings`, `packages/products`). They're not in the catalog plane — channel mappings are a per-vertical operational concern; the catalog plane stays neutral.

## 8. The owned-arm + channel push interaction

In the booking journey's `OwnedBookingHandler.commit` (per `booking-journey-architecture.md` §6), the commit is atomic against the local DB (booking + travelers + payment schedules + snapshot). **Channel push runs AFTER commit, asynchronously, via the event subscriber.** The booking is durable locally even if channel push fails; ops gets a notification and can retry or compensate manually.

This is the right separation:
- **Synchronous (commit):** local booking row, snapshot, voucher redemption, group membership. All-or-nothing within one transaction.
- **Asynchronous (post-commit):** channel push, notifications, webhook delivery, document generation. Eventually-consistent, retryable, independently failing.

For sourced bookings (where the upstream IS the source of truth), the engine's existing `adapter.reserve` path does the equivalent — the upstream commit is part of the synchronous flow, and there's no separate channel push because the source IS the channel. Owned bookings need channel push as a separate post-commit concern; sourced bookings don't.

## 9. Failure modes

The hard cases:

1. **Booking commits locally; push fails on all channels.** The operator has a booking in their system that the upstream doesn't know about. Surface: alert in operator dashboard's "channel sync failures" view + retry button. Policy: don't auto-cancel the booking; operator decides.
2. **Booking commits locally; push fails on some channels.** Partial sync. The successful channels know about the booking; the failed ones don't, and may double-book. Same surface; ops decides whether to roll back the booking or continue retrying.
3. **Push succeeds; the upstream later modifies/cancels the booking.** Inbound webhook from the channel. Voyant updates the local booking; user sees the change. This is the inverse direction (channel → us) covered by the existing `webhook_subscriptions` infrastructure.
4. **Availability push falls behind.** The channel oversells. Generally the channel's responsibility; we provide push retries with backoff. SLA negotiation per channel.
5. **Content push includes a field the channel doesn't accept.** Adapter returns a structured rejection; we record it on the `product_channel_mappings.policy`'s warnings. Operator sees a "channel rejected: X" badge in admin.

## 10. Migration / rollout

**Phase A — Adapter contract extension** (1 day):
- Add the three optional outbound methods + capability flags to `SourceAdapter`.
- Pure typing change.

**Phase B — Booking push for one channel kind** (3-4 days):
- Add `booking_channel_links` and `product_channel_mappings` schemas.
- Implement `pushBookingWorkflow` using `@voyantjs/core/workflows` with per-channel compensation.
- Wire `booking.confirmed` event subscriber.
- Demo adapter (in `apps/catalog-demo-api` + `@voyantjs/plugin-catalog-demo`) gains an optional `POST /bookings` endpoint that records pushed bookings, so the operator can verify the round-trip end-to-end without an external integration.

**Phase C — Availability push** (2-3 days):
- Wire `availability.slot.changed` event subscriber.
- Implement `pushAvailabilityWorkflow` (lighter than booking push — eventually consistent, no compensation).
- Demo adapter gains an availability sink.

**Phase D — Content push** (2-3 days):
- Wire `product.updated` event subscriber.
- Versioned content payloads.
- Demo adapter content sink.

**Phase E — First real channel adapter** (per integration; 5-10 days each):
- Implement the contract for a real upstream — TUI, a Voyant Connect peer, etc.
- Each integration's auth, rate limits, and content-shape translation are upstream-specific work that lands per channel.

Phases A-D give us the **channel-push framework**; Phase E onward is per-channel integration work that scales with the number of channels we support.

## 11. Non-goals (v1)

- **Bidirectional content reconciliation.** If a channel edits content downstream and pushes back, we don't merge today. The operator's Voyant edit is the source of truth for owned products; channels are read-only consumers. Resolving conflicts when channels can also edit is a follow-up.
- **Per-traveler PII push.** v1 push payloads include the booking shape but redact encrypted travel details. The channel pulls those via a separate authenticated read on demand if it needs them. Lets us avoid pushing PII through the saga and keeps the audit shape simpler.
- **Real-time bidirectional inventory sync.** Eventually-consistent is the contract for v1. Sub-second sync is a v2 conversation about message brokers and durable queues.
- **Channel-push for sourced bookings.** Sourced bookings already commit upstream via `adapter.reserve`; there's no separate channel push because the source IS the channel.

## 12. Open questions

1. **Where does `booking_channel_links` actually live?** Bookings module makes sense (it's a per-booking-item concern). But it implies bookings depends on channel concepts. Acceptable since most channel work *is* booking-related, but worth confirming.
2. **Webhook-delivery infrastructure reuse.** The `webhook_deliveries` table already models retried HTTP outbound calls. Should channel push ride on top, or is its retry/compensation policy too different (workflow saga vs. simple retry queue)? Probably channel push uses workflows for booking push (compensation matters) and webhook-deliveries for availability/content push (idempotent retries are enough).
3. **Per-channel rate-limit awareness.** Channels often have rate limits we must respect. The push workflow needs a rate-limiter per (channel, source_connection_id). Standard pattern; not in this doc's scope but flagged.
4. **What's `channel_id`?** A new lookup table, or a synthetic id derived from `(source_kind, source_connection_id)`? Lean toward synthetic — fewer tables, fewer joins.
5. **Bidirectional adapter packaging.** When one upstream is both inbound and outbound, does the same `SourceAdapter` instance carry all methods, or do we ship two adapters per connection? One instance is simpler; that's what the contract assumes today.

## 13. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — Phase 1 inbound contract. Channel push extends the same `SourceAdapter` contract for outbound.
- [`catalog-sourced-content.md`](./catalog-sourced-content.md) — inbound content fetch. Sibling to this doc; same adapter contract, opposite direction.
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the engine's commit triggers the booking push subscriber.
- [`booking-journey-architecture.md`](./booking-journey-architecture.md) — channel push runs post-commit; the journey itself doesn't see it.
