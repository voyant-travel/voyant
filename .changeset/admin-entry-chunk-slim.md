---
"@voyantjs/availability-react": minor
"@voyantjs/bookings-react": minor
"@voyantjs/catalog-react": minor
"@voyantjs/crm-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/legal-react": minor
"@voyantjs/notifications-react": minor
"@voyantjs/resources-react": minor
"@voyantjs/suppliers-react": minor
---

Slim the admin entry barrels so the host's workspace-chrome chunk stops pinning domain data layers and page hosts (operator client entry: 3.74 MB → 1.83 MB).

- Route contribution loaders now resolve query options / page-data helpers via dynamic `import()` inside the loader body, keeping clients + response schemas (and the backend validation graphs they pull) out of the eagerly evaluated entry chunk.
- `@voyantjs/<domain>-react/admin` barrels no longer re-export page/host/dialog/widget component **values** (packaged-admin RFC §4.8 endgame rule: specific modules, never barrels). Their prop **types** still re-export from the barrels; import component values from their specific modules instead (e.g. `@voyantjs/bookings-react/admin/booking-detail-host`). New `./admin/*` subpath exports on `@voyantjs/bookings-react` and `@voyantjs/availability-react` cover the known host-side imports.
- Widget slot ids moved into lean `admin/slots` modules (`bookings-react`, `crm-react`, `suppliers-react`); the host modules re-export them, so existing imports keep working.
- Widget contributions (`PersonBookingsWidget`, the four finance cards) now mount through Suspense-wrapped `React.lazy` loaders, so their chunks fetch when the slot actually renders.
- Search schemas stay synchronous: `catalogSearchSchema` re-exports from the schema-only `catalog-search-params` module instead of the catalog main barrel; the bookings search contracts already lived in the admin entry.
- Resources detail-page skeletons extracted to `components/resource-detail-skeletons` (re-exported from the page modules) so `pendingComponent`s no longer pin the detail pages into the entry graph.
