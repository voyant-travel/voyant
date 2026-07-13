# @voyant-travel/admin-host

## 0.3.0

### Minor Changes

- c65b05c: Own authenticated workspace composition behind injected auth, realtime, API, and presentation ports.
- c65b05c: Generate standard Operator route registrations under `.voyant`, move public
  Finance and Quotes route behavior into package-owned contributions, and move
  standard route composition into the product distribution so application source
  contains only deployment adapters and local customization.
- c65b05c: Move the standard Operator frontend runtime, route adapters, API documentation,
  provider stack, and stylesheet bootstrap from the generic admin host into the
  standard product distribution.
- 490d132: Package reusable admin host destinations, dashboard and extension composition,
  current-user bindings, and realtime invalidation presentation.
- 490d132: Remove the final snapshot-era managed-profile aliases from the admin and migration package surfaces. Admin hosts now consume `AdminAuthRuntime`, `getAdminApiUrl`, and `adminFetcher`; deployment migration collection is exposed as `collectDeploymentMigrationSources`.
- 490d132: Remove the framework's snapshot-era profile, managed runtime, managed jobs, profile-to-graph conversion, and dynamic profile composition exports. Graph projects and the generic Node runtime are now the only framework deployment authority; generic deployment mode and provider validation remain supported.
- 282892e: Make `@voyant-travel/runtime` the single public Node project host, move low-level
  host primitives to `@voyant-travel/runtime-core`, and remove the package-owned
  runtime CLI. Rename remaining first-party operator-specific subpaths to generic
  runtime or runtime-support surfaces.

### Patch Changes

- 490d132: Move built-in admin route message providers into route-owned contribution metadata and remove first-party package fallback knowledge from the generic admin host.
- 490d132: Move Operator Settings and Relationships admin presentation authority into selected package graph factories.
- 490d132: Build admin destinations from the graph-selected and project-local extension registry instead of committed generated source files.
- 490d132: Compose selected-graph and project-local admin extensions through the generic admin host, and declare Realtime's admin integration directly in its package manifest.
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [282892e]
  - @voyant-travel/admin@0.122.0
  - @voyant-travel/admin-app@0.45.0
  - @voyant-travel/admin-react@0.122.0
  - @voyant-travel/types@0.108.1
  - @voyant-travel/runtime-core@0.6.0

## 0.2.1

### Patch Changes

- Updated dependencies [e232b21]
  - @voyant-travel/runtime-core@0.5.0

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
