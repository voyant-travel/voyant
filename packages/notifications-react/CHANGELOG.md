# @voyantjs/notifications-react

## 0.111.7

### Patch Changes

- 1595c69: Split oversized notification reminder services and promotions/notification React modules into focused internal files while preserving existing public exports and behavior.
- Updated dependencies [1595c69]
  - @voyantjs/notifications@0.111.7

## 0.111.6

### Patch Changes

- @voyantjs/notifications@0.111.6

## 0.111.5

### Patch Changes

- @voyantjs/notifications@0.111.5
- @voyantjs/ui@0.106.1

## 0.111.4

### Patch Changes

- @voyantjs/notifications@0.111.4

## 0.111.3

### Patch Changes

- @voyantjs/notifications@0.111.3

## 0.111.2

### Patch Changes

- @voyantjs/notifications@0.111.2

## 0.111.1

### Patch Changes

- @voyantjs/notifications@0.111.1

## 0.111.0

### Minor Changes

- 41b08db: Packaged-admin final sweep: the CORE admin pages ship from
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

### Patch Changes

- Updated dependencies [41b08db]
  - @voyantjs/admin@0.111.0
  - @voyantjs/notifications@0.111.0

## 0.110.1

### Patch Changes

- @voyantjs/notifications@0.110.1

## 0.110.0

### Patch Changes

- Updated dependencies [9c909e2]
  - @voyantjs/admin@0.110.0
  - @voyantjs/notifications@0.110.0

## 0.109.0

### Minor Changes

- 279f97c: Slim the admin entry barrels so the host's workspace-chrome chunk stops pinning domain data layers and page hosts (operator client entry: 3.74 MB → 1.83 MB).

  - Route contribution loaders now resolve query options / page-data helpers via dynamic `import()` inside the loader body, keeping clients + response schemas (and the backend validation graphs they pull) out of the eagerly evaluated entry chunk.
  - `@voyantjs/<domain>-react/admin` barrels no longer re-export page/host/dialog/widget component **values** (packaged-admin RFC §4.8 endgame rule: specific modules, never barrels). Their prop **types** still re-export from the barrels; import component values from their specific modules instead (e.g. `@voyantjs/bookings-react/admin/booking-detail-host`). New `./admin/*` subpath exports on `@voyantjs/bookings-react` and `@voyantjs/availability-react` cover the known host-side imports.
  - Widget slot ids moved into lean `admin/slots` modules (`bookings-react`, `crm-react`, `suppliers-react`); the host modules re-export them, so existing imports keep working.
  - Widget contributions (`PersonBookingsWidget`, the four finance cards) now mount through Suspense-wrapped `React.lazy` loaders, so their chunks fetch when the slot actually renders.
  - Search schemas stay synchronous: `catalogSearchSchema` re-exports from the schema-only `catalog-search-params` module instead of the catalog main barrel; the bookings search contracts already lived in the admin entry.
  - Resources detail-page skeletons extracted to `components/resource-detail-skeletons` (re-exported from the page modules) so `pendingComponent`s no longer pin the detail pages into the entry graph.

- faec538: Generated destination resolver maps (packaged-admin RFC §4.7 endgame).

  `AdminUiRouteContribution` gains `destination?: AdminDestinationKey` +
  `destinationParams?: Record<string, string>`: a route contribution now
  DECLARES which semantic destination key its path satisfies by pure param
  interpolation (e.g. `/suppliers/$id` satisfying
  `"supplier.detail": { supplierId: string }` via `{ id: "supplierId" }`).
  The eight domain packages annotate their 29 route-backed destinations, so
  `voyant admin generate --destinations` can emit the host's resolver map
  instead of the host hand-writing it — the operator's map shrank to
  `{ ...generatedAdminDestinations, ...custom }` with only seven genuinely
  custom resolvers (search-param construction, multi-route targets, and
  host-owned pages), and `voyant admin doctor` gates on drift between the
  annotations and the generated module.

### Patch Changes

- Updated dependencies [faec538]
  - @voyantjs/admin@0.109.0
  - @voyantjs/notifications@0.109.0

## 0.108.0

### Minor Changes

