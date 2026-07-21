# Voyant Event Delivery And Durable Execution Policy

This guide defines how Voyant should treat emitted events, subscribers, and the
boundary between fire-and-forget signaling and durable background execution.

It extends:

- [`execution-architecture.md`](./execution-architecture.md)
- [`notifications-architecture.md`](./notifications-architecture.md)

The goal is narrow:

- standardize the event envelope and event taxonomy that Voyant already uses
- keep ordinary event delivery honest about its in-process semantics
- separate event emission from durable queued execution
- defer event priority until durable queued delivery exists for a concrete event
  family

Voyant should standardize event shape now. It should not pretend that the
current event bus is already a durable queue.

## Core Rules

### 1. Keep one standard event envelope

Voyant event consumers should share one canonical envelope shape.

The current baseline already exists in [`@voyant-travel/core/events`](../../packages/core/src/events.ts):

- `name`
- `data`
- `metadata`
- `emittedAt`

Metadata should keep using the existing fields where relevant:

- `category` (`domain` or `internal`)
- `source` (`workflow`, `service`, `route`, `subscriber`, `system`)
- correlation or causation identifiers when useful

Rule:

Use the shared core event envelope instead of inventing package-local event
shapes.

### 2. Distinguish domain events from internal events

Not every emitted event has the same audience.

Use `domain` for business milestones that other modules or integrations may
reasonably care about.

Examples:

- `invoice.settled`
- `booking.documents.sent`
- `product.created`

Use `internal` for process signals that are still useful to subscribers,
diagnostics, or automation, but are not part of the core business language.

Examples:

- `invoice.document.generated`
- `contract.document.generated`

Rule:

Choose event category intentionally so consumers can tell whether the event is a
business fact or an internal process signal.

### 3. Treat the current event bus as in-process fire-and-forget delivery

The current default `EventBus` implementation in
[`@voyant-travel/core/events`](../../packages/core/src/events.ts) is in-process.

Its semantics are explicit:

- handlers run sequentially
- subscriber errors are caught and logged
- subscribers do not affect the emitter outcome
- emission does not imply durable delivery or retry

Rule:

Do not describe the current event bus as a queue, a durable stream, or a
reliable delivery mechanism.

### 4. Emit events after the durable state change they describe

An event should normally describe a business or process fact that is already
true in durable storage.

Good examples:

- generate a document, persist the rendition or attachment, then emit the
  generated event
- reconcile a settlement, persist the payment and invoice updates, then emit the
  settled event
- send the booking documents, persist the delivery row, then emit the sent event

Rule:

Emit the event after the durable state transition it describes, not before.

### 5. Subscribers are observers, not part of the correctness boundary

Subscribers are a good fit for:

- secondary sync reactions
- notifications and follow-up reactions
- cache invalidation or read-model refresh requests
- diagnostics and logging

They are not a good fit for correctness-critical work that must succeed before
the caller can treat the main operation as complete.

Rule:

If the side effect is part of the correctness boundary, do not hide it in a
fire-and-forget subscriber.

### 6. Use durable jobs or workflows for retryable background execution

When a side effect needs:

- retries
- durable execution
- delayed execution
- explicit job identity or idempotency
- queue-backed isolation from the request path

it should move to the `JobRunner` / workflow side, not stay on the plain event
bus.

Voyant already has the right boundary for this in
[`@voyant-travel/core/orchestration`](../../packages/core/src/orchestration.ts) and
[`@voyant-travel/core/workflows`](../../packages/core/src/workflows.ts).

Rule:

Use events for signaling. Use jobs or workflows for durable background work.

### 7. Do not promise queue semantics through EventBus adapters implicitly

The `EventBus` interface may be implemented by templates or adapters in
runtime-specific ways, but the portable contract should remain honest.

That means callers should not assume:

- durable retries
- ordering beyond the implementation's explicit behavior
- dead-letter handling
- backpressure controls
- priority

unless the runtime-specific event family documents those semantics clearly.

Rule:

Do not smuggle queue guarantees into the generic `EventBus` contract.

