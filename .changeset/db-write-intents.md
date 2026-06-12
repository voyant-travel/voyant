---
"@voyantjs/db": minor
"@voyantjs/schema-kit": patch
---

New `@voyantjs/db/write-intents` + `write_intents` table (TypeID prefix `wint`) — the queued write pipeline's result mailbox (RFC #1687 Phase 3.2). **Requires the `write_intents` migration.** `enqueueWriteIntent` dedups on `idempotencyKey` (a retried POST returns the SAME intent), `settleWriteIntent` only transitions pending rows (at-least-once redelivery after success is a no-op), and `expireStaleWriteIntents` backstops intents whose event dead-lettered in the outbox.
