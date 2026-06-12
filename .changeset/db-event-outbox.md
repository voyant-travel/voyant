---
"@voyantjs/db": minor
"@voyantjs/schema-kit": patch
---

New `@voyantjs/db/outbox` module + `event_outbox` table (`schema/infra`, TypeID prefix `evob`) — the Postgres half of the transactional outbox (RFC #1687 Phase 2.1). **Requires the `event_outbox` migration.**

- `createOutboxEventStore(getDb)` — plugs into `createEventBus`'s durable emit.
- `insertOutboxEvents(dbOrTx, envelopes)` — atomic capture inside a domain transaction ("transactional outbox" proper); dedups on `metadata.eventId`.
- `claimDueOutboxEvents` — visibility-timeout claiming (single statement, `FOR UPDATE SKIP LOCKED` subquery — safe on neon-http and under concurrent drains; a crashed claimer's rows simply become due again).
- `drainOutbox(db, bus, opts)` — claim → redeliver via `bus.deliver` → complete / reschedule with exponential backoff (5s·2^attempts, 15min cap, jitter) / dead-letter after `max_attempts`.
- `pruneDeliveredOutboxEvents`, `getOutboxStats`.

Delivery is **at-least-once**: subscribers must be idempotent (the workflow forwarder already dedups on eventId; plugin subscribers key on external refs).

Also: `createTestDb()` disables the Phase-1 default statement/query timeouts for test clients — `cleanupTestDb`'s full-schema TRUNCATE could exceed the 10s production default and kill integration-suite setup.
