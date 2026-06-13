---
"@voyantjs/promotions": patch
---

Remove the Promotions runtime dependency on Product schemas. Category and
destination promotion scopes now expand through a resolver seam with a raw SQL
fallback against the Product-owned link tables, while Product remains a
dev/test dependency for integration coverage.
