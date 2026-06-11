---
"@voyantjs/catalog-ui": minor
---

Packaged-admin RFC catalog pilot, pages delivered: the operator's catalog
page wrappers move into `@voyantjs/catalog-ui/admin` as packaged hosts —
`CatalogVerticalHost` (indexed browse grid wired to markets/locales/
suppliers/product-tag mutations/slot availability), `DynamicCatalogHost`,
`ScheduledCatalogHost`, `ProductDetailHost`, `CruiseDetailHost`, and
`VerticalDetailHost`. Cross-route links (booking journey, supplier page,
product editor, catalog detail) resolve through the semantic destination
keys (RFC §4.7) via `useAdminHref`/`useAdminNavigate`; API access comes from
the shell's catalog provider context (`fetchCatalogSlots` replaces the app
RPC client). Also exports `catalogVerticalPageIds`/`CatalogVerticalPageId`
from the surface taxonomy. Host route files shrink to param/search binding;
`component:` stays off the route contributions until the §4.2 code-based
route assembly gives packaged pages router-agnostic route state. New peers:
`@voyantjs/markets-react`, `@voyantjs/products-react`,
`@voyantjs/suppliers-react`, `sonner`.
