---
"@voyant-travel/action-ledger-react": minor
"@voyant-travel/bookings": minor
"@voyant-travel/catalog": minor
"@voyant-travel/commerce": minor
"@voyant-travel/core": minor
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
"@voyant-travel/notifications": minor
"@voyant-travel/operator-standard": minor
"@voyant-travel/runtime": minor
---

Retire the Voyant workflow product and its workflow-runs administration
surface. Product-owned background behavior is now represented by jobs and
subscribers, while in-process compensating domain coordination is exposed as a
saga. Remove workflow deployment providers, graph facets, source conventions,
runtime composition, and starter scripts.
