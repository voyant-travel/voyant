---
"@voyantjs/core": minor
---

Transactional-outbox support in the event bus (RFC #1687 Phase 2.1). `EmitOptions` gains `store` (an `OutboxEventStore`): when present, the envelope is persisted BEFORE any handler runs and the row is completed/failed after all handlers settle — a crash mid-delivery leaves a pending row for redelivery instead of a lost event. Duplicate `metadata.eventId`s skip delivery (idempotent capture). New `EventBus.deliver(envelope)` runs all subscribers with per-handler failure reporting (used by outbox drains for redelivery; optional on the interface). `emit` now always stamps `metadata.eventId` (`generateEventId()`, exported) when the caller didn't supply one — additive, and the workflow forwarder's idempotency derivation keys on it.
