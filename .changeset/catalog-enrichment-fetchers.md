---
"@voyantjs/catalog-ui": minor
---

Add `createCatalogEnrichmentFetchers({ baseUrl, formatSupplier?, locale?, market?, contentBasePath?, loadSlotAvailability? })` and a matching `CatalogPage` prop `enrichmentFetchers`. Lifts the `/v1/admin/products/:id/content` URL contract out of host-template glue code and into a first-class export, mirroring `createCatalogBookingFetchers`. Hosts that pass `enrichmentFetchers` no longer need to hand-roll `onLoadProductDetail`. On the first 404 response (the symptom when a host forgets to mount `createProductContentRoutes` from `@voyantjs/products/routes-content`), the fetcher emits a one-time `console.warn` that names the missing route — so the silent "empty detail sheet" failure mode called out in issue #1023 turns into a loud actionable hint.
