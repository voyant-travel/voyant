---
"@voyantjs/commerce": minor
"@voyantjs/markets": patch
"@voyantjs/pricing": patch
"@voyantjs/promotions": patch
"@voyantjs/sellability": patch
---

Move Markets, Pricing, Promotions, and Sellability runtime source behind the
Commerce owner path. The old packages now delegate to Commerce as compatibility
facades while keeping existing schema and template manifests stable during the
v1 package restructure.
