# @voyantjs/legal-react

## 0.117.0

### Patch Changes

- @voyantjs/legal@0.117.0
- @voyantjs/bookings-react@0.117.0
- @voyantjs/crm-react@0.117.0
- @voyantjs/distribution-react@0.109.2
- @voyantjs/markets-react@0.107.2
- @voyantjs/products-react@0.117.0
- @voyantjs/suppliers-react@0.111.2

## 0.116.0

### Patch Changes

- @voyantjs/legal@0.116.0
- @voyantjs/products-react@0.116.0
- @voyantjs/bookings-react@0.116.0
- @voyantjs/crm-react@0.116.0
- @voyantjs/distribution-react@0.109.1
- @voyantjs/markets-react@0.107.1
- @voyantjs/suppliers-react@0.111.1

## 0.115.0

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
- Updated dependencies [6d496d0]
  - @voyantjs/admin@0.111.0
  - @voyantjs/products-react@0.115.0
  - @voyantjs/bookings-react@0.115.0
  - @voyantjs/crm-react@0.115.0
  - @voyantjs/distribution-react@0.109.0
  - @voyantjs/suppliers-react@0.111.0
  - @voyantjs/legal@0.115.0

## 0.114.0

### Patch Changes

- Updated dependencies [f7bd971]
  - @voyantjs/distribution-react@0.108.0
  - @voyantjs/bookings-react@0.114.0
  - @voyantjs/products-react@0.114.0
  - @voyantjs/crm-react@0.114.0
  - @voyantjs/legal@0.114.0
  - @voyantjs/suppliers-react@0.110.1

## 0.113.0

### Patch Changes

- Updated dependencies [9c909e2]
  - @voyantjs/bookings-react@0.113.0
  - @voyantjs/admin@0.110.0
  - @voyantjs/crm-react@0.113.0
  - @voyantjs/suppliers-react@0.110.0
  - @voyantjs/products-react@0.113.0
  - @voyantjs/legal@0.113.0
  - @voyantjs/distribution-react@0.107.3

## 0.112.0

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

- Updated dependencies [279f97c]
- Updated dependencies [faec538]
  - @voyantjs/bookings-react@0.112.0
  - @voyantjs/crm-react@0.112.0
  - @voyantjs/suppliers-react@0.109.0
  - @voyantjs/admin@0.109.0
  - @voyantjs/products-react@0.112.0
  - @voyantjs/legal@0.112.0
  - @voyantjs/distribution-react@0.107.2

## 0.111.0

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
  - @voyantjs/bookings-react@0.111.0
  - @voyantjs/crm-react@0.111.0
  - @voyantjs/suppliers-react@0.108.0
  - @voyantjs/products-react@0.111.0
  - @voyantjs/legal@0.111.0
  - @voyantjs/distribution-react@0.107.1

## 0.110.0

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

- Updated dependencies [6c27159]
- Updated dependencies [eeb23df]
  - @voyantjs/bookings-react@0.110.0
  - @voyantjs/crm-react@0.110.0
  - @voyantjs/distribution-react@0.107.0
  - @voyantjs/markets-react@0.107.0
  - @voyantjs/products-react@0.110.0
  - @voyantjs/suppliers-react@0.107.0
  - @voyantjs/admin@0.107.0
  - @voyantjs/legal@0.110.0

## 0.109.0

### Patch Changes

- @voyantjs/legal@0.109.0

## 0.108.0

### Patch Changes

- @voyantjs/legal@0.108.0

## 0.107.1

### Patch Changes

- @voyantjs/legal@0.107.1

## 0.107.0

### Patch Changes

- @voyantjs/legal@0.107.0

## 0.106.3

### Patch Changes

- Updated dependencies [801b3e8]
  - @voyantjs/legal@0.106.3

## 0.106.2

### Patch Changes

- Updated dependencies [b743087]
  - @voyantjs/legal@0.106.2

## 0.106.1

### Patch Changes

- Updated dependencies [8f2a93c]
  - @voyantjs/legal@0.106.1

## 0.106.0

### Patch Changes

- @voyantjs/legal@0.106.0

## 0.105.0

### Patch Changes

- @voyantjs/legal@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/legal@0.104.1
- @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/legal@0.104.0
- @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/legal@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/legal@0.102.0
- @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
  - @voyantjs/legal@0.101.2
  - @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/legal@0.101.1
