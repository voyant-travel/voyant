---
"@voyantjs/admin": minor
"@voyantjs/admin-app": minor
"@voyantjs/catalog-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/legal-react": minor
"@voyantjs/notifications-react": minor
---

Packaged-admin final sweep: the CORE admin pages ship from
`@voyantjs/admin-app` as a built-in extension, and index redirects become
contribution-driven. The operator deleted its last 18 core route files
(12 settings files, `/account`, the dashboard host, and the 4 domain index
redirects) plus the superseded settings/account components.

- `@voyantjs/admin`: `AdminUiRouteContribution` grows `redirectTo?: string`
  (a redirect contribution counts as implemented on its own — host binders
  emit a before-load redirect, which also covers SSR) and `children?:
  AdminUiRouteContribution[]` (nested child contributions under a layout
  contribution; child paths are parent-relative, `"/"` is the index). New
  `findAdminRouteContribution` does the depth-first lookup;
  `requireImplementedAdminRoute` accepts redirect contributions and
  resolves nested children.
- `@voyantjs/admin-app`: new `createAdminCoreExtension(options)` (exported
  from the root and `./core-extension`) — the `core` extension contributing
  `/` (the dashboard page behind a lazy chunk; hosts supply an SSR
  aggregates loader via `dashboard.loader`), `/account` (auth-react's
  packaged `AccountPage`), and the `/settings` area: a packaged layout
  (grouped sub-nav + outlet, labels resolved reactively from the operator
  admin messages) with nested children — an index redirect (default
  `/settings/channels`) and the nine built-in pages (team, API tokens,
  channels, taxes, cost categories, pricing categories, price catalogs,
  product types, product tags). Surfaces eject with `false`; built-in
  settings pages drop via `settings.omit`; app-custom settings pages splice
  in via `settings.extraPages` (the operator's Operator Profile page uses
  this). The binder gains redirect support (`beforeLoad` throwing the
  router redirect) and `adminExtensionChildRoutes(...)` for binding
  runtime-known children the generated route module cannot emit
  statically. The new domain peers (auth/distribution/finance/pricing/
  products react) are optional and only loaded by the lazy page/loader
  chunks.
- `@voyantjs/catalog-react` / `@voyantjs/finance-react` /
  `@voyantjs/legal-react` / `@voyantjs/notifications-react`: the admin
  extensions contribute their index redirect (`/catalog` →
  `/catalog/products`, `/finance` → `/finance/invoices`, `/legal` →
  `/legal/contracts`, `/notifications` → `/notifications/templates`),
  replacing the operator's redirect route files.
- Host typed-link merge note: extension routes now REPLACE file routes on
  key conflicts in the merged route-type maps (`Omit` before the
  intersection) — the pathless workspace layout claims `/` in the generated
  file types once the index file route is deleted, while at runtime `/` is
  the core extension's dashboard route.