### 8. Introduce durable queue-backed delivery one event family at a time

If a future event family needs stronger guarantees, add them narrowly.

A good first promotion would look like:

- one concrete event family
- one durable execution path
- explicit runtime-specific guarantees
- clear ownership for retries, failure handling, and idempotency

Rule:

Promote durable delivery family by family, not by turning every event into a
queue message at once.

#### Graph outbound webhook intake

Node deployments register outbound webhook subscribers from the selected graph
webhook plan. The deployment's `outboundWebhooks` provider selects Postgres, an
injected host enqueuer, or no outbound composition; it does not maintain a
second event catalog. Credentials configure the selected provider and never
select one implicitly. For each selected event, the Postgres intake
loads active `webhook_subscriptions` rows containing that event name and writes
one `webhook_deliveries` row per subscription through the distribution
redaction boundary.

The intake row is truthful about its lifecycle: it is `pending`, has no
`started_at`, and uses `graph-webhook:<eventId>:<subscriptionId>` as its stable
idempotency key. Event-outbox replay therefore reuses the existing first
attempt instead of claiming that another HTTP call occurred.

Installed remote apps have a parallel durable intake owned by
`@voyant-travel/apps`. When the optional `apps.webhook-delivery` runtime port is
present, Node registers one app-intake subscriber for every valid external
entry in the selected event catalog, even when no operator-owned outbound
webhook resource selected that event. The generic and app intakes remain
separate, so an app subscription neither creates nor suppresses an operator
webhook subscription. Both receive the same selected contract metadata and use
idempotent delivery rows.

App webhook subscriptions are inactive after manifest reconciliation. An
authenticated app with `app-webhooks:configure` must issue a host-owned signing
key and prove possession through a bounded signed challenge before the current
release's subscriptions activate atomically. The proof is base64url
HMAC-SHA256 over
`voyant.app-webhook-key-confirm.v1\n<appId>\n<installationId>\n<keyId>\n<challenge>`.
The host runtime owns key material, challenge authenticity, context binding,
expiry, and rotation. Voyant persists only the confirmed key id; secret, challenge, and
proof never enter ordinary database rows, tokens, events, delivery payloads, or
audit details. Delivery and replay fail closed unless the active
subscription's persisted key id exactly matches host resolution.

These provider selections are durable intake boundaries, not HTTP delivery.
The package workers own payload hydration, claiming, signing, retry attempts,
and delivery/subscription outcomes. The app worker claims only rows whose
source module is `apps`; the generic worker cannot hydrate app subscription
authority. When Apps and its `apps.webhook-delivery` runtime port are selected,
the standard resident Node host starts the app worker, drains once immediately,
and continues on a non-overlapping polling cadence. Durable claims coordinate
multiple host replicas. A failed drain is reported without stopping later
polls, and both explicit and signal-driven server shutdown stop the poller and
await its active drain. A replacement host must provide the same lifecycle.
The generic worker remains deployment-scheduled separately. Until the
corresponding worker runs, pending rows remain observable delivery intents and
no external request is made. Generic and app intake handlers fail independently
through EventBus reporting, so one durable-write failure cannot suppress the
sibling intake attempt.

### 9. Defer event priority until durable queued delivery exists

Priority only matters once there is a real queued execution surface where work
competes for runtime capacity.

Without durable queued execution, priority is just metadata with no honest
behavior behind it.

Rule:

Do not add event priority until one durable queue-backed event family exists and
proves the need.

## Review Heuristics

When reviewing event-related changes:

1. Is this event describing a fact that is already durable?
2. Is the event `domain` or `internal`?
3. Can subscriber failure be tolerated without breaking correctness?
4. Does this side effect actually need durable retries or scheduled execution?
5. Is a queue-backed path being proposed for one real event family, or as a
   premature framework-wide abstraction?

## Audit Examples

The purpose of this section is to anchor policy in current Voyant code rather
than in generic messaging folklore.

### 10. Invoice document generation: internal event after the rendition exists

Write path:

