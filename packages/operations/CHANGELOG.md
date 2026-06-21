# @voyant-travel/operations

## 0.2.3

### Patch Changes

- @voyant-travel/catalog@0.128.0
- @voyant-travel/identity@0.130.0

## 0.2.2

### Patch Changes

- Updated dependencies [7779772]
  - @voyant-travel/catalog@0.127.0
  - @voyant-travel/identity@0.129.0

## 0.2.1

### Patch Changes

- @voyant-travel/catalog@0.126.0
- @voyant-travel/identity@0.128.0

## 0.2.0

### Minor Changes

- 435a5d1: Extract the availability domain into a new foundational `@voyant-travel/availability` package, and complete D.2 per-package migration onboarding for the last schema-owning packages.

  - **@voyant-travel/availability (new):** owns the `availability_*` schema (slots, rules, start times, holds, pickups, capacity) — previously buried in operations. Ships its own D.2 migration.
  - **operations:** its availability **services and routes stay**, now importing the schema from `@voyant-travel/availability` (the barrel re-exports it for runtime consumers); operations' migration no longer owns the availability tables. Fixes the module direction — bookings/operations/accommodations consume availability, rather than reaching into operations for an inventory primitive.
  - **bookings:** drops the hard cross-package FK from `booking_allocations.availability_slot_id` to `availability_slots` (it referenced a stale local duplicate); the column is now a plain indexed id per module decoupling. The refund workflow keeps a runtime-only reference to the availability table.
  - **framework-migrations:** bundle migration drops the removed FK constraint.

  All package sources verified column-for-column against the bundle and apply together cleanly on a fresh D.2 database (union).

### Patch Changes

- Updated dependencies [435a5d1]
  - @voyant-travel/availability@0.1.0
  - @voyant-travel/catalog@0.125.0
  - @voyant-travel/identity@0.127.0

## 0.1.7

### Patch Changes

- 4893352: D.2 slice 1 (batch 3) — operations now owns and ships its migration history (drizzle.migrations.config.ts, db:generate, generated migrations/ baseline in `files`). Its declared cross-package FK into @voyant-travel/identity (identityAddresses) resolves via the closure (identity applied first). Verified column-for-column against the framework bundle, and the full fresh-D.2 union still applies cleanly. See `docs/architecture/migration-collector-d2.md`.
- Updated dependencies [1841ce2]
  - @voyant-travel/db@0.108.4
  - @voyant-travel/identity@0.126.1
  - @voyant-travel/catalog@0.124.1

## 0.1.6

### Patch Changes

- @voyant-travel/catalog@0.124.0
- @voyant-travel/identity@0.126.0

## 0.1.5

### Patch Changes

- @voyant-travel/db@0.108.3
- @voyant-travel/catalog@0.123.0
- @voyant-travel/identity@0.125.0
- @voyant-travel/hono@0.112.2

## 0.1.4

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/catalog@0.122.0
- @voyant-travel/identity@0.124.0

## 0.1.3

### Patch Changes

- Updated dependencies [98f4a40]
- Updated dependencies [a3bd51c]
- Updated dependencies [3b27dcc]
- Updated dependencies [39d48fe]
- Updated dependencies [d222e9f]
  - @voyant-travel/core@0.110.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/catalog@0.121.0
  - @voyant-travel/db@0.108.2
  - @voyant-travel/identity@0.123.0

## 0.1.2

### Patch Changes

- @voyant-travel/catalog@0.120.0
- @voyant-travel/identity@0.122.0

## 0.1.1

### Patch Changes

- Updated dependencies [11095db]
- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
  - @voyant-travel/catalog@0.119.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/identity@0.121.0

## 0.1.0

### Minor Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.

### Patch Changes

- eb17d3d: Add owner-path schema manifest metadata for Commerce and Operations, expose the
  Distribution counterparty interface, and refresh operator schema/link generated
  artifacts for the v1 package restructure.
- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [c9ec9f8]
- Updated dependencies [6bff46f]
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/identity@0.120.0