- 478aa7c: Packaged-admin RFC §4.8 endgame — the code-assembled extension route tree.
  Package-delivered admin pages exist as NO per-route files in the host: the
  operator deleted ~50 thin host route files across all 10 admin domains; the
  route tree for extension routes is assembled in code from the contributions
  and grafted under the file-based workspace layout, with typed links intact.

  - `@voyantjs/admin`: `AdminUiRouteContribution` grows `page?: () =>
Promise<AdminRoutePageModule>` — a lazy page-module loader (pages stay
    code-split, hover/intent preloading fetches the chunk ahead of
    navigation). The resolved component receives `AdminRoutePageProps`
    (`params`/`search`/`updateSearch`/`title`), dissolving the old "zero-prop
    components only" restriction — param-taking detail pages need no host
    route file. `AdminRouteLoaderContext` gains `params`. New helpers:
    `requireImplementedAdminRoute` (loud failure at module evaluation when a
    bound contribution loses its implementation) and `adminRoutePageModule`
    (adapter for zero-prop / all-optional-prop hosts).
  - `@voyantjs/admin-app`: new binder — `adminExtensionRouteOptions(extension,
routeId, runtime)` returns router-facing route options (lazy component,
    loader bound to `{ queryClient, runtime, params }`, per-route `ssr`,
    boundaries) ready to spread into a code-based `createRoute({...})`, and
    `attachAdminExtensionRoutes(routeTree, parentRoute, routes)` grafts the
    built routes under the workspace layout idempotently (replace-by-path,
    dev-server re-evaluation safe).
  - All 10 `*-react` admin extensions now carry full route implementations:
    lazy `page` loaders (dynamic imports of the specific host modules, never
    the admin barrel), loaders moved verbatim from the operator route files
    (SSR modes preserved exactly, `data-only` included), pending skeletons,
    and search contracts. Bookings adds host-composition options
    (`indexHeaderActions`, `detailPageComponent` + exported
    `BookingDetailPageComponentProps`) so app-owned composition rides through
    the factory instead of a route file. Finance's supplier-invoices pages
    stay metadata-only (app-owned upload/supplier-picker/cross-domain search
    wiring) and remain host route files.

  Hosts bind everything in one checked-in generated module
  (`src/admin.routes.generated.tsx`): per route a `createRoute` call with the
  path literal + typed search schema, spreading the binder options, plus
  `AdminExtensionRoutesBy*` typed-link maps that `router.tsx` merges with the
  generated `FileRouteTypes` via `_addFileTypes` — `Link`/`navigate` stay
  fully typed for file routes and extension routes alike.

### Patch Changes

- Updated dependencies [478aa7c]
  - @voyantjs/admin@0.108.0
  - @voyantjs/notifications@0.108.0

## 0.107.0

### Minor Changes

- 6c27159: Merge each module's `*-ui` package into its `*-react` sibling (#1652). The
  `*-react` package is now the whole client tier: the headless exports (root,
  `./hooks`, `./client`, `./provider`) are unchanged, and the styled tier moves
  in under new subpaths — `./ui` (the old `*-ui` root barrel), `./components/*`,
  `./admin`, `./i18n`, `./i18n/en`, `./i18n/ro`, and `./styles.css`.

  Migration from `@voyantjs/<module>-ui`:

  - `@voyantjs/<module>-ui` → `@voyantjs/<module>-react/ui`
  - `@voyantjs/<module>-ui/<subpath>` → `@voyantjs/<module>-react/<subpath>`
  - package.json: drop the `-ui` dependency; `-react` covers both tiers.

  Styled-tier peers (`@voyantjs/ui`, `@voyantjs/admin`, `@tanstack/react-table`,
  `sonner`, `react-hook-form`, sibling `*-react` hooks packages) are optional
  peers — headless consumers that only import the root/`hooks`/`client` subpaths
  do not need them. The 27 `@voyantjs/*-ui` packages are deprecated on npm in
  favor of these subpaths; `@voyantjs/allocation-ui` and
  `@voyantjs/workflow-runs-ui` (no `-react` sibling) are unaffected.

### Patch Changes

- Updated dependencies [eeb23df]
  - @voyantjs/admin@0.107.0
  - @voyantjs/notifications@0.107.0

## 0.106.0

### Patch Changes

- @voyantjs/notifications@0.106.0

## 0.105.2

### Patch Changes

- @voyantjs/notifications@0.105.2

## 0.105.1

### Patch Changes

- @voyantjs/notifications@0.105.1

## 0.105.0

### Patch Changes

- @voyantjs/notifications@0.105.0

## 0.104.5

### Patch Changes

