---
"@voyant-travel/commerce": patch
---

Validate promotion product scopes against real products before creating or updating offers, preventing dangling `promotional_offer_products` rows for unknown product ids.