- @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/legal@0.101.0
- @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/legal@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/legal@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/legal@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/legal@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/legal@0.96.0
- @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/legal@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/legal@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/legal@0.93.0
- @voyantjs/react@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/legal@0.92.0
- @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/legal@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/legal@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/legal@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/legal@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/legal@0.87.1
- @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/legal@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/legal@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/legal@0.85.4
- @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/legal@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/legal@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/legal@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/legal@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/legal@0.84.4
- @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/legal@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/legal@0.84.2
- @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/legal@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/legal@0.84.0
  - @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/legal@0.83.1
- @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/legal@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/legal@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Patch Changes

- Updated dependencies [577f909]
  - @voyantjs/legal@0.82.0
  - @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/legal@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/legal@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/legal@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- Updated dependencies [93874e4]
  - @voyantjs/legal@0.81.18
  - @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/legal@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/legal@0.81.16
  - @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/legal@0.81.15
- @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/legal@0.81.14
- @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [36421aa]
  - @voyantjs/legal@0.81.13
  - @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/legal@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/legal@0.81.11
- @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/legal@0.81.10
- @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyantjs/legal@0.81.9
  - @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/legal@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/legal@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/legal@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/legal@0.81.5
- @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/legal@0.81.4
- @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/legal@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/legal@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/legal@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/legal@0.81.0
- @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/legal@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/legal@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/legal@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/legal@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/legal@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/legal@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/legal@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/legal@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- Updated dependencies [97cae5e]
  - @voyantjs/legal@0.80.10
  - @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/legal@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/legal@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/legal@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/legal@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/legal@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/legal@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- Updated dependencies [6d816bb]
  - @voyantjs/legal@0.80.3
  - @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/legal@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- Updated dependencies [9a71c89]
  - @voyantjs/legal@0.80.1
  - @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/legal@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/legal@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/legal@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/legal@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/legal@0.77.12
- @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/legal@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/legal@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/legal@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/legal@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/legal@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/legal@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/legal@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/legal@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/legal@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/legal@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/legal@0.77.1
- @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- Updated dependencies [1da934d]
  - @voyantjs/legal@0.77.0
  - @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/legal@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/legal@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/legal@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/legal@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/legal@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- Updated dependencies [38167cd]
  - @voyantjs/legal@0.75.3
  - @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/legal@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/legal@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/legal@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/legal@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/legal@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/legal@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/legal@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Minor Changes

- 856da86: Add a package-level booking contract generation endpoint and wire the booking contract card to generate from the default template and active number series.

### Patch Changes

- Updated dependencies [856da86]
  - @voyantjs/legal@0.73.0
  - @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/legal@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/legal@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/legal@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/legal@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/legal@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/legal@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/legal@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/legal@0.66.6
- @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/legal@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/legal@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/legal@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/legal@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/legal@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/legal@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/legal@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/legal@0.64.1
- @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/legal@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/legal@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/legal@0.63.0
- @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/legal@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/legal@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/legal@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/legal@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/legal@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/legal@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/legal@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/legal@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/legal@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/legal@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- @voyantjs/legal@0.55.1
- @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/legal@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/legal@0.54.0
- @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/legal@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/legal@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/legal@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/legal@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/legal@0.52.3
- @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Contracts/templates UI refresh.

  - `ContractDetailPage`, `ContractsPage`, `PoliciesPage`, and `TemplatesPage` rebuilt around the shared table primitives with sort/filter/empty-state parity. Detail page now surfaces lifecycle actions inline rather than in a side panel.
  - New `ContractSendDialog` for kicking off the contract-send flow with recipient/CC selection and i18n strings (EN + RO).
  - `useContractMutation` invalidates the contract list + detail queries after lifecycle transitions so list rows reflect the new state immediately.
  - `@voyantjs/legal` lifecycle/routes/service updated to expose the data the new dialog needs (recipient hydration, send payload) and to surface lifecycle validation errors with structured codes.

- Updated dependencies [3e09123]
  - @voyantjs/legal@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/legal@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/legal@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/legal@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/legal@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/legal@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/legal@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- @voyantjs/legal@0.50.6
- @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/legal@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/legal@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/legal@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/legal@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/legal@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- 140d0ad: Add an opinionated contract lifecycle with stage history, transition validation, and domain events for issue/send/sign/execute/void transitions.
- Updated dependencies [140d0ad]
  - @voyantjs/legal@0.50.0
  - @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/legal@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/legal@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyantjs/legal@0.47.0
  - @voyantjs/react@0.47.0

