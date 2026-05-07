---
"@voyantjs/i18n": patch
---

Add admin strings for the simplified per-unit pricing table (#466).

The operator UI now hides the unit×category pricing matrix when a price rule uses `pricingMode = "per_person"` and `allPricingCategories = true` — the pax-bucket unit (Adult / Child / Infant) already encodes the differentiation, so the 12-column room/group/category matrix is just noise on day-trip products. Three new strings power the simplified table:

- `products.operations.priceRules.unitPricingTitle` — section title when the simple table renders
- `products.operations.priceRules.tableSell` — Sell column header
- `products.operations.priceRules.tableCost` — Cost column header (reserved for future per-unit cost editing)

Existing `unitCategoryTitle` and `tableUnit` strings still drive the full matrix when `allPricingCategories` is off.
