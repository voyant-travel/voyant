---
"@voyant-travel/catalog": patch
"@voyant-travel/catalog-contracts": patch
"@voyant-travel/inventory": patch
"@voyant-travel/products-contracts": patch
---

Add node-aware localized editorial overlays for sourced product content, including stable content-node targeting, optimistic overlay versions, audit history, product admin read/write/clear routes, and public provenance redaction.

Tighten editorial overlay scope isolation for product content reads and writes, require admin overlay mutations to carry an authenticated user id, and make overlay mutations/history atomic with race-safe optimistic version checks.
