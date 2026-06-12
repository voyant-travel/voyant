---
"@voyantjs/plugin-netopia": patch
---

Netopia routes gained uniform idempotency. The provider callback (`POST /providers/netopia/callback`) now dedupes provider retries on the provider's own event identity — a synthetic `Idempotency-Key` derived from the payload's `(ntpID, status)` pair feeds the standard `idempotencyKey()` middleware, so a re-delivered callback replays the stored response instead of re-running session completion (the same `infra idempotency_keys` storage as every other keyed mutation; no parallel dedup mechanism). The client-initiated start/collect POSTs (`payment-sessions/:id/start`, schedule/guarantee/invoice `collect`) accept an optional `Idempotency-Key` header the same way.
