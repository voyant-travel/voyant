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
- **`webhook_subscriptions`** (already exists, `packages/db/src/schema/infra/webhook_subscriptions.ts`) — control-plane configuration for outbound webhook subscriptions: URL, events, secret, max retries, failure count. **`webhook_deliveries`** does NOT exist yet (the typeid prefix `whde` is reserved but no table backs it). Channel push is the first concrete consumer that needs an outbound delivery log, so we build it now as part of this work — see §11. It's designed to be a generic primitive (any module making outbound HTTP calls writes to it for observability + retry-chain history), not channel-specific. Distinct from `channel_webhook_events` (which logs events received **from** channels — inbound, opposite direction).
- **`packages/distribution`** — **the home for channel push.** Already ships:
  - `channels` (kind, status, metadata) and `channel_contracts` (per-channel commercial terms)
  - `channel_product_mappings` (id, channelId, productId, externalProductId, externalRateId, externalCategoryId, active)
  - `channel_booking_links` (id, channelId, bookingId, externalBookingId, externalReference, externalStatus, lastSyncedAt)
  - `channel_webhook_events` (inbound side: events received from channels)
  - `channel_commission_rules`, `channel_inventory_allotments`, `channel_reconciliation_items`
  - `distributionBookingExtension` HonoExtension — the canonical "extend bookings without bookings depending on us" pattern (matches `bookingProductExtension`, `bookingCrmExtension`, etc.)

  This means channel push is **net-new code over an existing module**, not a new module. Bookings and products stay clean of channel concepts; distribution depends on them via the established extension pattern.
- **Products' `external_refs`** — `packages/external-refs/` already models per-entity upstream identifiers. A complement to `channel_product_mappings` for cases where we identify a product across systems but don't actively syndicate it.

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
   * stores in `channel_booking_links` (in distribution) for subsequent
   * ops (modify, cancel) against the same upstream booking.
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

