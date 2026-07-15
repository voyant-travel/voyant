---
"@voyant-travel/availability": patch
"@voyant-travel/bookings": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog": patch
"@voyant-travel/catalog-contracts": patch
"@voyant-travel/finance": patch
"@voyant-travel/inventory": patch
"@voyant-travel/operations": patch
---

Keep catalog booking and checkout as a two-phase flow, and atomically convert
owned-product availability holds into on-hold booking allocations without
consuming capacity twice. Hold placement and release are now idempotent across
retries and duplicate tokens, converted holds retain an audit link to their
booking allocation, and checkout-only intents receive structured validation
errors from the reservation route.
