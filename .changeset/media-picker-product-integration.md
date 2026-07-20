---
"@voyant-travel/inventory-react": minor
"@voyant-travel/inventory": patch
"@voyant-travel/products-contracts": patch
---

Add a "Choose from Media Library" action to the product media section so
operators can attach existing library assets to a product or itinerary day
instead of only uploading new files. Product media now records the source
asset reference (`assetId`) alongside the derived byte URL, kind, mime type,
and size.
