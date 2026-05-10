---
"@voyantjs/promotions": patch
---

Normalize active-offer timestamp predicates so `valid_from` and `valid_until` comparisons both use Drizzle timestamp encoders, fixing postgres-js catalog projection reindexing for `createProductPromotionsProjectionExtension()`.
