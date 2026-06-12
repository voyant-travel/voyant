---
"@voyantjs/bookings": patch
"@voyantjs/products": patch
"@voyantjs/suppliers": patch
"@voyantjs/finance": patch
"@voyantjs/availability": patch
---

`GET /aggregates` (admin dashboard KPIs) is now served through a read-through TTL snapshot (`readThroughAggregateSnapshot` from `@voyantjs/db/aggregate-snapshots`, 60s TTL, keyed by endpoint + query params): the first request computes and stores, subsequent requests within the TTL are ONE indexed read instead of the full aggregate fan-out (finance alone was ~11 queries per dashboard load). Response shapes are unchanged. `Cache-Control` on these endpoints tightened from `private, max-age=60` to `private, max-age=30` (availability gains the header for the first time). Requires the `aggregate_snapshots` table from the upcoming @voyantjs/db migration — until it is applied, endpoints transparently fall back to live computation.
