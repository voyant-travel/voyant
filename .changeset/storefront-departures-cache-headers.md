---
"@voyantjs/storefront": patch
---

Public departure reads (`GET /departures/:id`, `GET /products/:id/departures`, `GET /products/:id/departures/:id/itinerary`) now emit `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on success, making them eligible for the framework/platform shared cache (they are non-personalized catalog data; see #1686).
