# @voyant-travel/availability

## 0.2.10

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.
- Updated dependencies [8d62a7c]
  - @voyant-travel/core@0.122.1
  - @voyant-travel/db@0.114.4

## 0.2.9

### Patch Changes

- Updated dependencies [cc85042]
- Updated dependencies [07a6ee3]
  - @voyant-travel/core@0.122.0
  - @voyant-travel/db@0.114.2

## 0.2.8

### Patch Changes

- Updated dependencies [3f6694b]
  - @voyant-travel/core@0.121.0
  - @voyant-travel/db@0.114.1

## 0.2.7

### Patch Changes

- Updated dependencies [4d0eeed]
- Updated dependencies [bef5b7c]
  - @voyant-travel/db@0.114.0
  - @voyant-travel/core@0.120.0

## 0.2.6

### Patch Changes

- 490d132: Make package and project declarations the sole selected access authority, removing legacy catalog overlays and runtime synthesis.
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
  - @voyant-travel/db@0.113.0
  - @voyant-travel/core@0.119.0

## 0.2.5

### Patch Changes

- Updated dependencies [8f4c242]
- Updated dependencies [d771be3]
- Updated dependencies [8f537b0]
- Updated dependencies [d26a820]
- Updated dependencies [d771be3]
- Updated dependencies [bd7a830]
  - @voyant-travel/core@0.118.0
  - @voyant-travel/db@0.112.2

## 0.2.4

### Patch Changes

- Updated dependencies [c66f9a5]
  - @voyant-travel/core@0.117.0
  - @voyant-travel/db@0.112.1

## 0.2.3

### Patch Changes

- Updated dependencies [ca90eb5]
  - @voyant-travel/db@0.112.0

## 0.2.2

### Patch Changes

- Updated dependencies [8576451]
  - @voyant-travel/core@0.116.0
  - @voyant-travel/db@0.111.2

## 0.2.1

### Patch Changes

- Updated dependencies [e4e6621]
- Updated dependencies [953e418]
- Updated dependencies [2153e48]
  - @voyant-travel/core@0.115.0
  - @voyant-travel/db@0.111.1

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
