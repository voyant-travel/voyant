# @voyantjs/admin-app

## 0.1.0

### Minor Changes

- 4ade734: Semantic admin navigation destinations (packaged-admin RFC §4.7): packaged
  admin pages navigate to routes they don't own (booking journey, supplier
  detail, product editor) without importing a host route tree.

  - `@voyantjs/admin`: new `AdminDestinations` interface (augmented by domain
    packages via `declare module "@voyantjs/admin"`), `AdminNavigationProvider`,
    and `useAdminHref`/`useAdminNavigate`. Unresolvable keys warn once per key
    and degrade to `"#"`/no-op — never a throw in render paths.
  - `@voyantjs/admin-app`: `AdminWorkspaceShell` accepts a `destinations`
    resolver map (`satisfies AdminDestinationResolvers` for exhaustiveness) and
    mounts the provider wired to the app router via `router.navigate({ href })`.
  - `@voyantjs/catalog-ui`: declares the catalog destination keys
    (`bookingJourney.start`, `catalog.browse`, `catalog.detail`,
    `product.detail`, `supplier.detail`) covering every cross-route target the
    operator's catalog wrappers navigate to.

- db98e90: New package — Phase 1 of the packaged-admin RFC (#1643): the admin
  application composition ships as a versioned package; `@voyantjs/admin` stays
  the primitives layer.

  - `createAdminRouter` / `createAdminQueryClient` — TanStack Router +
    QueryClient with the Voyant defaults (intent preloading with matched
    staleTime, scroll restoration, default not-found page, QueryClient SSR
    dehydrate/hydrate).
  - `adminRootHead` / `AdminRootShell` / `AdminRootErrorBoundary` — root route
    internals, including the pre-hydration theme/locale bootstrap script and a
    provider-independent error boundary.
  - `createAdminWorkspaceBeforeLoad` — the workspace auth guard (beforeLoad so
    the redirect short-circuits child loaders).
  - `AdminWorkspaceShell` — bootstrap gate → per-user message overrides →
    locale sync → workspace layout, with the Slot-compatible `AdminRouterLink`
    as the default nav link.

  The operator template consumes it: `router.tsx` (89→15 LOC), `__root.tsx`
  (118→29), and `_workspace/route.tsx` (209→95) shrink to wiring; app-owned
  parts (provider list, extension definitions, nav icons, auth client) stay in
  the template.

### Patch Changes

- Updated dependencies [4ade734]
- Updated dependencies [3bd66e9]
- Updated dependencies [ee5b530]
- Updated dependencies [344e7b6]
  - @voyantjs/admin@0.106.0
  - @voyantjs/ui@0.106.0
