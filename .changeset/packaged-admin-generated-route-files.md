---
"@voyantjs/admin": minor
"@voyantjs/core": minor
---

Packaged-admin RFC §4.8 (route assembly, increment 1) — framework half of
`voyant admin generate --routes`:

- `@voyantjs/admin` exports `requireAdminRoute(extension, routeId)` (plus the
  `BindableAdminRoute` type): looks up a route contribution by id and asserts
  it carries a component, so generated thin route files fail loudly at module
  evaluation when an extension stops shipping the route they bind.
  `AdminRouteRuntime.fetcher` is narrowed to the string-URL `VoyantFetcher`
  convention every `*-react` data client uses, so host fetchers (and the
  global `fetch`) bind directly into generated loaders.
- `@voyantjs/core` manifest grows `admin.routes` (`AdminRoutesConfig`): the
  host route-tree directory and the runtime-import bindings (`apiUrlModule`/
  `apiUrlExport`, `fetcherModule`/`fetcherExport`) the route generator emits,
  with operator-convention defaults. Validated by `validateVoyantConfig`.

The operator's promotions index route is now generated output of the new
command (byte-for-byte reproducible from `@voyantjs/promotions-ui/admin`).