1. Reads the booking's `bookingItems` and resolves each item's product → upstream channel mappings via `channel_product_mappings` (in distribution).
2. For each (booking_item × channel) pair where the mapping has `push_bookings = true` and the channel's adapter declares `supportsBookingPush: true`, enqueue a push.
3. Pushes run in a workflow (`@voyantjs/core/workflows`) with per-channel compensation. If a channel fails repeatedly (after the adapter's retry budget), the saga marks that channel's link as `push_status = 'failed'`, surfaces the failure to operators, and (depending on policy) either rolls back the booking or continues with the channels that succeeded.
4. On success, the workflow upserts a `channel_booking_links` row (scoped by `booking_item_id` for fan-out) with the upstream's reference id and `push_status = 'ok'`.

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

## 7. Schema changes

Channel push **does not add new tables**. It extends two tables that already exist in `packages/distribution` (`channel_booking_links` and `channel_product_mappings`) with operational push fields. Additive migration; no breaking changes.

### 7.1. `channel_booking_links` — additive columns

```sql
-- packages/distribution/src/schema-core.ts (extend existing table)
ALTER TABLE channel_booking_links
  ADD COLUMN booking_item_id      text,                          -- nullable; null = booking-level link
  ADD COLUMN source_kind          text,                          -- mirrors adapter kind for routing
  ADD COLUMN source_connection_id text,
  ADD COLUMN push_status          text NOT NULL DEFAULT 'pending', -- "pending" | "ok" | "failed" | "compensated"
  ADD COLUMN push_attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN last_push_at         timestamptz,
  ADD COLUMN last_error           text,
  ADD COLUMN pushed_payload_hash  text;                          -- detect drift in subsequent pushes

CREATE INDEX idx_channel_booking_links_push_status
  ON channel_booking_links (push_status, last_push_at);
CREATE INDEX idx_channel_booking_links_booking_item
  ON channel_booking_links (booking_item_id) WHERE booking_item_id IS NOT NULL;
```

`booking_item_id` is nullable: existing rows (booking-level) keep working; new fan-out-per-item rows fill it in. A booking that syndicates one line to channel A and another line to channel B has two rows, each scoped by `booking_item_id`. A booking that fully syndicates to one channel has either one row with `booking_item_id = NULL` or one row per item — operator policy.

### 7.2. `channel_product_mappings` — additive columns

```sql
-- packages/distribution/src/schema-core.ts (extend existing table)
ALTER TABLE channel_product_mappings
  ADD COLUMN source_kind          text,                          -- "voyant-connect", "direct:tui", etc.
  ADD COLUMN source_connection_id text,
  ADD COLUMN push_availability    boolean NOT NULL DEFAULT true,
  ADD COLUMN push_content         boolean NOT NULL DEFAULT true,
  ADD COLUMN push_bookings        boolean NOT NULL DEFAULT true,
  ADD COLUMN policy               jsonb;                         -- per-mapping policy (rate caps, field include/exclude)
```

The existing columns (`externalProductId`, `externalRateId`, `externalCategoryId`, `active`) already cover the upstream-identifier shape; the new columns add per-mapping push toggles and policy.

### 7.3. Why no new package, no new module

Distribution is purpose-built for "we sell our products through external channels." Its existing schemas already model channels, contracts, mappings, booking links, webhook events, commissions, allotments, and reconciliation. Channel push is the operational arm that's missing — adding it inside distribution keeps the surface coherent. Putting these columns or the push workflow anywhere else would split a single concept across modules.

The catalog plane stays neutral: it owns the inbound `SourceAdapter` contract and the outbound contract extension (§3), but the channel-push operational state (status, retries, mappings) lives in distribution where it belongs operationally.

## 8. The owned-arm + channel push interaction

In the booking journey's `OwnedBookingHandler.commit` (per `booking-journey-architecture.md` §6), the commit is atomic against the local DB (booking + travelers + payment schedules + snapshot). **Channel push runs AFTER commit, asynchronously, via the event subscriber.** The booking is durable locally even if channel push fails; ops gets a notification and can retry or compensate manually.

This is the right separation:
- **Synchronous (commit):** local booking row, snapshot, voucher redemption, group membership. All-or-nothing within one transaction.
- **Asynchronous (post-commit):** channel push, notifications, webhook delivery, document generation. Eventually-consistent, retryable, independently failing.

For sourced bookings (where the upstream IS the source of truth), the engine's existing `adapter.reserve` path does the equivalent — the upstream commit is part of the synchronous flow, and there's no separate channel push because the source IS the channel. Owned bookings need channel push as a separate post-commit concern; sourced bookings don't.

## 9. Failure modes

The hard cases:

1. **Booking commits locally; push fails on all channels.** The operator has a booking in their system that the upstream doesn't know about. Surface: alert in operator dashboard's "channel sync failures" view + retry button + drilldown into the `webhook_deliveries` retry chain to see the actual responses. Policy: don't auto-cancel the booking; operator decides.
2. **Booking commits locally; push fails on some channels.** Partial sync. The successful channels know about the booking; the failed ones don't, and may double-book. Same surface; ops decides whether to roll back the booking or continue retrying. The reconciler (§13) catches this on its next pass even if no one intervenes.
3. **Push succeeds; the upstream later modifies/cancels the booking.** Inbound webhook from the channel. Voyant updates the local booking; user sees the change. This is the inverse direction (channel → us) covered by `webhook_subscriptions` (config) + `channel_webhook_events` (inbound log).
4. **Availability push falls behind.** Per §12, the next event for the same slot supersedes whatever was in flight, so transient failures don't cascade. After a long outage, the availability reconciler (§13) compares hashes and reissues.
5. **Content push includes a field the channel doesn't accept.** Adapter returns a structured rejection; we record it on `channel_product_mappings.policy.warnings` and surface a "channel rejected: X" badge in admin. The full request/response is in `webhook_deliveries` for diagnostics.
6. **Channel rate-limits us harder than our config expected.** Our outbound estimate (§14) is too generous. Symptom: `webhook_deliveries.error_class = "rate_limited"` rows accumulating for that channel. The 429 handler drains the bucket per `Retry-After` so we self-correct in the short term; the dashboard surfaces a recommendation to lower the configured RPS for permanent fix.

## 10. Migration / rollout

**Phase A — Adapter contract extension** (1 day):
- Add the three optional outbound methods + capability flags to `SourceAdapter`.
- Pure typing change.

**Phase B — Infra primitives + distribution schema extension** (2-3 days):
- Build `webhook_deliveries` (`packages/db/src/schema/infra/webhook_deliveries.ts`) per §11. Generic primitive.
- Build `rate_limit_buckets` (`packages/db/src/schema/infra/rate_limit_buckets.ts`) + `acquireToken(scope, config, priority)` per §14. Generic primitive.
- Additive ALTER TABLE migrations on `channels`, `channel_contracts`, `channel_booking_links`, `channel_product_mappings` per §7 + §14.1.
- Update `@voyantjs/distribution` types and exports for the new columns.
- No behavior change yet; subsequent phases populate the schemas.

**Phase C — Booking push for one channel kind** (3-4 days):
- Implement `pushBookingWorkflow` in `packages/distribution/src/service-push.ts` using `@voyantjs/core/workflows` with per-channel compensation. Each adapter call goes through `acquireToken` (§14.3) and writes a `webhook_deliveries` row per attempt.
- Wire `booking.confirmed` event subscriber inside distribution (subscribers register via `distributionModule`, not bookings — bookings stays clean).
- Operator dashboard: "channel sync" view backed by `channel_booking_links.push_status` + retry endpoint + a delivery-log drilldown + per-channel throttling indicator (§14.5).
- Demo adapter (in `apps/catalog-demo-api` + `@voyantjs/plugin-catalog-demo`) gains an optional `POST /bookings` endpoint that records pushed bookings, so the operator can verify the round-trip end-to-end without an external integration. Demo adapter advertises configurable rate limits to exercise the throttle path.

**Phase D — Availability push** (2-3 days):
- Wire `availability.slot.changed` event subscriber in distribution.
- Implement availability push as **bounded inline retry inside the subscriber** (§12) — not a workflow. Pre-call `acquireToken(..., "availability")` with the priority gate; if denied, log to `webhook_deliveries` and bail (next event will supersede). Each successful attempt also logs.
- Demo adapter gains an availability sink.

**Phase E — Content push** (2-3 days):
- Wire `product.updated` event subscriber in distribution.
- Same bounded-inline-retry pattern as availability (§12). Versioned content payloads keyed on `(entity_id, content_version)`.
- Demo adapter content sink.

**Phase F — Reconciler** (3-4 days):
- Scheduled job that walks `channel_booking_links` and `channel_product_mappings` looking for divergence between Voyant state and last-known channel state (per `pushed_payload_hash` + adapter-side queries when supported).
- Reissues pushes for divergent rows. Handles the "channel was offline for hours, our retries gave up, state has drifted" case (§13).
- v1: runs hourly per (channel, source_connection_id), respects rate limits, surfaces unresolvable divergences to ops.

**Phase G — First real channel adapter** (per integration; 5-10 days each):
- Implement the contract for a real upstream — TUI, a Voyant Connect peer, etc.
- Each integration's auth, rate limits, and content-shape translation are upstream-specific work that lands per channel.

Phases A-F give us the **channel-push framework** entirely inside `packages/distribution` (plus the cross-cutting `webhook_deliveries` infra); Phase G onward is per-channel integration work that scales with the number of channels we support.

## 11. The webhook delivery log

`webhook_deliveries` is a **generic outbound HTTP delivery log** — every outbound HTTP call from any module writes a row per attempt for observability, retry-chain history, and (eventually) durable scheduling. Channel push is the first consumer; future consumers include operator-configured webhooks (delivering Voyant events to operator-supplied URLs), third-party integrations (CRM sync, accounting exports), and any other real-time outbound system that needs the same observability surface.

This is distinct from `channel_webhook_events` (in distribution), which logs events received **from** channels — opposite direction.

### 11.1. Schema

```sql
-- packages/db/src/schema/infra/webhook_deliveries.ts (new)
webhook_deliveries (
  id                       text pk           -- typeid: whde (prefix already reserved)

  -- Provenance: who issued this call and why
  source_module            text not null     -- "distribution", "iam", "operator-webhooks", ...
  source_event             text not null     -- "channel.booking.push", "channel.availability.push", ...
  source_entity_module     text              -- e.g. "bookings", "products" — for entity-scoped queries
  source_entity_id         text              -- e.g. "book_xxx" — for entity-scoped queries
  subscription_id          text              -- nullable; references webhook_subscriptions.id when applicable

  -- Target: where we called
  target_url               text not null
  target_kind              text              -- "channel:tui", "subscription", "internal", ...
  target_ref               text              -- e.g. channel_id when target_kind starts with "channel:"

  -- Request (sensitive headers redacted before write)
  request_method           text not null
  request_headers          jsonb             -- auth headers redacted
  request_body_hash        text              -- SHA256 of payload for idempotency / drift detection
  request_body_excerpt     text              -- first N chars for debugging

  -- Response
  response_status          integer
  response_headers         jsonb
  response_body_excerpt    text

  -- Retry chain
  attempt_number           integer not null default 1
  parent_delivery_id       text              -- previous attempt in this retry chain
  idempotency_key          text              -- caller-supplied; stable across retries

  -- Lifecycle
  status                   text not null     -- "pending" | "in_flight" | "succeeded" | "failed" | "abandoned"
  scheduled_for            timestamptz       -- nullable; when null, dispatched immediately
  started_at               timestamptz
  finished_at              timestamptz
  duration_ms              integer

  -- Error detail
  error_class              text              -- "network" | "timeout" | "4xx" | "5xx" | "adapter_error" | "rate_limited"
  error_message            text

  created_at               timestamptz not null default now()
  updated_at               timestamptz not null default now()
)
-- index on (status, scheduled_for) WHERE status IN ('pending','failed') — for future scheduler
-- index on (source_module, created_at desc)                            — for module-scoped logs
-- index on (source_entity_module, source_entity_id, created_at desc)   — for entity-scoped logs
-- index on (idempotency_key, attempt_number)                           — for retry-chain queries
-- index on (subscription_id, created_at desc)                          — for subscription logs
-- index on (target_kind, target_ref, created_at desc)                  — for channel-scoped logs
```

### 11.2. Two access patterns

**Write-path** (every outbound call): caller writes a row before the call (`status = 'in_flight'`, `started_at = now()`), then updates it after the response (`status`, `response_*`, `finished_at`, `duration_ms`). On retry, write a NEW row with `parent_delivery_id` pointing at the previous attempt and `attempt_number + 1`.

**Read-path** (operator dashboard / developer tools):
- "Show me all deliveries for this booking" — `WHERE source_entity_module = 'bookings' AND source_entity_id = 'book_xxx'`
- "Show me what we sent to channel X today" — `WHERE target_kind = 'channel:tui' AND target_ref = ch_xxx AND created_at > today`
- "Show me the retry chain for this idempotency key" — `WHERE idempotency_key = 'xxx' ORDER BY attempt_number`
- "Show me failures we haven't given up on yet" — `WHERE status = 'failed' AND attempt_number < max_retries`

### 11.3. v1 boundaries

- **No worker / scheduler in v1.** `scheduled_for` is part of the schema so a future worker can `SELECT WHERE status='pending' AND scheduled_for <= now()` without a migration, but v1 dispatches synchronously inside the caller (workflow or subscriber). The table is an **observability primitive**, not a queue.
- **Retention.** Successful rows older than 90 days roll off; failed/abandoned rows retain longer (180 days) for diagnostics. Tunable per deployment.
- **Body size.** `request_body_excerpt` and `response_body_excerpt` are bounded (4 KB each) — full bodies live in object storage if a channel agreement requires it; the table holds an excerpt + hash.
- **PII redaction.** Headers are redacted before write (auth tokens, cookies). Body excerpts are stored verbatim — callers MUST avoid sending PII in payloads, or rely on the same redaction the adapter applied. The booking push payload (per §11 in non-goals — now §14) is already PII-redacted upstream; this table inherits that posture.

### 11.4. Future consumers

The reason to build this generically rather than channel-specific:

- **Operator webhooks** — operators configure `webhook_subscriptions` to receive Voyant events at their own URLs (`booking.confirmed`, `payment.received`, etc.). Today the delivery is a TODO; once `webhook_deliveries` exists, the worker that delivers to operator URLs writes here.
- **Third-party integrations** — CRM sync (push contact updates to HubSpot), accounting exports (push invoices to QuickBooks), notifications (push order events to Slack via webhook). All of these benefit from the same observability surface.
- **Real-time replacements for cron jobs** — many "every 5 minutes, sync X to Y" patterns are better expressed as event-driven outbound calls. `webhook_deliveries` is the logging substrate for those.

Building it once means we don't have to rebuild "track outbound HTTP calls" each time a new outbound use case appears.

## 12. Push strategy: workflows for booking, inline retry for availability/content

The three flows have genuinely different reliability semantics, and they get genuinely different code paths.

### 12.1. Booking push: workflow with compensation

A booking commits locally and fans out to N channels. Partial success is the hard case — channel A accepts, channel B rejects. We need:

- **Compensation** when one channel fails after others succeeded (cancel on the successful channels, or surface the partial-success state to ops).
- **Sequential or bounded-parallel dispatch** with rate limits per channel.
- **Bounded retry** per channel with backoff.
- **Durable progress** so the workflow can resume after a worker restart.

This is a saga. Use `@voyantjs/core/workflows`:

```ts
const channelPushWorkflow = createWorkflow("channel.booking.push", [
  step("resolve-channels").run(resolveChannelsForBooking),
  step("push-each-channel").run(pushOneChannelPerStep)
                            .compensate(cancelOnSuccessfulChannels),
  step("finalize").run(updateBookingPushStatus),
])
```

Each adapter call inside the workflow writes a `webhook_deliveries` row (per §11). The workflow's own state is in the workflow runtime; the per-call observability lives in the delivery log.

### 12.2. Availability + content push: bounded inline retry

Availability events fire frequently (every commit / cancel / manual edit / scheduled refresh), are idempotent on `(slot_id, remaining_pax)`, and are eventually-consistent by design. Content events fire on operator edits, are idempotent on `(entity_id, content_version)`, and are also eventually-consistent.

For these, **don't build a queue**. The event stream itself is the queue:

```ts
eventBus.subscribe("availability.slot.changed", async ({ data }) => {
  const channels = await resolveChannelsForProduct(db, data.productId)
  for (const channel of channels) {
    if (!channel.mapping.pushAvailability) continue
    await retryWithBackoff(
      () => pushAvailabilityToChannel(channel, data),
      { maxAttempts: 3, baseMs: 200, logTo: webhookDeliveries },
    )
    // On persistent failure: stamp last_error and move on. The next
    // availability event for this product will overwrite whatever was
    // in flight — re-delivering an old event is wrong, not just
    // unnecessary, because the in-flight value is already stale.
  }
})
```

Why no queue:
- **Idempotent + eventually consistent** means re-delivering a stale event is a regression, not a recovery. The newest event always wins.
- **High frequency** would fill a queue table fast, then need aggressive cleanup.
- **The event stream IS the durable queue.** If we miss a delivery, the next event for the same key supersedes it. State converges automatically.
- **The delivery log (§11) is enough observability.** Every attempt — success, failure, retry — has a row. Ops can see what's happening; we just don't need a separate scheduler walking it.

The exception: **catastrophic outage** where the channel was unreachable for hours and many supersession events fired but none landed. The last event we tried might also have failed, and now the channel's view of remaining_pax is wrong. That's the **reconciler's** job (§13) — not the push subscriber's.

### 12.3. Why not workflows for availability/content too

We could put everything in workflows for one mental model, but:

- A workflow per availability event is heavyweight — a workflow runtime row, status tracking, retry orchestration — for an `idempotent fire-and-forget call`. The cost-benefit is bad.
- Workflows imply "this should eventually succeed and we'll keep at it." Availability pushes are "succeed now or be superseded" — different semantics.
- The compensation primitive that justifies workflows for booking push is unused for availability (there's nothing to compensate; the next event corrects state).

Use the right tool. Workflows where compensation matters; bounded inline retry where the event stream provides convergence.

## 13. The reconciler: catch-up after outage

Eventually-consistent push works while the channel is reachable most of the time. After a long outage (or when an integration is first turned on for a channel that already has some local state), the channel's view of our inventory diverges from ours. The reconciler closes that gap.

### 13.1. What it does

A scheduled job per `(channel, source_connection_id)` that:

1. **Walks recent channel-relevant rows in our DB.** For booking push: `channel_booking_links` where `push_status != 'ok'` and `last_push_at < now() - threshold`. For availability: products mapped to this channel where `pushed_payload_hash` doesn't match the current availability hash. For content: product versions where `content_version` is ahead of the channel's last-known version.
2. **Reissues pushes for divergent rows.** Same code path as the regular subscriber — same workflow for booking, same bounded inline retry for availability/content. Each attempt writes to `webhook_deliveries`.
3. **Surfaces unresolvable divergences.** Some rows fail repeatedly (channel rejects payload, mapping is broken, contract expired). After N reconciler passes, mark the row `push_status = 'abandoned'` and surface in the operator dashboard.

### 13.2. Cadence

- **Booking-link reconciler**: every 15 min. Catches missed/failed booking pushes from short outages.
- **Availability reconciler**: hourly. Catches drift from missed availability events.
- **Content reconciler**: nightly. Content drift is rarely time-critical.

These are tunable per channel via `policy` on `channel_product_mappings` / `channel_contracts`.

### 13.3. Why a reconciler instead of durable retry forever

A naive durable-retry queue says "keep trying every failed push until it succeeds." That's:
- **Stale.** A booking push that's been retrying for 6 hours is dispatching state that may have been cancelled in the meantime.
- **Noisy.** A persistently-broken channel produces an avalanche of retries that's not actionable.
- **Hard to bound.** When does the queue ever drain? Operator intervention or a fix.

The reconciler explicitly **reads current state and reissues from scratch**, rather than re-delivering stale events. That gives correct convergence even after multi-hour outages, without the staleness problems of a durable retry queue.

## 14. Per-channel rate limiting

Real channel APIs throttle: TUI-style endpoints often allow ~10 RPS sustained, GDS endpoints can be as tight as 1-5 RPS, bedbanks vary. Without rate limiting in v1, the first integration will trip an upstream limit, get 429s in cascade, and either back off into incoherence or get the connection blocked. We design it in from day one.

### 14.1. Config: per-channel, per-contract overrides

Rate-limit settings live on the channel (defaults) with optional per-contract overrides — same pattern as commission rules. Additive ALTER TABLE on `channels` and `channel_contracts`:

```sql
ALTER TABLE channels
  ADD COLUMN rate_limit_rps              integer,           -- requests per second sustained
  ADD COLUMN rate_limit_burst            integer,           -- max tokens in bucket
  ADD COLUMN rate_limit_priority_gates   jsonb;             -- per-priority reserve thresholds

-- channel_contracts overrides the channel defaults for a specific
-- supplier relationship (e.g. our enterprise contract with TUI gives
-- us a higher burst than the public default).
ALTER TABLE channel_contracts
  ADD COLUMN rate_limit_rps              integer,
  ADD COLUMN rate_limit_burst            integer,
  ADD COLUMN rate_limit_priority_gates   jsonb;
```

`rate_limit_priority_gates` example: `{ "booking": 0, "availability": 0.3, "content": 0.7 }`. Read as: bookings dispatch as long as any tokens are available; availability dispatches when bucket is at least 30% full; content dispatches when bucket is at least 70% full. This way **bookings always pre-empt availability/content**, and the three flows share one upstream budget instead of competing for separately-sized slices that might sum to more than the channel actually allows.

### 14.2. Enforcement: token bucket in shared infra

A generic primitive in `packages/db/src/schema/infra/rate_limit_buckets.ts`:

```sql
rate_limit_buckets (
  scope                    text primary key,    -- e.g. "channel:ch_xxx:conn_yyy"
  tokens_available         numeric not null,
  capacity                 numeric not null,
  refill_rate_per_sec      numeric not null,
  last_refill_at           timestamptz not null,
  updated_at               timestamptz not null default now()
)
```

Generic on purpose: any module that needs token-bucket rate limiting (operator webhooks, third-party integrations, future use cases) can use the same primitive with its own scope key. Channel push wraps it with channel-specific scope construction.

The `acquireToken(scope, config, priority)` function:

1. Atomic UPDATE that refills tokens based on `(now - last_refill_at) × refill_rate`, capped at `capacity`.
2. If `tokens_available >= priority_gate(priority) × capacity` AND `tokens_available >= 1`, decrement and return `{ acquired: true }`.
3. Otherwise return `{ acquired: false, retryAfterMs }` computed from how long until enough tokens refill for the priority gate.

The whole thing is one round-trip — small overhead next to the HTTP call we're gating.

### 14.3. Where it runs

**Booking push (workflow):** the per-channel step calls `acquireToken("channel:" + channelId + ":" + connectionId, config, "booking")` before each adapter call. On denial, the workflow's sleep primitive waits `retryAfterMs` and retries. If wait exceeds a max threshold, the step fails with `error_class = "rate_limited"`; the saga moves on, the reconciler picks it up next pass.

**Availability + content push (subscriber):** the subscriber calls `acquireToken(..., "availability")` or `..., "content"` before each adapter call. On denial, **don't sleep** — return immediately. The next event for the same key supersedes anyway (per §12), and waiting in the subscriber blocks downstream events. Log the denial to `webhook_deliveries` with `error_class = "rate_limited"` for observability.

### 14.4. 429 handling

The bucket is our **outbound-side estimate**. The channel itself is authoritative. When the upstream returns 429:

1. Log to `webhook_deliveries` with `error_class = "rate_limited"` and the response's `Retry-After` header.
2. **Drain the bucket** to zero and set `last_refill_at = now() + retry_after_seconds`. This prevents us from immediately retrying through the same bucket and ensures other concurrent dispatchers also see "no tokens" for the cooldown.
3. The caller (workflow or subscriber) treats 429 the same as "acquire denied": workflow sleeps + retries; subscriber gives up and waits for the next event.

This way our bucket self-corrects when our config drifts from reality. Operations sees recurring `rate_limited` rows in `webhook_deliveries` for a channel, lowers the configured RPS, and the bucket converges.

### 14.5. Operator surface

Operators don't think in tokens-per-second — they think in "this channel keeps rejecting our pushes." The dashboard surfaces:

- **Per-channel throttling indicator** when `webhook_deliveries.error_class = "rate_limited"` is non-trivial in the last hour.
- **A simple "throughput" knob** in the channel settings page (slow / medium / fast presets that map to sensible RPS/burst defaults; advanced users can edit raw values).
- **Recommendation** when the channel returns 429s with `Retry-After` consistently lower than our bucket implies — "your bucket is sized higher than this channel actually allows."

Internal mechanics stay invisible.

### 14.6. v1 scope vs later

In: per-channel/contract config, token-bucket enforcement, priority gates, 429 handling.

Not in: per-region rate limits (some channels rate-limit per geography), per-endpoint rate limits (some channels have stricter limits on specific endpoints like `POST /bookings`), adaptive limiters that learn the channel's actual capacity. All can layer on top of the same primitive when a real integration needs them.

## 15. Non-goals (v1)

- **Bidirectional content reconciliation.** If a channel edits content downstream and pushes back, we don't merge today. The operator's Voyant edit is the source of truth for owned products; channels are read-only consumers. Resolving conflicts when channels can also edit is a follow-up.
- **Per-traveler PII push.** v1 push payloads include the booking shape but redact encrypted travel details. The channel pulls those via a separate authenticated read on demand if it needs them. Lets us avoid pushing PII through the saga and keeps the audit shape simpler.
- **Real-time bidirectional inventory sync.** Eventually-consistent is the contract for v1. Sub-second sync is a v2 conversation about message brokers and durable queues.
- **Channel-push for sourced bookings.** Sourced bookings already commit upstream via `adapter.reserve`; there's no separate channel push because the source IS the channel.

## 16. Open questions

1. ~~**Where does `booking_channel_links` actually live?**~~ **Resolved (§2, §7):** channel push lives in `packages/distribution`, which already houses `channels`, `channel_contracts`, `channel_product_mappings`, `channel_booking_links`, `channel_webhook_events`, `channel_commission_rules`, `channel_inventory_allotments`, `channel_reconciliation_items`, plus the `distributionBookingExtension` HonoExtension. Channel push is net-new code (workflows, event subscribers, push-status fields) over the existing module — not new tables in bookings/products. Bookings stays clean of channel concepts; distribution depends on bookings via the established extension pattern, never the inverse.
2. ~~**Webhook-delivery infrastructure reuse.**~~ **Resolved (§11, §12, §13):** `webhook_deliveries` did not exist; it does now (built as part of this work). It's a generic outbound-HTTP delivery LOG (every attempt writes a row for observability + retry-chain history), not a queue — `scheduled_for` is in the schema for a future scheduler but v1 dispatches synchronously inside the caller. Channel push uses workflows + the delivery log for booking push (compensation matters), and bounded inline retry + the delivery log for availability/content (idempotent + eventually-consistent; the event stream is the queue). A reconciler (§13) closes the catch-up gap after long outages, by re-reading current state and reissuing pushes from scratch — never by re-delivering stale events.
3. ~~**Per-channel rate-limit awareness.**~~ **Resolved (§14):** rate limiting is in v1, not deferred. Token-bucket primitive lives at `infra.rate_limit_buckets` (generic — usable by other modules); per-channel/per-contract config holds capacity + refill rate + per-priority gates so bookings always pre-empt availability/content while sharing one upstream budget. Bookings sleep-and-retry on denial inside the workflow; availability/content give up immediately and rely on the next supersession event. 429 responses drain the bucket to align our outbound estimate with the channel's authoritative state.
4. ~~**What's `channel_id`?**~~ **Resolved (§2):** `channel_id` is the typeid of a row in the existing `distribution.channels` table — not a synthetic from `(source_kind, source_connection_id)`. A channel is a first-class entity with its own contracts, contacts, commission rules, and reconciliation surface; reducing it to a synthetic would lose that structure.
5. ~~**Bidirectional adapter packaging.**~~ **Resolved (§3, §14):** one `SourceAdapter` instance per connection carries all methods (inbound + outbound). Real channels share auth and the upstream RPS budget across directions — two instances would force two credential lookups and either two rate-limit buckets (wrong: we'd over-throttle ourselves) or a shared-bucket lookup that's more complex than just keying both directions on `connection_id`. Capability flags (`supportsContentFetch`, `supportsBookingPush`, `supportsAvailabilityPush`, `supportsContentPush`) already separate directions cleanly; TypeScript's optional methods let pure-inbound or pure-outbound adapters skip the irrelevant ones without stubbing. Each upstream ships as one npm package with one factory (`createTuiAdapter(config) → SourceAdapter`). When an adapter genuinely needs distinct read/write credentials (rare), it composes separate inbound/outbound HTTP clients **internally** under one public `SourceAdapter` — that's an implementation organization choice, not a public-contract change.

## 17. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — Phase 1 inbound contract. Channel push extends the same `SourceAdapter` contract for outbound.
- [`catalog-sourced-content.md`](./catalog-sourced-content.md) — inbound content fetch. Sibling to this doc; same adapter contract, opposite direction.
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the engine's commit triggers the booking push subscriber.
- [`booking-journey-architecture.md`](./booking-journey-architecture.md) — channel push runs post-commit; the journey itself doesn't see it.
