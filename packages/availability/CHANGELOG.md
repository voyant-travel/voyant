# @voyant-travel/availability

## 0.2.0

### Minor Changes

- e3dc5a9: Declare package-owned Node deployment facets for product events, subscribers, workflows, access resources, tools, actions, and retain-data lifecycle behavior.

### Patch Changes

- a370024: Publish import-cheap package-owned Voyant deployment manifests for infrastructure and trips graph units.
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
  - @voyant-travel/core@0.114.0
  - @voyant-travel/db@0.111.0

## 0.1.3

### Patch Changes

- 5e1d221: Publish `voyant.package.v1` compatibility metadata from first-party
  schema-owning packages so deployment graph package admission can validate their
  framework, target, and deployment-mode compatibility before runtime imports.
- Updated dependencies [5e1d221]
  - @voyant-travel/db@0.110.1

## 0.1.2

### Patch Changes

- Updated dependencies [425f92e]
  - @voyant-travel/db@0.110.0

## 0.1.1

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/db@0.109.0

## 0.1.0

### Minor Changes

- 435a5d1: Extract the availability domain into a new foundational `@voyant-travel/availability` package, and complete D.2 per-package migration onboarding for the last schema-owning packages.

  - **@voyant-travel/availability (new):** owns the `availability_*` schema (slots, rules, start times, holds, pickups, capacity) — previously buried in operations. Ships its own D.2 migration.
  - **operations:** its availability **services and routes stay**, now importing the schema from `@voyant-travel/availability` (the barrel re-exports it for runtime consumers); operations' migration no longer owns the availability tables. Fixes the module direction — bookings/operations/accommodations consume availability, rather than reaching into operations for an inventory primitive.
  - **bookings:** drops the hard cross-package FK from `booking_allocations.availability_slot_id` to `availability_slots` (it referenced a stale local duplicate); the column is now a plain indexed id per module decoupling. The refund workflow keeps a runtime-only reference to the availability table.
  - **framework-migrations:** bundle migration drops the removed FK constraint.

  All package sources verified column-for-column against the bundle and apply together cleanly on a fresh D.2 database (union).
