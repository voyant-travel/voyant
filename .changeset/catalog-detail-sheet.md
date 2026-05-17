---
"@voyantjs/catalog-ui": patch
"@voyantjs/products": patch
"@voyantjs/products-ui": patch
---

Rebuild the catalog detail sheet and the underlying product content/policy plumbing.

- `CatalogDetailSheet` is reorganized into stacked sections (header, gallery, itinerary, services, policies, sourced content) with proper loading and empty states; the search and grid pages share the new sheet.
- New itinerary section on the product detail surface (in template + catalog) so day-by-day plans render the same way in catalog browsing and operator editing.
- `@voyantjs/products`: introduce `catalog-policy` + `content-shape` modules to centralize how cancellation/booking policies and content blocks are resolved on the catalog plane. `service-catalog-plane` and `service-content-owned` now consume these instead of inlining policy logic per call site.
- Catalog i18n strings added for itinerary, services, and policy sections (EN + RO).
- Operator template: drop `product-sourced-content-section` (now provided by the catalog detail sheet) and update the product detail page to render the new sections.
