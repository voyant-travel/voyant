# @voyant-travel/operator-settings

## 0.2.5

### Patch Changes

- 1841ce2: D.2 slice 1 (batch 2) — 14 more packages own + ship their migration history (db, relationships, quotes, identity, distribution, inventory, commerce, catalog, finance, notifications, legal, storefront, charters, cruises). Each baseline reproduces the framework bundle's tables column-for-column, and all package sources now apply together (fresh-D.2 union) without collision.

  Shared enums: the codebase inlines copies of some enums to avoid cross-package schema imports (e.g. `service_type` in distribution + inventory, `entity_type` in relationships + quotes). Per-package generation would emit duplicate `CREATE TYPE`, colliding on a fresh D.2 database. All package migrations now wrap `CREATE TYPE … AS ENUM(…)` in an idempotent `DO`-block guard (subset-safe; whichever source applies first creates the type, the rest no-op). The db package additionally owns the shared Postgres extensions (pg_trgm / unaccent) that downstream trigram indexes need on a fresh D.2 database (the retired bundle injected them; per-package sources did not). The batch-1 packages (operator-settings, action-ledger, workflow-runs, trips) get the same guard for uniformity. No runtime change. See `docs/architecture/migration-collector-d2.md`.

- Updated dependencies [1841ce2]
  - @voyant-travel/db@0.108.4
  - @voyant-travel/finance@0.126.1

## 0.2.4

### Patch Changes

- @voyant-travel/finance@0.126.0

## 0.2.3

### Patch Changes

- e89640b: D.2 slice 1 — these packages now own and ship their migration history. Each gains a `drizzle.migrations.config.ts`, a `db:generate` script, and a generated `migrations/` folder (baseline) included in the published tarball (`files`). A D.2 deployment collects each package's folder as its migration source; existing D.1 databases import-baseline the bundle-covered baseline. No runtime behavior change. See `docs/architecture/migration-collector-d2.md`.

## 0.2.2

### Patch Changes

- @voyant-travel/db@0.108.3
- @voyant-travel/finance@0.125.0
- @voyant-travel/hono@0.112.2

## 0.2.1

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/finance@0.124.0

## 0.2.0

### Minor Changes

- 6d75244: New package `@voyant-travel/operator-settings` — the operator-tenant settings domain (profile + payment instructions/defaults + booking-tax configuration). Owns the 5 tables (`./schema`, TypeID prefixes `opst/oppf/opin/opdp/btxs` unchanged) + the transport-agnostic readers/writers/validation (`./service`).

  This is Stage 1 of the Workstream B step-4 extraction (see `docs/architecture/operator-settings-extraction.md`): the schema + data access move from the operator starter into a standard package, wired via `voyant.config` `additionalSchemas` (folded into the deployment's single combined migration history — no new migration; tables are byte-identical and already in snapshot 0067). The deployment's runtime wiring imports the readers directly from the package; `src/api/routes/settings.ts` keeps only the HTTP layer. The package is `additionalSchemas`-only (not a mounted module), so it stays out of the runtime/BOM lockstep set.

- cc82783: Promote `@voyant-travel/operator-settings` to a standard mounted module (Workstream B step 4, Stage 2b — completes the extraction).

  - The package gains a HonoModule: `./hono-module` (`createOperatorSettingsHonoModule()`, lazyRoutes at the stable absolute paths `/v1/admin/settings/*`, `/v1/public/operator-profile`, `/v1/public/settings/operator`) + `./routes` (the handlers). New deps: `@voyant-travel/hono` + `hono`.
  - It moves from `voyant.config` `additionalSchemas` → `modules`, so it joins the runtime/BOM **lockstep set (16 → 17)** and is added to the framework BOM `dependencies`. `FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition` own its factory.
  - The deployment drops `operator/operator-settings` from `deploymentLocalModules` (now only `invitations` remains) and **deletes** `src/api/routes/settings.ts` — the settings routes are package-owned.

  Migration parity holds (schema byte-identical, already in snapshot 0067; `additionalSchemas`→`modules` only changes the schema's position in the drizzle list, not its DDL). Composed module/extension counts are unchanged (29 / 34 / 15) — the module just moved framework-owned. `check-public-cache-policy` updated to the package's new routes path.

### Patch Changes

- Updated dependencies [a3bd51c]
- Updated dependencies [e9d9dbb]
- Updated dependencies [d222e9f]
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/db@0.108.2
