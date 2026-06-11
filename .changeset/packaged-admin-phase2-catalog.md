---
"@voyantjs/catalog-ui": minor
---

Packaged-admin RFC Phase 2, second pilot (#1643): new
`@voyantjs/catalog-ui/admin` entrypoint. `createCatalogAdminExtension({ labels })`
contributes 10 route entries (5 catalog surfaces × browse + detail) carrying
the package-owned search contracts (`catalogSearchSchema`,
`productDetailSearchSchema` — the latter moved out of the operator route
file). No navigation contributed — the Catalog group is base-nav-owned.
Page components remain host-side for now: they depend on the app RPC client
and typed router navigation into other routes (booking journey, supplier and
product detail), which is the documented gap to close before catalog pages
can be package-delivered.
