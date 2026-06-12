# @voyantjs/core

## 0.109.0

### Minor Changes

- b7056f1: Transactional-outbox support in the event bus (RFC #1687 Phase 2.1). `EmitOptions` gains `store` (an `OutboxEventStore`): when present, the envelope is persisted BEFORE any handler runs and the row is completed/failed after all handlers settle — a crash mid-delivery leaves a pending row for redelivery instead of a lost event. Duplicate `metadata.eventId`s skip delivery (idempotent capture). New `EventBus.deliver(envelope)` runs all subscribers with per-handler failure reporting (used by outbox drains for redelivery; optional on the interface). `emit` now always stamps `metadata.eventId` (`generateEventId()`, exported) when the caller didn't supply one — additive, and the workflow forwarder's idempotency derivation keys on it.

## 0.108.0

### Minor Changes

- 7255353: `queryGraph` resolves each relation with ONE batched link lookup instead of one `LinkService.list` call per base record — listing 50 products with `category.*` previously fired 50 link-table queries (each a subrequest + roundtrip on Workers + neon-http); it now fires 1. Attach semantics are unchanged: list sides still attach as arrays, non-list sides as object-or-null, target IDs are deduped before hydration, and per-base target order is preserved (rows arrive in the link service's `created_at ASC` order and are grouped locally). To support this, the `LinkService` interface's `list` filter is now the new exported `LinkListFilter` type, which adds optional `leftIds`/`rightIds` arrays (matched as one batched query) next to the existing singular fields — existing implementations remain assignable, but custom `LinkService` implementations and test mocks must handle the plural fields to be queried by `queryGraph`.

### Patch Changes

- 7255353: `Extension` gains an optional `requiresTransactionalDb` flag. Extensions mount under their target module's path prefix, so a transacting extension (e.g. catalog-authoring's compose/duplicate routes under `/v1/admin/products`) must be able to force the transaction-capable db client onto that surface when an app splits db factories per surface.

## 0.107.0

### Minor Changes

- 418fa82: EventBus: handlers now run **in parallel** (behavior change — previously sequential in subscription order; subscribers are independent observers by contract, so one slow handler no longer serializes the rest) and each handler is bounded by a per-handler timeout (`createEventBus({ handlerTimeoutMs })`, default 15s, `false` to disable — on timeout the handler is logged and no longer awaited, not cancelled). New `SubscribeOptions` (`subscribe(event, handler, { inline: true })`) and `EmitOptions` (`emit(event, data, metadata, { schedule })`): when an emitter supplies `schedule`, non-`inline` handlers are handed to it as one promise and `emit()` resolves after the `inline` handlers only — this is how `@voyantjs/hono` defers subscriber work past the HTTP response. Plugin `Subscriber` gains the matching optional `inline` flag, threaded through `registerPlugins`. Existing call sites are source-compatible (new parameters are optional).

## 0.106.0

### Minor Changes

- eeb23df: Packaged-admin RFC §4.8 (route assembly, increment 1) — framework half of
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

## 0.105.1

### Patch Changes

- 344e7b6: Packaged-admin RFC §5 deletions: the fork-and-own distribution surfaces are
  retired now that all 10 admin domains ship as versioned packages. `@voyantjs/ui`
  drops its shadcn registry source (`registry/`, `registry.json`, generated
  `public/r/`) and the `registry:build` script — the package's published
  component/export surface is unchanged and remains the only way to consume it.
  `templates/dmc`, `apps/dev`, and the hosted registry worker (`apps/registry`)
  are deleted from the workspace. `@voyantjs/core` and `@voyantjs/products-ui`
  only see stale comment/doc references repointed from the deleted surfaces to
  `templates/operator`.

## 0.105.0

### Minor Changes

- c2aef18: Manifest-driven migration schema resolution (#1608).

  - `@voyantjs/core` `VoyantConfig` gains `additionalSchemas`, `extensions`, and `schemas` fields (with validation) so a template's migrated schema set is derived from `voyant.config.ts`.
  - `catalog`, `flights`, `travel-composer`, and `workflow-runs` declare `package.json#voyant` schema metadata so they resolve into the generated schema manifest (flights pins its non-standard `./reference/local-postgres` subpath).

## 0.104.1

## 0.104.0

## 0.103.0

## 0.102.0

## 0.101.2

## 0.101.1

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

## 0.96.0

## 0.95.0

## 0.94.0

## 0.93.0

## 0.92.0

## 0.91.0

## 0.90.0

## 0.89.0

## 0.88.0

## 0.87.1

## 0.87.0

## 0.86.0

## 0.85.4

## 0.85.3

## 0.85.2

## 0.85.1

## 0.85.0

## 0.84.4

## 0.84.3

## 0.84.2

## 0.84.1

## 0.84.0

## 0.83.1

## 0.83.0

## 0.82.1

## 0.82.0

## 0.81.21

## 0.81.20

## 0.81.19

## 0.81.18

## 0.81.17

## 0.81.16

## 0.81.15

## 0.81.14

## 0.81.13

## 0.81.12

## 0.81.11

## 0.81.10

## 0.81.9

## 0.81.8

## 0.81.7

## 0.81.6

## 0.81.5

## 0.81.4

## 0.81.3

## 0.81.2

## 0.81.1

## 0.81.0

## 0.80.18

## 0.80.17

## 0.80.16

## 0.80.15

## 0.80.14

## 0.80.13

## 0.80.12

## 0.80.11

## 0.80.10

## 0.80.9

## 0.80.8

## 0.80.7

## 0.80.6

## 0.80.5

## 0.80.4

## 0.80.3

## 0.80.2

## 0.80.1

## 0.80.0

## 0.79.0

## 0.78.0

## 0.77.13

## 0.77.12

## 0.77.11

## 0.77.10

## 0.77.9

## 0.77.8

## 0.77.7

## 0.77.6

## 0.77.5

## 0.77.4

## 0.77.3

## 0.77.2

## 0.77.1

## 0.77.0

## 0.76.0

## 0.75.7

## 0.75.6

## 0.75.5

## 0.75.4

## 0.75.3

## 0.75.2

## 0.75.1

## 0.75.0

## 0.74.2

## 0.74.1

## 0.74.0

## 0.73.1

## 0.73.0

## 0.72.0

## 0.71.0

## 0.70.0

## 0.69.1

## 0.69.0

## 0.68.0

## 0.67.0

## 0.66.6

## 0.66.5

## 0.66.4

## 0.66.3

## 0.66.2

## 0.66.1

## 0.66.0

## 0.65.0

## 0.64.1

## 0.64.0

### Minor Changes

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.

## 0.63.1

## 0.63.0

## 0.62.3

## 0.62.2

## 0.62.1

## 0.62.0

### Patch Changes

- 77aad68: Add a transaction-capable Neon serverless database adapter and make action-ledger skip Neon HTTP transactions safely.

## 0.61.0

## 0.60.0

## 0.59.0

## 0.58.0

## 0.57.0

## 0.56.0

## 0.55.1

## 0.55.0

## 0.54.0

## 0.53.2

## 0.53.1

## 0.53.0

## 0.52.4

## 0.52.3

## 0.52.2

## 0.52.1

## 0.52.0

## 0.51.1

## 0.51.0

## 0.50.8

## 0.50.7

## 0.50.6

## 0.50.5

## 0.50.4

## 0.50.3

## 0.50.2

## 0.50.1

## 0.50.0

## 0.49.0

## 0.48.0

## 0.47.0

## 0.46.0

## 0.45.0

## 0.44.0

## 0.43.0

### Minor Changes

- d07215e: Add first-class API token rotation and audit-facing token context. The auth facade now supports `POST /auth/api-tokens/:keyId/rotate`, the React hooks and UI expose rotation, and Hono request context includes `apiTokenId` for downstream audit log writers.

## 0.42.0

## 0.41.3

## 0.41.2

## 0.41.1

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.0

## 0.38.2

## 0.38.1

## 0.38.0

## 0.37.1

## 0.37.0

## 0.36.0

## 0.35.0

## 0.34.0

## 0.33.1

## 0.33.0

## 0.32.3

## 0.32.2

## 0.32.1

## 0.32.0

## 0.31.4

## 0.31.3

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.7

## 0.30.6

## 0.30.5

## 0.30.4

## 0.30.3

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.0

## 0.28.3

## 0.28.2

## 0.28.1

## 0.28.0

## 0.27.0

## 0.26.9

## 0.26.8

## 0.26.7

## 0.26.6

## 0.26.5

## 0.26.4

## 0.26.3

## 0.26.2

## 0.26.1

## 0.26.0

## 0.25.0

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

### Patch Changes

- 66d722d: Align dependency versions and peer ranges across the workspace to reduce duplicated transitive installs and make consumer `pnpm install` reproducible.

## 0.16.0

## 0.15.0

## 0.14.0

## 0.13.0

## 0.12.0

## 0.11.0

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.0

## 0.6.9

## 0.6.8

## 0.6.7

## 0.6.6

## 0.6.5

## 0.6.4

## 0.6.3

### Patch Changes

- d3c6937: Add a narrow execution lock surface and use it to serialize worker-driven notification reminder sweeps across processes.

## 0.6.2

## 0.6.1

## 0.6.0

## 0.5.0

## 0.4.5

### Patch Changes

- e3f6e72: Standardize TypeID prefixes to a first-N-chars convention for better DX.

  Root entities now use the shortest unambiguous first-N chars of the entity name
  (e.g. `pers` instead of `prsn`, `org` instead of `orgn`). Child entities use a
  2-char module code plus 2-char suffix. 19 prefixes renamed in total.

## 0.4.4

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

## 0.3.1

## 0.3.0

## 0.2.0

## 0.1.1
