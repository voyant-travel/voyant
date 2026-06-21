---
"@voyant-travel/schema-kit": patch
---

Fix duplicate TypeID prefix `pdst`: `product_day_service_translations` (added in #2067) collided with the existing `product_destinations`. Re-prefix the day-service-translations table to `pdsr` so prefix→table lookup is unambiguous and the `db` "no duplicate prefix" test passes.
