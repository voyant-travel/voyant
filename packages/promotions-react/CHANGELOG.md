# @voyantjs/promotions-react

## 0.111.3

### Patch Changes

- @voyantjs/promotions@0.111.3

## 0.111.2

### Patch Changes

- @voyantjs/promotions@0.111.2

## 0.111.1

### Patch Changes

- @voyantjs/promotions@0.111.1

## 0.111.0

### Patch Changes

- Updated dependencies [41b08db]
  - @voyantjs/admin@0.111.0
  - @voyantjs/promotions@0.111.0

## 0.110.1

### Patch Changes

- @voyantjs/promotions@0.110.1

## 0.110.0

### Patch Changes

- Updated dependencies [9c909e2]
  - @voyantjs/admin@0.110.0
  - @voyantjs/promotions@0.110.0

## 0.109.0

### Patch Changes

- Updated dependencies [faec538]
  - @voyantjs/admin@0.109.0
  - @voyantjs/promotions@0.109.0

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
  - @voyantjs/promotions@0.108.0

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
  - @voyantjs/promotions@0.107.0

## 0.106.0

### Patch Changes

- @voyantjs/promotions@0.106.0

## 0.105.2

### Patch Changes

- @voyantjs/promotions@0.105.2

## 0.105.1

### Patch Changes

- @voyantjs/promotions@0.105.1

## 0.105.0

### Patch Changes

- @voyantjs/promotions@0.105.0

## 0.104.3

### Patch Changes

- @voyantjs/promotions@0.104.3

## 0.104.2

### Patch Changes

- @voyantjs/promotions@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/promotions@0.104.1
- @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/promotions@0.104.0
- @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/promotions@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/promotions@0.102.0
- @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/promotions@0.101.2
- @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/promotions@0.101.1
- @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/promotions@0.101.0
- @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/promotions@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/promotions@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/promotions@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/promotions@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/promotions@0.96.0
- @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/promotions@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/promotions@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/promotions@0.93.0
- @voyantjs/react@0.93.0

## 0.92.0

### Minor Changes

- 5de3d72: Extend promotion scopes with fare-code and cabin-grade targeting, and add structured eligibility flags for past-guest, solo-traveler, child-traveler, and family offers.

### Patch Changes

- Updated dependencies [5de3d72]
  - @voyantjs/promotions@0.92.0
  - @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/promotions@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/promotions@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/promotions@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/promotions@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/promotions@0.87.1
- @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/promotions@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/promotions@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/promotions@0.85.4
- @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/promotions@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/promotions@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/promotions@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/promotions@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/promotions@0.84.4
- @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/promotions@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/promotions@0.84.2
- @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/promotions@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- @voyantjs/promotions@0.84.0
- @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- Updated dependencies [9d2300d]
  - @voyantjs/promotions@0.83.1
  - @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/promotions@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/promotions@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/promotions@0.82.0
- @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/promotions@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/promotions@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/promotions@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/promotions@0.81.18
- @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/promotions@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- @voyantjs/promotions@0.81.16
- @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/promotions@0.81.15
- @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/promotions@0.81.14
- @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/promotions@0.81.13
- @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/promotions@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/promotions@0.81.11
- @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/promotions@0.81.10
- @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/promotions@0.81.9
- @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/promotions@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/promotions@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/promotions@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/promotions@0.81.5
- @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/promotions@0.81.4
- @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/promotions@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/promotions@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/promotions@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/promotions@0.81.0
- @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/promotions@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/promotions@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/promotions@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/promotions@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/promotions@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/promotions@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/promotions@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/promotions@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/promotions@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/promotions@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/promotions@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/promotions@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/promotions@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/promotions@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/promotions@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/promotions@0.80.3
- @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/promotions@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/promotions@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/promotions@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/promotions@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/promotions@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/promotions@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/promotions@0.77.12
- @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/promotions@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/promotions@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/promotions@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/promotions@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/promotions@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/promotions@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/promotions@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/promotions@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/promotions@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/promotions@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/promotions@0.77.1
- @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/promotions@0.77.0
- @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/promotions@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/promotions@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/promotions@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/promotions@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/promotions@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/promotions@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/promotions@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/promotions@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/promotions@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/promotions@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/promotions@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/promotions@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/promotions@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/promotions@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/promotions@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/promotions@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/promotions@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/promotions@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/promotions@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/promotions@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/promotions@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/promotions@0.66.6
- @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/promotions@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/promotions@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/promotions@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/promotions@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/promotions@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/promotions@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/promotions@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/promotions@0.64.1
- @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/promotions@0.64.0
- @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/promotions@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/promotions@0.63.0
- @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/promotions@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/promotions@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/promotions@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/promotions@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/promotions@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/promotions@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/promotions@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/promotions@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/promotions@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/promotions@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- @voyantjs/promotions@0.55.1
- @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/promotions@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/promotions@0.54.0
- @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/promotions@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/promotions@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/promotions@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/promotions@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/promotions@0.52.3
- @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- @voyantjs/promotions@0.52.2
- @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/promotions@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/promotions@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/promotions@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/promotions@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/promotions@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/promotions@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- @voyantjs/promotions@0.50.6
- @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/promotions@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/promotions@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/promotions@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/promotions@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/promotions@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/promotions@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/promotions@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/promotions@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/promotions@0.47.0
- @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/promotions@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/promotions@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/promotions@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [e9241a7]
  - @voyantjs/promotions@0.43.0
  - @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/promotions@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/promotions@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/promotions@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/promotions@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/promotions@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/promotions@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/promotions@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/promotions@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/promotions@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/promotions@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/promotions@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/promotions@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/promotions@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/promotions@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/promotions@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Minor Changes

- f3924a7: Add server-backed promotions list search, filters, pagination, and row-navigation hooks to the operator PromotionsPage.

### Patch Changes

- Updated dependencies [f3924a7]
  - @voyantjs/promotions@0.34.0
  - @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/promotions@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/promotions@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/promotions@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/promotions@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/promotions@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/promotions@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/promotions@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/promotions@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/promotions@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/promotions@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/promotions@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- Updated dependencies [d1a8835]
  - @voyantjs/promotions@0.30.7
  - @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/promotions@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/promotions@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/promotions@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/promotions@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/promotions@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/promotions@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Minor Changes

- 0969f52: Add package-owned React hooks and UI components for operator promotions.

### Patch Changes

- @voyantjs/promotions@0.30.0
- @voyantjs/react@0.30.0
