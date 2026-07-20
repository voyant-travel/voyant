---
"@voyant-travel/inventory": patch
---

Price rooms whose unit price is set per traveler category. The product editor's "Rooms & prices" matrix stores a room's price per traveler type (e.g. Double / Adult), and the booking engine previously dropped every unit-price row that carried a `pricingCategoryId` — so such products quoted `no_sell_amount_configured` and could not be priced or booked through the journey. Per-category room prices now resolve to their band and charge per person (`pax[band] × price`); category-less room prices, pax tiers, and the product-base fallback are unchanged.
