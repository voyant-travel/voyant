---
"@voyant-travel/catalog": minor
---

The catalog module now owns the catalog-booking route logic. New exports (from
`@voyant-travel/catalog` + `@voyant-travel/catalog/booking-engine`):
`mountCatalogBookingRoutes(hono, options)`, `createCatalogBookingOrdersRoutes`,
and `CatalogBookingRouteModuleOptions`. The deployment injects the booking-engine
options + a registry resolver; the booking-engine lifecycle (quote/book/holds)
and order management (list/get/cancel) routes no longer live in the deployment.
The slots + catalog-snapshot handlers stay a thin deployment extension because
inventory/operations already depend on catalog (moving them would cycle).
