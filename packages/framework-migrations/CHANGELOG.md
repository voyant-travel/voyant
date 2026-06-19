# @voyant-travel/framework-migrations

## 0.3.0

### Minor Changes

- a74471e: Add the new `quotes` columns + `quote_media` table to the standard migration bundle: `quotes.pax_count`, `quotes.created_by` / `quotes.updated_by`, `quotes.description`, and the `quote_media` table (quote images/attachments shown on the proposal).

## 0.2.0

### Minor Changes

- 76b18b5: Add `importBaseline(client, sources, options?)` — records a planned set of migrations in the `_voyant_migrations` ledger **without executing their SQL**, for cutting an existing deployment (whose schema is already materialised) onto the collector. Idempotent (`ON CONFLICT DO NOTHING`); the caller must verify schema parity first. The shared ledger DDL is factored into one `ensureLedger` helper used by both `applyMigrations` and `importBaseline`.

  This is the collector primitive behind the D.1 runner cutover (slice 4): `migrate.ts` now auto-detects FRESH (execute) / BASELINE (import) / INCREMENTAL (apply-new), with baseline gated by a parity guard. See `docs/architecture/migration-collector-d1.md`.

- 3fbff52: Ship the D.1 standard-profile aggregate migration bundle (Workstream D.1, slice 2). `@voyant-travel/framework-migrations` now includes the generated `migrations/` bundle (`0000_framework_baseline`) — the standard-profile aggregate schema (the operator reference profile's package-owned schemas, minus the deployment-local cross-module link tables) — and exports `loadFrameworkBundleSource()` / `frameworkBundleDir()` to load it as the `framework` collector source (priority 0).

  The bundle is incremental: `0000` is frozen; a standard-schema change appends `0001…` (never rewrites `0000`, which would trip the collector's content-hash immutability guard). `scripts/generate-framework-migration-bundle.mjs` generates it (from the operator reference config) and gates drift via `verify:framework-migration-bundle` (added to `verify:architecture`) — a clean re-generate must be a no-op. This slice ships + verifies the bundle; it is not yet wired into a live runner (slice 4).

- 8a8737f: New package `@voyant-travel/framework-migrations` — the D.1 multi-source migration collector (Workstream D, foundation slice). Productionizes the validated `spikes/d1-migration-collector` approach:

  - `planMigrations` / `applyMigrations` — apply migrations across ordered sources (framework bundle first, then the deployment's own) via one **version-independent** ledger keyed by `(source, tag, content_hash)`. Idempotent re-runs, framework-first ordering, per-migration transactions, drizzle `--> statement-breakpoint` splitting, and **content-hash immutability** (`MigrationImmutabilityError` if a shipped migration changed after it was applied).
  - `loadMigrationFolder` — read a drizzle `migrations/` folder (`meta/_journal.json` + `*.sql`) into ordered statements.

  Transport-agnostic (takes an injected pg-compatible client; no `pg` dependency in the library). Integration tests reproduce the spike's 5 scenarios against Postgres (skipped when `TEST_DATABASE_URL` is unset). This slice does **not** change any live migration runner — see `docs/architecture/migration-collector-d1.md` for the ADR and the remaining slices (bundle generation, replay oracle, runner cutover).

### Patch Changes

- 04681f3: Adopt custom fields on `booking` — the first entity consumer of the `@voyant-travel/core/custom-fields` registry.

  - A `custom_fields jsonb default '{}'` column on `bookings` (framework bundle migration `0001`).
  - Booking create/update routes validate the `customFields` payload at the boundary against the deployment's injected registry (`validateBookingCustomFields`): unknown keys, missing required, and wrong types are rejected 400; only registry-approved values are persisted. Writes that carry `customFields` when the deployment declares none are rejected.
  - The registry is injected through `BookingRouteRuntimeOptions.customFields` → `createBookingsHonoModule` → a new optional `FrameworkProviders.customFields` provider, which a deployment supplies (the operator wires its discovered `operatorCustomFields`).

  Read paths return `custom_fields` as part of the booking row. Oracle-verified (`bundle + links == live schema`). Per-entity adoption continues with `person`/`product`; export/invoice/search consumption of `customFieldsVisibleIn` is a follow-up. See `docs/architecture/custom-fields.md`.

- 9c3fe53: Custom-fields unification (phase 2 — person/organization adopt the `custom_fields` column). Both `people` and `organizations` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0002`), and their create/update routes validate `customFields` at the write boundary against the resolved registry (code ∪ runtime `custom_field_definitions`):

  - `relationships`: `RelationshipsRouteRuntime(+Options).customFields` resolver; a `validateRelationshipsCustomFields(c, entity, data)` helper on the accounts route (its `Env` now exposes `container`); person/org writes persist the cleaned value.
  - `relationships-contracts`: `customFields` added to the person/organization core schemas.
  - `framework`: the relationships factory moves Tier 1 → 2 to receive `capabilities.customFields`.

  Values now live on the entity row for `booking`, `person`, and `organization`. Still ahead: repoint the EAV value API to the column + backfill `custom_field_values` → jsonb, then retire the side table. Oracle-verified (bundle + links == live schema).

- d29dd47: Custom-fields unification (phase 3a — `custom_fields` column on quote + activity). `activities` (relationships) and `quotes` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0003`), completing entity coverage for all four EAV entity types (person, organization, quote, activity) ahead of repointing the value API to the column. Additive — no behavior change yet. Oracle-verified.
- ce2a568: Custom-fields unification (phase 4a — retire `custom_field_values`). The EAV value side table is removed; values live solely on each entity's `custom_fields` jsonb column.

  - The table + its types/relations are dropped from the schema; the person/org merge flow now merges `custom_fields` (keeper wins) instead of value rows.
  - A **guarded** retirement migration (framework bundle `0004`) drops the table but **RAISES if it still has rows**, so a deployment that hasn't run the backfill fails the migration loudly instead of losing data. The backfill script gains `--clear` to copy values into the columns and then empty the table.

  **Upgrade order:** `tsx scripts/backfill-custom-fields.ts --clear` (copies + empties), then `voyant db migrate` (the guarded drop). Verified: guard refuses with rows, drops when empty; oracle balances.

- d9e5f8e: Correct the D.1 framework bundle so it applies cleanly to a blank database: include the `cruise_air_arrangement` enum (via the cruises barrel fix) and inject the `pg_trgm` + `unaccent` extension preamble that the standard schema's trigram/unaccent indexes need (drizzle-kit only auto-generates `postgis`). The bundle's `0000_framework_baseline` now applies end-to-end against Postgres.
- 1132d2a: Stop shipping drizzle-kit `meta/*_snapshot.json` files in the published package. The bundle loader (`loadFrameworkBundleSource` → `loadMigrationFolder`) only reads `meta/_journal.json` + the `*.sql` files at runtime; the per-migration snapshots are build-time drift-detection artifacts used only inside the repo. Narrowing `files` to `dist`, `migrations/*.sql`, and `migrations/meta/_journal.json` cuts the published package from ~9.8 MB unpacked (469 kB tarball) to ~0.53 MB (60 kB) with no runtime change.
