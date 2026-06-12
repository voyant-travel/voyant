---
"@voyantjs/storefront": patch
---

`GET /products/:productId/departures` is read-through against the `env.CACHE` KV binding with a 120s TTL (keyed per product + query params). Departure availability shifts with every booking, so this is deliberately TTL-bounded rather than invalidated — browse-grade freshness within 2 minutes, while checkout always re-verifies capacity on the live transactional path. Degrades to the live query without the binding.
