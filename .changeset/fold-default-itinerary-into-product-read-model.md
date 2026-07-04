---
"@voyant-travel/products-contracts": minor
"@voyant-travel/inventory": minor
---

Fold the product's default itinerary into the catalog product read-model document.

`getCatalogProductById` (and the `/v1/public/products/:id` + `/slug/:slug`
read-through documents) can now include the product's default day-by-day
itinerary — days and day-services with `product_day_translations` /
`product_day_service_translations` resolved by the document's locale, plus a
per-day thumbnail. It is opt-in via `?include=itinerary`, encoded in the
read-model variant so itinerary and non-itinerary documents cache — and warm on
mutation — independently. Only the product default itinerary is folded;
departure-specific overrides stay on the departure itinerary endpoint.

The itinerary update/delete/duplicate admin routes (keyed on the itinerary id,
not the product id) now trigger read-model recompute so the folded itinerary
stays fresh.
