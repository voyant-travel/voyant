# Phase 5 Authority Audit

Status at `4c94a014b0`, updated by the graph-wide first-party event contract cut.

## Closed In This Cut

- Outbound webhook declarations resolve only selected package-owned events.
- Externally deliverable events declare semantic versions, JSON payload schemas,
  external visibility, and audit source/category metadata.
- The selected webhook plan retains that contract and provenance metadata.
- Generic event composition enriches delivery envelopes with contract id/version and
  graph-owned audit metadata without adding a host binding.
- Queued outbound delivery records the graph-owned source and contract headers.
- A pure Node checker and fixtures prevent name-only outbound eligibility from returning.
- Every first-party package event is versioned, schema-backed, visibility-classified, and
  audit-attributed; name-only internal event declarations are no longer accepted.
- The authority checker reconciles observed package emitters and runtime subscriptions with
  manifest-owned contracts and subscribers, and reports graph-wide coverage counts.
- Selected-graph validation rejects executable subscribers when their event contract owner is
  absent from the selected graph.
- The package-owned subscription mutation service accepts only event types in the selected
  external webhook plan, and its Postgres factory validates before insert/update persistence.
- External payload delivery is schema-projected with package-owned property allowlists.
  Undeclared fields are dropped, while `writeOnly` and `x-voyant-redact` properties are
  replaced with a redaction marker.
- Distribution's graph path delegates selected-contract projection, subscription fan-out,
  signing, retry/backoff, audit callbacks, and dead-letter state to
  `@voyant-travel/webhook-delivery`.

## Existing Phase 5 Authority

- Ordinary subscriber runtimes are selected-graph-owned for Catalog, Commerce,
  Distribution, Finance, Legal, Notifications, Storefront, Trips, and SmartBill.
- Workflow event filters remain distinct from ordinary executable subscribers.
- Selected graph tools are lazily registered into the ADR-0011 registry; selected
  context contributions feed the in-deployment MCP adapter.
- Action declarations validate route, tool, workflow, event, webhook, scope, and copy
  references before lowering into the action-ledger registry.
- The webhook delivery engine implements signing, bounded audit excerpts, retry classification,
  idempotency, audit callbacks, dead-letter state, and subscription outcome tracking. Distribution
  binds its Postgres store but owns no external webhook execution policy.
- Distribution channel-push workflows remain separate: they call supplier APIs through
  package-owned adapters and workflow retry policy, not webhook subscriptions.

## Residual Checklist

- Route the legacy Dash subscription mutations through the package-owned service. This repository
  contains no subscription mutation API or direct insert call outside the service factory, so
  end-to-end enforcement by that external control-plane caller is not yet demonstrated here.
- Activate Realtime's package-owned invalidation declarations and remove its remaining
  Operator bridge without duplicate subscriptions.
- Move Notifications' `booking.fully-paid` module-bootstrap subscription behind a selected
  package-owned subscriber descriptor; the graph-wide report identifies it as the one unowned
  runtime subscription type.
- Expand package-owned tools beyond the currently declared Catalog, Bookings, Finance,
  Inventory, Notifications, Quotes, Relationships, and Trips sets; ratchet context and
  runtime export parity mechanically.
- Remove remaining Operator MCP product-context compatibility assembly after selected
  packages contribute their contexts directly.
- Migrate remaining action-ledger compatibility catalogs, especially Relationships,
  only after their referenced ids and parity tests are complete.
