---
"@voyantjs/admin": minor
"@voyantjs/admin-app": minor
"@voyantjs/availability-react": minor
"@voyantjs/bookings-react": minor
"@voyantjs/catalog-react": minor
"@voyantjs/crm-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/legal-react": minor
"@voyantjs/notifications-react": minor
"@voyantjs/promotions-react": minor
"@voyantjs/resources-react": minor
"@voyantjs/suppliers-react": minor
---

Packaged-admin RFC §4.8 endgame — the code-assembled extension route tree.
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
