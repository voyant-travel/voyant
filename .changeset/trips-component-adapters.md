---
"@voyant-travel/trips": minor
"@voyant-travel/operator": patch
---

`@voyant-travel/trips` now owns the trip component-orchestration logic: new `createCatalogComponentAdapter(options)` (from `@voyant-travel/trips` and `./catalog-component`) and `createFlightComponentAdapter(options)` (`./flight-component`). These own offer validation, reserve-with-origin tracking, hold release, cancellation mapping, flight price-change/expiry detection, and passenger-roster building. Deployment-specific pieces (promotion evaluator, operator tax recompute, source/owned registries, flight adapter, checkout hand-off) are injected. The operator's `trips-catalog-runtime` (515→211) and `trips-flight-runtime` (231→63) collapse to thin wiring. Adds `@voyant-travel/bookings` + `@voyant-travel/flights` to trips deps.
