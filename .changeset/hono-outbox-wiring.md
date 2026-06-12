---
"@voyantjs/hono": minor
---

`createApp({ outbox: true })` makes request emits durable: envelopes persist to the `event_outbox` table (via the per-request db client) before any subscriber runs; failed deliveries are retried by `drainOutbox` (run it from a cron — see the operator template's `*/2min` drain). If the durable capture itself fails (DB unreachable), the emit falls back to direct delivery with an error log rather than failing the request. The augmented app now exposes `app.eventBus` so scheduled handlers can drain through the same subscriber set.
