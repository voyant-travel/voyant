# @voyant-travel/operator-settings

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
