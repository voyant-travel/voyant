# @voyant-travel/operations

## 0.5.14

### Patch Changes

- @voyant-travel/catalog@0.140.0
- @voyant-travel/identity@0.142.0

## 0.5.13

### Patch Changes

- Updated dependencies [6711f4c]
  - @voyant-travel/catalog@0.139.0
  - @voyant-travel/identity@0.141.0

## 0.5.12

### Patch Changes

- @voyant-travel/catalog@0.138.0
- @voyant-travel/identity@0.140.0

## 0.5.11

### Patch Changes

- ecff8cf: Fix silently-unbookable availability slots and opaque bootstrap errors (#2833)

  - `createSlot` now seeds `remaining_pax = initial_pax` for a bounded slot when
    the caller omits `remainingPax`, so a slot created via
    `{ initialPax, unlimited: false }` no longer lands with `remaining_pax = NULL`
    and read as sold out from birth by the booking engine's capacity reservation.
  - `reserveBooking` tolerates an option-less slot (`option_id = NULL`): such a
    slot is not option-scoped, so an item carrying a derived option id no longer
    fails `slot_option_mismatch`. This unblocks storefront compat bootstrap, which
    derives and stamps an option id onto the booking item.
  - The storefront bootstrap error contract maps `slot_product_mismatch` and
    `slot_option_mismatch` to dedicated codes (`SLOT_PRODUCT_MISMATCH`,
    `SLOT_OPTION_MISMATCH`) instead of collapsing them into the generic
    `BOOTSTRAP_FAILED` fallback.

## 0.5.10

### Patch Changes

- Updated dependencies [c9a356f]
- Updated dependencies [689a289]
- Updated dependencies [6474f42]
- Updated dependencies [5786f63]
- Updated dependencies [22f0457]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/core@0.112.0
  - @voyant-travel/hono@0.121.0
  - @voyant-travel/catalog@0.137.0
  - @voyant-travel/identity@0.139.0
  - @voyant-travel/db@0.109.5

## 0.5.9

### Patch Changes

- f1090b7: Align resource assignment detail schemas around `assignedAt`, reject orphan or incoherent slot assignment lifecycle payloads, and surface assignment target validation in the admin UI.
- 42f662c: Reject inverted, duplicate, and overlapping resource closeout windows and surface matching admin form validation.
- fead555: Prevent operations resource PATCH payloads from applying create defaults to omitted fields.
- Updated dependencies [1cb9cba]
- Updated dependencies [131ff9b]
  - @voyant-travel/hono@0.120.0
  - @voyant-travel/catalog@0.136.3
  - @voyant-travel/identity@0.138.2

## 0.5.8

### Patch Changes

- Updated dependencies [86fbb05]
  - @voyant-travel/hono@0.119.0
  - @voyant-travel/catalog@0.136.2
  - @voyant-travel/identity@0.138.1

## 0.5.7

### Patch Changes

- dd03968: Validate operations resource local references and duplicate pool memberships with deterministic 404/409 API errors. Duplicate resource pool memberships are now deduplicated during migration before a unique index enforces the invariant.
- Updated dependencies [2d3b039]
  - @voyant-travel/catalog@0.136.1

## 0.5.6

### Patch Changes

- @voyant-travel/catalog@0.136.0
- @voyant-travel/identity@0.138.0

## 0.5.5

### Patch Changes

- ed5463f: Reject invalid availability API payloads for impossible slot timing, capacity
  overages, mismatched local dates, and malformed recurrence rules.

## 0.5.4

### Patch Changes

- fcb8b88: Add catalog-authoring validation for transfer pickup/dropoff rules, block static availability for dynamic products, and require scheduled products to have a future open departure before publishing.

## 0.5.3

### Patch Changes

- Updated dependencies [9a1197b]
  - @voyant-travel/hono@0.118.0
  - @voyant-travel/catalog@0.135.1
  - @voyant-travel/identity@0.137.1

## 0.5.2

### Patch Changes

- Updated dependencies [7c5ee80]
  - @voyant-travel/hono@0.117.0
  - @voyant-travel/catalog@0.135.0
  - @voyant-travel/identity@0.137.0

## 0.5.1

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/hono@0.116.2
  - @voyant-travel/identity@0.136.2

## 0.5.0

### Minor Changes

- 787c852: Space blocks + shared allotment-lifecycle primitive (Phase 2b).

  - New `@voyant-travel/allotments`: the canonical allotment lifecycle contract
    (status state machine, counter math, pickup-progress derivation, slot
    enumeration) — one contract reused by type-specific tables (RFC §9-Q2).
  - accommodations: room-block service refactored onto the shared primitive
    (behavior-preserving; enum values unchanged, no migration).
  - operations: `space_blocks` / `space_block_slots` / `space_block_pickups` —
    held function-space inventory over a date range, the 2nd allotment consumer;
    transactional pickup/reversal/cutoff service + admin routes + `spaceBlockLinkable`.
  - schema-kit: TypeID prefixes `spbl` / `spsl` / `sppu`.

### Patch Changes

- Updated dependencies [787c852]
- Updated dependencies [293e5e4]
  - @voyant-travel/allotments@0.2.0
  - @voyant-travel/hono@0.116.1
  - @voyant-travel/db@0.109.2
  - @voyant-travel/catalog@0.134.0
  - @voyant-travel/identity@0.136.0

## 0.4.0

### Minor Changes

- 924d201: Room-block allotment (Phase 1) + MICE program spine.

  - accommodations: `room_blocks` / `room_block_nights` / `room_block_pickups` with
    per-night counters, CHECK invariants, an append-only pickup ledger, and a
    transactional pickup/reversal/cutoff-release service; first
    `accommodationsHonoModule` (registered in the framework standard set) +
    `roomBlockLinkable`.
  - operations: `property` / `facility` linkable definitions.
  - mice (new): `mice_programs` umbrella + admin routes + `programLinkable`,
    mounted operator-local.
  - schema-kit: TypeID prefixes `hrbn` / `hrbp` / `prog`.

- f311826: Function spaces + capacity-by-layout (operations) and agenda sessions (mice) — Phase 2.

  - operations: `function_spaces` (venue sub-spaces, nestable via `parentSpaceId`
    for combinable rooms / exhibition booths) + `function_space_capacities`
    (per-layout headcount: theater / classroom / banquet / cabaret / boardroom /
    u_shape / reception / hollow_square); service + admin routes + `functionSpaceLinkable`.
  - mice: `mice_program_sessions` (timed, capacity-bound agenda items with
    session type + optional function-space link) + `mice_session_inclusions`
    (F&B / AV / materials / signage); service + admin routes + `sessionLinkable`.
  - schema-kit: TypeID prefixes `fnsp` / `fnsc` / `mpss` / `mssi`.

### Patch Changes

- @voyant-travel/db@0.109.1
- @voyant-travel/catalog@0.133.0
- @voyant-travel/identity@0.135.0

## 0.3.1

### Patch Changes

- Updated dependencies [684b321]
- Updated dependencies [2542715]
  - @voyant-travel/hono@0.116.0
  - @voyant-travel/catalog@0.132.1
  - @voyant-travel/identity@0.134.1

## 0.3.0

### Minor Changes

- 51f7dea: Share one list-response contract instead of per-module copies (voyant#2109).

  `@voyant-travel/types` now owns the canonical offset-paginated list envelope: the `ListResponse<T>` type + `listResponse(data, { total, limit, offset })` builder, plus the zod `paginationSchema` (coerced `limit` 1–200 default 50, `offset` ≥0 default 0) and the `listResponseSchema(item)` factory. Both server services and `*-react` clients import from this single source.

  Server side: every module's local `paginate()` / inline `{ data, total, limit, offset }` construction now routes through the shared `listResponse` builder, and the count read is standardized on `count` internally — fixing the drift where finance, notifications and the legal contracts/policies services read `countResult[0]?.total` while every other module read `countResult[0]?.count` (their `count(*)` selects were aliased `total`; they are now aliased `count`). The returned shape is byte-for-byte identical.

  Client side: the ~23 copied `paginatedEnvelope` zod schemas across the `*-react` packages are replaced by re-exporting the shared `listResponseSchema` factory under the same `paginatedEnvelope` name, so consumers are unchanged.

  Input alignment: `finance-contracts` and `legal-contracts` pagination `limit` caps were raised from `.max(100)` to `.max(200)` to match the framework-wide max.

  Additive and non-breaking.

### Patch Changes

- Updated dependencies [04b257c]
- Updated dependencies [78c15fa]
- Updated dependencies [51f7dea]
  - @voyant-travel/hono@0.115.0
  - @voyant-travel/types@0.106.0
  - @voyant-travel/identity@0.134.0
  - @voyant-travel/catalog@0.132.0

## 0.2.8

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/hono@0.114.0
  - @voyant-travel/db@0.109.0
  - @voyant-travel/catalog@0.131.0
  - @voyant-travel/identity@0.133.0
  - @voyant-travel/availability@0.1.1

## 0.2.7

### Patch Changes

- Updated dependencies [6a0edd2]
  - @voyant-travel/catalog@0.130.0
  - @voyant-travel/identity@0.132.0

## 0.2.6

### Patch Changes

- Updated dependencies [021ec00]
  - @voyant-travel/hono@0.113.0
  - @voyant-travel/core@0.111.0
  - @voyant-travel/catalog@0.129.1
  - @voyant-travel/identity@0.131.1
  - @voyant-travel/db@0.108.5

## 0.2.5

### Patch Changes

- ba89f0b: Let admin departure edits choose and persist a product option so existing departures with a missing option can be repaired from the UI. Explicit slot option links are now validated against the slot product while product-level generated slots can still omit an option.

## 0.2.4

### Patch Changes

- @voyant-travel/catalog@0.129.0
- @voyant-travel/identity@0.131.0

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
