---
"@voyantjs/products": patch
---

Catalog-plane read-path batching: `listResolvedProducts` now fetches overlays for the whole page in ONE query (via the new `fetchOverlaysForEntities`) and applies them in-memory per product — 1 overlay query for N products instead of N sequential ones, with byte-identical per-product output. The storefront-card projection extension also folds the available-departures count into its first parallel query wave (6 queries in 2 waves instead of 4+1+1 in 3 sequential steps); only the itinerary-duration estimate still trails, because it depends on the default itinerary picked from the first wave.
