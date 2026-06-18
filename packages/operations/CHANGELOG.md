# @voyant-travel/operations

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
