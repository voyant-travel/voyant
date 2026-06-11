---
"@voyantjs/admin": minor
"@voyantjs/admin-app": minor
"@voyantjs/catalog-ui": minor
---

Semantic admin navigation destinations (packaged-admin RFC §4.7): packaged
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