- Updated dependencies [a0e117b]
  - @voyantjs/notifications@0.104.5

## 0.104.4

### Patch Changes

- @voyantjs/notifications@0.104.4

## 0.104.3

### Patch Changes

- Updated dependencies [28c5eb3]
  - @voyantjs/notifications@0.104.3

## 0.104.2

### Patch Changes

- @voyantjs/notifications@0.104.2

## 0.104.1

### Patch Changes

- Updated dependencies [ba5daa6]
  - @voyantjs/notifications@0.104.1
  - @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/notifications@0.104.0
- @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/notifications@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/notifications@0.102.0
- @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/notifications@0.101.2
- @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/notifications@0.101.1
- @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/notifications@0.101.0
- @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/notifications@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/notifications@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/notifications@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/notifications@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/notifications@0.96.0
- @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/notifications@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/notifications@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/notifications@0.93.0
- @voyantjs/react@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/notifications@0.92.0
- @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/notifications@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/notifications@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/notifications@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/notifications@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/notifications@0.87.1
- @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/notifications@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/notifications@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/notifications@0.85.4
- @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/notifications@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/notifications@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/notifications@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/notifications@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/notifications@0.84.4
- @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/notifications@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/notifications@0.84.2
- @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/notifications@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- @voyantjs/notifications@0.84.0
- @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/notifications@0.83.1
- @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/notifications@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/notifications@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/notifications@0.82.0
- @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/notifications@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/notifications@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/notifications@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/notifications@0.81.18
- @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/notifications@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- @voyantjs/notifications@0.81.16
- @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/notifications@0.81.15
- @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/notifications@0.81.14
- @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/notifications@0.81.13
- @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/notifications@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/notifications@0.81.11
- @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/notifications@0.81.10
- @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/notifications@0.81.9
- @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/notifications@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/notifications@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/notifications@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/notifications@0.81.5
- @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/notifications@0.81.4
- @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/notifications@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/notifications@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/notifications@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/notifications@0.81.0
- @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/notifications@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/notifications@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/notifications@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/notifications@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/notifications@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/notifications@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/notifications@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/notifications@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/notifications@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/notifications@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/notifications@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/notifications@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/notifications@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/notifications@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/notifications@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/notifications@0.80.3
- @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/notifications@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/notifications@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/notifications@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/notifications@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/notifications@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/notifications@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- Updated dependencies [bf74cd4]
  - @voyantjs/notifications@0.77.12
  - @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/notifications@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/notifications@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/notifications@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/notifications@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/notifications@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/notifications@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/notifications@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/notifications@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/notifications@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/notifications@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/notifications@0.77.1
- @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/notifications@0.77.0
- @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/notifications@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/notifications@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/notifications@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/notifications@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/notifications@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/notifications@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/notifications@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/notifications@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/notifications@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/notifications@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/notifications@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/notifications@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/notifications@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/notifications@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/notifications@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/notifications@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/notifications@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/notifications@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/notifications@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/notifications@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/notifications@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/notifications@0.66.6
- @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/notifications@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/notifications@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/notifications@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/notifications@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/notifications@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/notifications@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/notifications@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- Updated dependencies [572dde4]
  - @voyantjs/notifications@0.64.1
  - @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/notifications@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/notifications@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/notifications@0.63.0
- @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/notifications@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/notifications@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/notifications@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/notifications@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/notifications@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/notifications@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/notifications@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/notifications@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/notifications@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/notifications@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- @voyantjs/notifications@0.55.1
- @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/notifications@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/notifications@0.54.0
- @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/notifications@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/notifications@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/notifications@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/notifications@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/notifications@0.52.3
- @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyantjs/notifications@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/notifications@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/notifications@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/notifications@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/notifications@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/notifications@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/notifications@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- @voyantjs/notifications@0.50.6
- @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/notifications@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/notifications@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/notifications@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/notifications@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/notifications@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/notifications@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- Updated dependencies [3029f10]
  - @voyantjs/notifications@0.49.0
  - @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/notifications@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/notifications@0.47.0
- @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/notifications@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/notifications@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/notifications@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/notifications@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/notifications@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/notifications@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/notifications@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/notifications@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/notifications@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/notifications@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/notifications@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/notifications@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/notifications@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/notifications@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/notifications@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/notifications@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/notifications@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/notifications@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/notifications@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/notifications@0.34.0
- @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/notifications@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/notifications@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/notifications@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/notifications@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/notifications@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/notifications@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/notifications@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/notifications@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/notifications@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/notifications@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/notifications@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/notifications@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/notifications@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/notifications@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/notifications@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/notifications@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/notifications@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/notifications@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/notifications@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Minor Changes

