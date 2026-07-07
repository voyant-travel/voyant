# @voyant-travel/core

## 0.112.3

### Patch Changes

- 425f92e: Add Node-native cache and shared-state providers behind the existing KVStore
  surface, including in-process LRU, tiered Redis/Postgres providers, Postgres
  fixed-window rate limiting, Redis rate limiting, and managed-runtime provider
  selection without KV-shaped binding requirements.

## 0.112.2

### Patch Changes

- 621f989: Allow modules to register workflow and event-filter manifest metadata without importing run-bearing workflow definitions into request-serving apps.

## 0.112.1

### Patch Changes

- 3713e10: Expose a scheduler-scoped event bus to event handlers so inline subscribers can emit nested events without forcing deferrable downstream subscribers onto the caller path.

## 0.112.0

### Minor Changes

- c9a356f: Extend the api-key permission grammar for fine-grained agent operations and carry
  an audience on the key grant.

  - `@voyant-travel/types`: add `cancel`/`refund`/`void`/`publish`/`send` actions and
    `dashboard`/`content`/`media`/`bookings-pii` resources (with descriptor groups);
    PII resources are never satisfied by the `*` wildcard; add `assertKnownPermissions`
    and `API_KEY_GRANT_PRESETS` (a scope subset bundled with an audience).
  - `@voyant-travel/core`: add `audience` to `VoyantAuthContext`.
  - `@voyant-travel/hono`: derive an API key's audience from its grant metadata and let
    the request actor follow it (replacing the hardcoded staff default).
  - `@voyant-travel/auth`: validate permission strings and audience at key-mint time and
    resolve grant presets.

## 0.111.1

### Patch Changes

- 88edbe6: Keep durable event outbox rows tied to subscriber delivery when request schedulers fail after capture.

## 0.111.0

### Minor Changes

