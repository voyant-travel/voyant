# @voyant-travel/admin-host

## 0.2.1

### Patch Changes

- Updated dependencies [e232b21]
  - @voyant-travel/runtime@0.5.0

## 0.2.0

### Minor Changes

- 5cfe27d: Add `@voyant-travel/admin-host` — a profile-agnostic package that packages the
  managed-profile admin **serving seam** (Phase 1 of the source-free admin host,
  voyant#3044).

  - `serveManagedProfileAdmin({ clientAssetsDir, app })` — a Hono app that serves
    built client assets, then falls through to the combined API + SSR app for
    every non-asset route (the Node static host admin deployments held inline).
  - `createManagedProfileAdminSsrHandler()` — the TanStack Start SSR handler wrap
    (`createStartHandler(withActiveRouteSsrManifest(defaultStreamHandler))`), so
    hosts don't reimplement it; it still relies on the consuming app's Start build
    to provide the router.

  Naming is profile-agnostic (`createManagedProfileAdmin*`, never "operator" in an
  identifier) so any managed profile reuses the same host. The operator starter
  adopts both seams; the router assembly and app-shell routes remain starter-owned
  until Phase 2.
