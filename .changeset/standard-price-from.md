---
"@voyantjs/pricing": patch
---

Fix catalog price-from projection to prefer unrestricted standard pricing over cheaper child, age-qualified, or quantity-restricted unit prices, falling back to restricted prices only when no standard price exists.
