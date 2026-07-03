---
"@voyant-travel/framework-migrations": patch
---

Run a compatibility preflight before the inventory product-days uniqueness migration so existing duplicate itinerary day numbers are deterministically renumbered before the unique index is created.