- 4a6523e: Reminder sequences UI (#488).

  New `@voyantjs/notifications-ui` package with the reminder-sequence editing surface:

  - `<StageList />` — ordered stages per rule, with reorder + delete and an embedded channel list.
  - `<StageEditorDialog />` — anchor / window / cadence (`once` | `every_n_days` | `escalating(buckets[])`) / `maxSendsInStage` / `respectQuietHours`.
  - `<StageChannelList />` + `<StageChannelEditorDialog />` — per-stage multi-channel rows (channel, template, recipient kind, optional role).
  - `<NotificationSettingsForm />` — quiet hours / blackout dates / weekend skip / recipient daily cap / suppression window.
  - `<RemindersPreviewList />` — read-only "what would fire on this date" table with reasoning per row.
  - Full en/ro i18n with `NotificationsUiMessagesProvider`.

  Hooks added to `@voyantjs/notifications-react`:

  - `useReminderRuleStages`, `useReminderRuleStageMutation` (create, update, delete, reorder)
  - `useReminderStageChannels`, `useReminderStageChannelMutation`
  - `useNotificationSettings`, `useNotificationSettingsMutation`
  - `useRemindersPreview`

  Operator template wires up three new routes (`/notifications/reminder-rules/:id`, `/notifications/preview`, `/notifications/settings`) and the operator nav gains Preview + Settings entries.

### Patch Changes

- 4a6523e: Drop legacy single-offset reminder path; polish channel editor (#488).

  Stage channel editor:

  - Replaces the two free-text "Template id / Template slug" fields with
    a single async `<TemplatePicker>` (typeahead via `AsyncCombobox`)
    filtered by the channel selected at the top of the dialog. Picking
    a template now resolves to the template id directly — no more
    guessing slugs. Switching channel clears the picked template since
    the next list will be filtered.
  - Provider becomes a `<Select>` with **Automatic** / **Resend
    (email)** / **Twilio (SMS)** options. "Automatic" maps to `null`
    (use the deployment default for that channel).
  - Drops the freeform "Recipient role" field. Recipient resolution is
    driven by the booking's primary contact / first traveler today;
    the role tag wasn't actually consulted by the dispatcher.

  Backend cleanup (we're in beta — no users, no compat needed):

  - Drops the `relative_days_from_due_date` column from
    `notification_reminder_rules` (migration
    `0003_drop_legacy_columns.sql`).
  - Drops the `holiday_calendar` column from `notification_settings`
    (UI was already gone; the underlying public-holidays integration is
    out of scope for this iteration).
  - Removes the legacy single-offset dispatcher path entirely:
    `queueDueReminders` and `runDueReminders` now delegate straight to
    the stage-aware versions, and the four legacy helpers
    (`queueBookingPaymentScheduleReminder`,
    `queueInvoiceReminder`, `sendBookingPaymentScheduleReminder`,
    `sendInvoiceReminder`) plus the `ruleHasStages` skip check are
    deleted. Net ~500 lines removed from `service-reminders.ts`.
  - `relativeDaysFromDueDate` removed from validation, the run-summary
    schema, the notifications-react record schema, the operator
    template detail page, the legacy rule dialog, and the checkout
    service's reminder-runs join projection.
  - Legacy integration tests `reminders.test.ts` and
    `reminder-tasks.test.ts` are deleted; the stage-based
    `reminder-sequences.test.ts` covers the path that survives.

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/notifications@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/notifications@0.28.3
- @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/notifications@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/notifications@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/notifications@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/notifications@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/notifications@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/notifications@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/notifications@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/notifications@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/notifications@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/notifications@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/notifications@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/notifications@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/notifications@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/notifications@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/notifications@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/notifications@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/notifications@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/notifications@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/notifications@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/notifications@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/notifications@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/notifications@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/notifications@0.21.0
  - @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/notifications@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/notifications@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/notifications@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/notifications@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/notifications@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/notifications@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/notifications@0.14.0
  - @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/notifications@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/notifications@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/notifications@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/notifications@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/notifications@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/notifications@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/notifications@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/notifications@0.6.9
- @voyantjs/react@0.6.9