## 0.46.0

### Minor Changes

- 72b99b2: Add explicit default storefront contract templates with optional channel scoping and selector fallback support.

### Patch Changes

- Updated dependencies [72b99b2]
  - @voyantjs/legal@0.46.0
  - @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/legal@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/legal@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/legal@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/legal@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/legal@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/legal@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/legal@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/legal@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/legal@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/legal@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/legal@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/legal@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/legal@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/legal@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/legal@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/legal@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/legal@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/legal@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Minor Changes

- 24b6624: Add person-aware contract list search, hydrate contract person details, and expose a ContractsPage person filter.

### Patch Changes

- 6e4a90f: Polish the contract detail page with a clearer header, tabbed document and signature sections, and a file-first attachment dialog.
- Updated dependencies [6e4a90f]
- Updated dependencies [24b6624]
- Updated dependencies [a37d4af]
  - @voyantjs/legal@0.34.0
  - @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/legal@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/legal@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/legal@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/legal@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/legal@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/legal@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/legal@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/legal@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/legal@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/legal@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/legal@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/legal@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/legal@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/legal@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/legal@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/legal@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/legal@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/legal@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/legal@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [3af39d1]
  - @voyantjs/legal@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/legal@0.28.3
- @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/legal@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/legal@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/legal@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/legal@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/legal@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/legal@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/legal@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/legal@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/legal@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/legal@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/legal@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/legal@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/legal@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/legal@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/legal@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/legal@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/legal@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/legal@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/legal@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/legal@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/legal@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/legal@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/legal@0.21.0
  - @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/legal@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/legal@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/legal@0.18.0
  - @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/legal@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/legal@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/legal@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/legal@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/legal@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/legal@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/legal@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
  - @voyantjs/legal@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/legal@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Minor Changes

- 24dc253: End-to-end contract generation workflow for the operator template. Four-PR batch riding together on the fixed train:

  **Template renderer filters (#270)** — Three new Liquid filters registered on `@voyantjs/utils`' shared template engine: `currency`, `cents` (integer cents → currency string), `format_date` with short/medium/long/iso presets. Picked up automatically by `renderStructuredTemplate` consumers (`@voyantjs/legal`, `@voyantjs/notifications`).

  **Auto-generate on booking.confirmed (#271)** — `createLegalHonoModule` now accepts `autoGenerateContractOnConfirmed`: an opt-in subscriber that, on every `booking.confirmed` event, creates a contract against the configured template slug, renders its Liquid body with booking + traveler variables, and delegates to the configured PDF generator. Discriminated outcome (`template_not_found` / `template_version_missing` / `booking_not_found` / `contract_create_failed` / `document_failed` / `ok`) surfaces misconfigs at bootstrap. New `findTemplateBySlug` + `findSeriesByName` helpers on the template/series services. `@voyantjs/legal` now depends on `@voyantjs/bookings` (no cycle).

  **Booking contract card hook plumbing (#272)** — `@voyantjs/legal-react` gains `generateDocument` + `regenerateDocument` mutations on `useLegalContractMutation`, `LegalContractsListFilters` now carries `bookingId` / `personId` / `organizationId` (already server-side-supported), new `legalContractGenerateDocumentResponse` schema. Paired registry component `voyant-legal-booking-contract-card` lists contracts for a booking with download + regenerate actions.

  **Operator wiring (#273)** — Operator template now resolves a PDF document generator from the `DOCUMENTS_BUCKET` R2 binding, enables `autoGenerateContractOnConfirmed` against slug `customer-sales-agreement`, and its seed script now writes a proper Liquid-templated contract body + a `contract_template_versions` row so the auto-generate flow resolves end-to-end from first confirm.

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/legal@0.8.0
  - @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/legal@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/legal@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/legal@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/legal@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/legal@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/legal@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/legal@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/legal@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/legal@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/legal@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/legal@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers`, `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

### Patch Changes

- @voyantjs/legal@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/legal@0.4.5
  - @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/legal@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/legal@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/legal@0.4.2
  - @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/legal@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/legal@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
  - @voyantjs/legal@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/legal@0.3.0
  - @voyantjs/react@0.3.0