- [`financeDocumentService.generateInvoiceDocument(...)`](../../packages/finance/src/service-documents.ts)
  creates or updates the invoice rendition first
- only then does it emit `invoice.document.generated`
- the event is emitted with `category: "internal"` and `source: "service"`

Policy outcome:

- this is the correct pattern for process signals
- the event describes completed document generation state
- subscriber failure should not roll back the underlying document record

### 11. Invoice settlement: domain event after payment state is durable

Write path:

- [`financeSettlementService.reconcileSettlement(...)`](../../packages/finance/src/service-settlement.ts)
  creates the payment and updates invoice state first
- only then does it emit `invoice.settled`
- the event is emitted with `category: "domain"` and `source: "service"`

Policy outcome:

- this is a good example of a business milestone event
- the event is a signal to downstream observers, not the mechanism that makes
  the invoice settled
- if follow-up reactions ever need durable retries, they should move onto a job
  or workflow path rather than changing the event bus contract globally

### 12. Booking document sends: delivery row first, event second

Write path:

- [`bookingDocumentNotificationService.sendBookingDocuments(...)`](../../packages/notifications/src/service-booking-documents.ts)
  persists the delivery request first
- only then does it emit `booking.documents.sent`

Policy outcome:

- this is the right event ordering
- the event announces a durable delivery request/result record, not a mere
  intent to try later

### 13. CMS sync subscribers: fire-and-forget observers are appropriate here

Subscriber paths:

- [`payloadCmsPlugin(...)`](https://github.com/voyant-travel/plugin-payload)
  subscribes to `product.created`, `product.updated`, and `product.deleted`
- [`sanityCmsPlugin(...)`](../../packages/plugins/sanity-cms/src/plugin.ts)
  does the same
- both catch and log subscriber failures instead of trying to alter the emitter
  result

Policy outcome:

- these integrations are good fits for the current fire-and-forget subscriber
  model
- subscriber errors are operational issues, not reasons to invalidate the core
  product write
- if a deployment eventually needs durable content-sync guarantees, that should
  be introduced as a dedicated durable execution path for that event family

### 14. Finance lifecycle webhooks: native fact first, external observation second

Write paths:

- proforma conversion commits the successor invoice, lineage, payment
  reassignment, and source-proforma void before emitting
  `invoice.proforma.converted`
- invoice void commits the void state before emitting `invoice.voided`; event
  construction does not query or prefer any external provider reference
- native payment creation and invoice totals commit before emitting
  `invoice.payment.recorded`

The external event catalog projects those rich internal source payloads to
minimal facts containing stable IDs, occurrence time, conversion lineage where
relevant, and the bounded monetary fields required to mirror a completed
payment. Customer, booking, invoice-number, and free-text payment-reference
fields remain private. These app-facing projections use event contract version
2 to make the wire-schema change explicit, while exported source event types
retain their existing optional fields. Apps respond through append-only
lifecycle or settlement observation endpoints. A settlement observation is
evidence for reconciliation; it never creates a native payment or changes the
invoice's native settlement state.

Policy outcome:

- webhook delivery cannot announce a lifecycle fact before its native state is
  queryable
- external retries are idempotent operation observations, not repeated native
  mutations
- `invoice.settled` remains an internal reconciliation signal and is not used as
  an app-facing settlement command

## Practical Checklist

When adding or reviewing event behavior in Voyant:

1. Use the shared event envelope from `@voyant-travel/core/events`.
2. Mark the event as `domain` or `internal` intentionally.
3. Emit the event after the durable state change it describes.
4. Keep subscriber work outside the correctness boundary.
5. Move retryable or delayed side effects to `JobRunner` or workflows.
6. Introduce queue-backed delivery only for one justified event family at a
   time.
7. Do not add priority metadata until durable queued delivery exists and uses
   it honestly.

## Non-Goals

This guide does not introduce:

- a universal durable event bus
- queue semantics hidden behind the generic `EventBus` contract
- event priority as a framework-wide feature today

The point is a clean and honest event model, not a premature messaging
platform.