- 021ec00: Add vendor-neutral observability primitives (RFC voyant#1553).

  - **Request-id async context** — the `requestId` middleware now stores the correlation id on the `requestId` context variable and runs the request inside an `AsyncLocalStorage`, so any downstream code (services, subscribers, reporters) can read it via the new `getRequestId()` export — no header threading or `Context` access required. Error responses now also carry the `X-Request-Id` header. New exports: `getRequestId`, `runWithRequestId` (from the package root and `@voyant-travel/hono/observability`).
  - **Pluggable error `Reporter`** — `VoyantAppConfig` gains `reporter` and `appName`. Unhandled 5xx exceptions at the `fetch` catch point emit a normalized `{ requestId, app, error, context }` event to the configured `Reporter`, where `requestId` is the same id surfaced to the user. The default is a no-op (zero vendor coupling); a built-in `consoleReporter` is provided, and Sentry/OpenTelemetry backends can be wired as opt-in adapters implementing the exported `Reporter` interface. Capture is best-effort — it never throws and async reporters are flushed via `waitUntil`. New exports: `Reporter`, `ErrorEvent`, `noopReporter`, `consoleReporter`, `safeCaptureException`.
  - **Standard catch points beyond HTTP** — the reporter is now also wired into the non-request runtime catch points the RFC named, so background/async faults aren't an observability blind spot: app **bootstrap** (module/plugin/extension `bootstrap` failures), the **workflow forwarder** (EventBus→driver ingest), and **EventBus subscriber dispatch** errors. `@voyant-travel/core`'s `createEventBus` gains an optional `onSubscriberError(event, error)` hook (the bus stays vendor-neutral; the framework routes it to the reporter). Intentional fail-open paths (cache, metrics, rate-limit, workflow compensation) stay silent by design.

  The framework owns the id, the catch points, and the event shape; the backend stays a deployment choice. Deployments that don't set `reporter` keep the no-op default — the only behavioral change is the new runtime prerequisite below.

  **Runtime requirement (Cloudflare Workers):** the request-id async context uses `AsyncLocalStorage` (`node:async_hooks`), which requires the `nodejs_compat` (or `nodejs_als`) compatibility flag — now on the always-used request path, not just when a `reporter` is configured. This is already standard for Voyant Worker deployments (the operator starter and templates set `nodejs_compat`); Node deployments need nothing. Add `"compatibility_flags": ["nodejs_compat"]` to `wrangler.jsonc` if your Worker doesn't already have it.

## 0.110.0

### Minor Changes

- 98f4a40: Add `@voyant-travel/core/custom-fields` — a typed, validated, visibility-aware extension-field registry for core entities (the "custom fields without forking" seam). Dependency-free (no zod/drizzle):

  - `defineCustomField` / `createCustomFieldRegistry` — declare fields (`entity`, `key`, `type` of text/number/boolean/date/select, `required`, `options`, `validate`, `visibility`, `pii`).
  - `validateCustomFields(registry, entity, input)` — validate a write payload (rejects unknown keys, missing required, wrong type/option, custom rule); returns the cleaned value to persist.
  - `customFieldsVisibleIn(registry, entity, channel)` — fields to surface in `export` (default on) / `invoice` / `search` (default off), so those readers consult the registry instead of dumping or hiding everything.
  - `customFieldsFromGlob(glob)` — discover deployment-local field declarations from a Vite `import.meta.glob` of `src/custom-fields/*`.

  This is the registry primitive; per-entity column adoption (write-validation + export/invoice/search consumption on bookings/people/products) follows. See `docs/architecture/custom-fields.md`.

- 3b27dcc: Custom-fields unification (phase 1a — type model + merge). Grow `@voyant-travel/core/custom-fields` toward one system that absorbs the relationships EAV custom-fields feature (see `docs/architecture/custom-fields-unification-adr.md`):

  - `CustomFieldType` becomes the canonical superset — adds `multiselect` (a subset of `options`, stored `string[]`), `monetary` (`{ amountCents, currency }`, new `CustomFieldMonetaryValue` type), and `json` (arbitrary, also the home for `address`/`phone`). `validateCustomFields` validates each. Purely additive — existing `text`/`number`/`boolean`/`date`/`select` fields are unchanged.
  - `mergeCustomFieldDefinitions(sources, onShadow?)` — dedupes `(entity, key)` across sources, earlier source winning (code-declared before runtime/DB-defined), with a shadow callback. Feed its result to `createCustomFieldRegistry` to build one registry from both a code source and the runtime `custom_field_definitions` table.

  Storage migration (values → entity `custom_fields` jsonb, retiring `custom_field_values`) and the DB-backed registry loader land in the following phases.

- 39d48fe: Custom-fields unification (phase 1b — DB-backed definitions + per-request resolver). The custom-field registry is now resolved per request from two sources, so runtime-defined fields participate alongside code-declared ones (ADR: `docs/architecture/custom-fields-unification-adr.md`):

  - `core`: new `CustomFieldRegistryResolver = (db) => CustomFieldRegistry | Promise<…>` type.
  - `relationships`: `loadCustomFieldDefinitions(db)` reads the runtime `custom_field_definitions` table and maps it to registry definitions (`varchar`→`text`, `double`→`number`, `enum`→`select`, `set`→`multiselect`, `address`/`phone`→`json`; `isSearchable`→`visibility.search`).
  - `bookings`: the `customFields` route-runtime option is now a resolver; the write-validation helper resolves the registry from the request `db` (so it sees both code- and DB-defined fields). The operator wires a resolver that merges its code-declared fields with `loadCustomFieldDefinitions(db)` (code wins), cached per isolate.

  No storage change yet — values still go to the entity `custom_fields` jsonb (booking) / the EAV table (person/org). Subsequent phases add the person/org column, repoint the value API, and backfill `custom_field_values` → jsonb.

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

- 418fa82: EventBus: handlers now run **in parallel** (behavior change — previously sequential in subscription order; subscribers are independent observers by contract, so one slow handler no longer serializes the rest) and each handler is bounded by a per-handler timeout (`createEventBus({ handlerTimeoutMs })`, default 15s, `false` to disable — on timeout the handler is logged and no longer awaited, not cancelled). New `SubscribeOptions` (`subscribe(event, handler, { inline: true })`) and `EmitOptions` (`emit(event, data, metadata, { schedule })`): when an emitter supplies `schedule`, non-`inline` handlers are handed to it as one promise and `emit()` resolves after the `inline` handlers only — this is how `@voyant-travel/hono` defers subscriber work past the HTTP response. Plugin `Subscriber` gains the matching optional `inline` flag, threaded through `registerPlugins`. Existing call sites are source-compatible (new parameters are optional).

## 0.106.0

### Minor Changes

- eeb23df: Packaged-admin RFC §4.8 (route assembly, increment 1) — framework half of
  `voyant admin generate --routes`:

  - `@voyant-travel/admin` exports `requireAdminRoute(extension, routeId)` (plus the
    `BindableAdminRoute` type): looks up a route contribution by id and asserts
    it carries a component, so generated thin route files fail loudly at module
    evaluation when an extension stops shipping the route they bind.
    `AdminRouteRuntime.fetcher` is narrowed to the string-URL `VoyantFetcher`
    convention every `*-react` data client uses, so host fetchers (and the
    global `fetch`) bind directly into generated loaders.
  - `@voyant-travel/core` manifest grows `admin.routes` (`AdminRoutesConfig`): the
    host route-tree directory and the runtime-import bindings (`apiUrlModule`/
    `apiUrlExport`, `fetcherModule`/`fetcherExport`) the route generator emits,
    with operator-convention defaults. Validated by `validateVoyantConfig`.

  The operator's promotions index route is now generated output of the new
  command (byte-for-byte reproducible from `@voyant-travel/promotions-ui/admin`).

## 0.105.1

### Patch Changes

- 344e7b6: Packaged-admin RFC §5 deletions: the fork-and-own distribution surfaces are
  retired now that all 10 admin domains ship as versioned packages. `@voyant-travel/ui`
  drops its shadcn registry source (`registry/`, `registry.json`, generated
  `public/r/`) and the `registry:build` script — the package's published
  component/export surface is unchanged and remains the only way to consume it.
  `templates/dmc`, `apps/dev`, and the hosted registry worker (`apps/registry`)
  are deleted from the workspace. `@voyant-travel/core` and `@voyant-travel/products-ui`
  only see stale comment/doc references repointed from the deleted surfaces to
  `templates/operator`.

## 0.105.0

### Minor Changes

- c2aef18: Manifest-driven migration schema resolution (#1608).

  - `@voyant-travel/core` `VoyantConfig` gains `additionalSchemas`, `extensions`, and `schemas` fields (with validation) so a template's migrated schema set is derived from `voyant.config.ts`.
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

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyant-travel/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.

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
