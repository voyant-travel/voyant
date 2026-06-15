# @voyant-travel/accommodations

## 0.105.18

### Patch Changes

- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- eb1ad4b: Move shared place handling into Operations-owned places surfaces while
  preserving existing `facilityId` database fields.

  Remove direct cross-package database constraints from ground, distribution, and
  accommodations into the legacy facilities/property tables; those references now
  remain indexed loose ids for deployment-level linking.

- Updated dependencies [2f1228a]
- Updated dependencies [efc803c]
- Updated dependencies [d92d1a8]
- Updated dependencies [c9ec9f8]
- Updated dependencies [6bff46f]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [44c3875]
- Updated dependencies [3408b2a]
- Updated dependencies [47fef18]
- Updated dependencies [2c9c4a4]
- Updated dependencies [e80e3d3]
  - @voyant-travel/bookings@0.120.0
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/operations@0.1.0

## 0.105.17

### Patch Changes

- d4e3d54: Split oversized cruise route, service, booking, search, and catalog policy modules into smaller vertical slices while preserving the existing public exports and behavior.

  Split oversized flights UI, charter booking, and accommodation content modules into smaller internal slices while preserving the existing public exports and behavior.

- Updated dependencies [bd74fb0]
  - @voyant-travel/catalog@0.117.2
  - @voyant-travel/bookings@0.119.2

## 0.105.16

### Patch Changes

- Updated dependencies [f25e790]
  - @voyant-travel/db@0.108.0
  - @voyant-travel/bookings@0.119.1
  - @voyant-travel/catalog@0.117.1
  - @voyant-travel/facilities@0.107.11

## 0.105.15

### Patch Changes

- @voyant-travel/bookings@0.119.0
- @voyant-travel/catalog@0.117.0
- @voyant-travel/facilities@0.107.10

## 0.105.14

### Patch Changes

- @voyant-travel/bookings@0.118.0
- @voyant-travel/catalog@0.116.0
- @voyant-travel/facilities@0.107.9

## 0.105.13

### Patch Changes

- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
  - @voyant-travel/bookings@0.117.1
  - @voyant-travel/db@0.107.0
  - @voyant-travel/catalog@0.115.1
  - @voyant-travel/facilities@0.107.8

## 0.105.12

### Patch Changes

- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
  - @voyant-travel/bookings@0.117.0
  - @voyant-travel/catalog@0.115.0
  - @voyant-travel/db@0.106.0
  - @voyant-travel/facilities@0.107.7

## 0.105.11

### Patch Changes

- Updated dependencies [418fa82]
  - @voyant-travel/db@0.105.0
  - @voyant-travel/bookings@0.116.0
  - @voyant-travel/catalog@0.114.0
  - @voyant-travel/facilities@0.107.6

## 0.105.10

### Patch Changes

- @voyant-travel/bookings@0.115.0
- @voyant-travel/catalog@0.113.0
- @voyant-travel/facilities@0.107.5

## 0.105.9

### Patch Changes

- @voyant-travel/bookings@0.114.0
- @voyant-travel/catalog@0.112.0
- @voyant-travel/facilities@0.107.4

## 0.105.8

### Patch Changes

- @voyant-travel/bookings@0.113.0
- @voyant-travel/catalog@0.111.0
- @voyant-travel/facilities@0.107.3

## 0.105.7

### Patch Changes

- @voyant-travel/bookings@0.112.0
- @voyant-travel/catalog@0.110.0
- @voyant-travel/facilities@0.107.2

## 0.105.6

### Patch Changes

- @voyant-travel/bookings@0.111.0
- @voyant-travel/catalog@0.109.0
- @voyant-travel/facilities@0.107.1

## 0.105.5

### Patch Changes

- @voyant-travel/bookings@0.110.0
- @voyant-travel/catalog@0.108.0
- @voyant-travel/db@0.104.4
- @voyant-travel/facilities@0.107.0

## 0.105.4

### Patch Changes

- @voyant-travel/bookings@0.109.0
- @voyant-travel/catalog@0.107.0
- @voyant-travel/facilities@0.106.0

## 0.105.3

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyant-travel/catalog@0.106.0
  - @voyant-travel/accommodations-contracts@0.105.1
  - @voyant-travel/bookings@0.108.0
  - @voyant-travel/facilities@0.105.2

## 0.105.2

### Patch Changes

- Updated dependencies [c2aef18]
  - @voyant-travel/catalog@0.105.0
  - @voyant-travel/db@0.104.3
  - @voyant-travel/bookings@0.107.0
  - @voyant-travel/facilities@0.105.0

## 0.105.1

### Patch Changes

- @voyant-travel/bookings@0.106.0
- @voyant-travel/facilities@0.104.3

## 0.105.0

### Minor Changes

- 921f4fc: Add a canonical board-basis contract enum and reuse it across accommodation meal plans, product options, and cruise sailings.

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyant-travel/accommodations-contracts@0.105.0
  - @voyant-travel/catalog@0.104.4
  - @voyant-travel/bookings@0.105.0
  - @voyant-travel/facilities@0.104.2

## 0.104.1

### Patch Changes

- @voyant-travel/accommodations-contracts@0.104.1
- @voyant-travel/bookings@0.104.1
- @voyant-travel/catalog@0.104.1
- @voyant-travel/db@0.104.1
- @voyant-travel/facilities@0.104.1

## 0.104.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.104.0
- @voyant-travel/bookings@0.104.0
- @voyant-travel/catalog@0.104.0
- @voyant-travel/db@0.104.0
- @voyant-travel/facilities@0.104.0

## 0.103.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.103.0
- @voyant-travel/bookings@0.103.0
- @voyant-travel/catalog@0.103.0
- @voyant-travel/db@0.103.0
- @voyant-travel/facilities@0.103.0

## 0.102.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.102.0
- @voyant-travel/bookings@0.102.0
- @voyant-travel/catalog@0.102.0
- @voyant-travel/db@0.102.0
- @voyant-travel/facilities@0.102.0

## 0.101.2

### Patch Changes

- @voyant-travel/accommodations-contracts@0.101.2
- @voyant-travel/bookings@0.101.2
- @voyant-travel/catalog@0.101.2
- @voyant-travel/db@0.101.2
- @voyant-travel/facilities@0.101.2

## 0.101.1

### Patch Changes

- Updated dependencies [f736ba5]
  - @voyant-travel/accommodations-contracts@0.101.1
  - @voyant-travel/bookings@0.101.1
  - @voyant-travel/catalog@0.101.1
  - @voyant-travel/db@0.101.1
  - @voyant-travel/facilities@0.101.1

## 0.101.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.101.0
- @voyant-travel/bookings@0.101.0
- @voyant-travel/catalog@0.101.0
- @voyant-travel/db@0.101.0
- @voyant-travel/facilities@0.101.0

## 0.100.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.100.0
- @voyant-travel/bookings@0.100.0
- @voyant-travel/catalog@0.100.0
- @voyant-travel/db@0.100.0
- @voyant-travel/facilities@0.100.0

## 0.99.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.99.0
- @voyant-travel/bookings@0.99.0
- @voyant-travel/catalog@0.99.0
- @voyant-travel/db@0.99.0
- @voyant-travel/facilities@0.99.0

## 0.98.0

### Patch Changes

- @voyant-travel/accommodations-contracts@0.98.0
- @voyant-travel/bookings@0.98.0
- @voyant-travel/catalog@0.98.0
- @voyant-travel/db@0.98.0
- @voyant-travel/facilities@0.98.0

## 0.97.0

### Patch Changes

- Updated dependencies [2555264]
  - @voyant-travel/accommodations-contracts@0.97.0
  - @voyant-travel/bookings@0.97.0
  - @voyant-travel/catalog@0.97.0
  - @voyant-travel/db@0.97.0
  - @voyant-travel/facilities@0.97.0

## 0.96.0

### Minor Changes

- 465fb31: Extend the lightweight contract-package pattern to the remaining content
  verticals.

  `@voyant-travel/accommodations-contracts`, `@voyant-travel/products-contracts`,
  `@voyant-travel/extras-contracts`, and `@voyant-travel/charters-contracts` now own their
  respective `<vertical>/v1` rich content schema, version constant, types, and
  validator as zod-only packages, so external consumers (Voyant Connect, adapter
  authors, the Admin API SDK) can validate content payloads without installing the
  framework runtime.

  The runtime `@voyant-travel/accommodations`, `@voyant-travel/products`,
  `@voyant-travel/extras`, and `@voyant-travel/charters` packages re-export their content
  shape from the matching contract package, so existing
  `@voyant-travel/<vertical>/content-shape` import paths are unchanged. The
  `mergeOverlaysInto<Vertical>Content` overlay composition stays in the runtime
  package.

  See `docs/adr/0002-contract-packages.md` for the codified pattern.

### Patch Changes

- Updated dependencies [2d8d59b]
- Updated dependencies [465fb31]
  - @voyant-travel/accommodations-contracts@0.96.0
  - @voyant-travel/bookings@0.96.0
  - @voyant-travel/catalog@0.96.0
  - @voyant-travel/db@0.96.0
  - @voyant-travel/facilities@0.96.0

## 0.95.0

### Patch Changes

- Updated dependencies [a8d3a3f]
  - @voyant-travel/bookings@0.95.0
  - @voyant-travel/catalog@0.95.0
  - @voyant-travel/db@0.95.0
  - @voyant-travel/facilities@0.95.0

## 0.94.0

### Patch Changes

- @voyant-travel/bookings@0.94.0
- @voyant-travel/catalog@0.94.0
- @voyant-travel/db@0.94.0
- @voyant-travel/facilities@0.94.0

## 0.93.0

### Patch Changes

- @voyant-travel/bookings@0.93.0
- @voyant-travel/catalog@0.93.0
- @voyant-travel/db@0.93.0
- @voyant-travel/facilities@0.93.0

## 0.92.0

### Patch Changes

- Updated dependencies [5de3d72]
  - @voyant-travel/bookings@0.92.0
  - @voyant-travel/catalog@0.92.0
  - @voyant-travel/db@0.92.0
  - @voyant-travel/facilities@0.92.0

## 0.91.0

### Patch Changes

- Updated dependencies [dc8554b]
  - @voyant-travel/bookings@0.91.0
  - @voyant-travel/catalog@0.91.0
  - @voyant-travel/db@0.91.0
  - @voyant-travel/facilities@0.91.0

## 0.90.0

### Patch Changes

- @voyant-travel/bookings@0.90.0
- @voyant-travel/catalog@0.90.0
- @voyant-travel/db@0.90.0
- @voyant-travel/facilities@0.90.0

## 0.89.0

### Patch Changes

- @voyant-travel/bookings@0.89.0
- @voyant-travel/catalog@0.89.0
- @voyant-travel/db@0.89.0
- @voyant-travel/facilities@0.89.0

## 0.88.0

### Patch Changes

- Updated dependencies [27afa4b]
  - @voyant-travel/bookings@0.88.0
  - @voyant-travel/catalog@0.88.0
  - @voyant-travel/db@0.88.0
  - @voyant-travel/facilities@0.88.0

## 0.87.1

### Patch Changes

- @voyant-travel/bookings@0.87.1
- @voyant-travel/catalog@0.87.1
- @voyant-travel/db@0.87.1
- @voyant-travel/facilities@0.87.1

## 0.87.0

### Patch Changes

- Updated dependencies [85505e6]
  - @voyant-travel/bookings@0.87.0
  - @voyant-travel/catalog@0.87.0
  - @voyant-travel/db@0.87.0
  - @voyant-travel/facilities@0.87.0

## 0.86.0

### Patch Changes

- Updated dependencies [ddf4a19]
  - @voyant-travel/bookings@0.86.0
  - @voyant-travel/catalog@0.86.0
  - @voyant-travel/db@0.86.0
  - @voyant-travel/facilities@0.86.0

## 0.85.4

### Patch Changes

- @voyant-travel/bookings@0.85.4
- @voyant-travel/catalog@0.85.4
- @voyant-travel/db@0.85.4
- @voyant-travel/facilities@0.85.4

## 0.85.3

### Patch Changes

- @voyant-travel/bookings@0.85.3
- @voyant-travel/catalog@0.85.3
- @voyant-travel/db@0.85.3
- @voyant-travel/facilities@0.85.3

## 0.85.2

### Patch Changes

- Updated dependencies [2aac1f9]
  - @voyant-travel/bookings@0.85.2
  - @voyant-travel/catalog@0.85.2
  - @voyant-travel/db@0.85.2
  - @voyant-travel/facilities@0.85.2

## 0.85.1

### Patch Changes

- @voyant-travel/bookings@0.85.1
- @voyant-travel/catalog@0.85.1
- @voyant-travel/db@0.85.1
- @voyant-travel/facilities@0.85.1

## 0.85.0

### Patch Changes

- @voyant-travel/bookings@0.85.0
- @voyant-travel/catalog@0.85.0
- @voyant-travel/db@0.85.0
- @voyant-travel/facilities@0.85.0

## 0.84.4

### Patch Changes

- @voyant-travel/bookings@0.84.4
- @voyant-travel/catalog@0.84.4
- @voyant-travel/db@0.84.4
- @voyant-travel/facilities@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyant-travel/bookings@0.84.3
  - @voyant-travel/catalog@0.84.3
  - @voyant-travel/db@0.84.3
  - @voyant-travel/facilities@0.84.3

## 0.84.2

### Patch Changes

- @voyant-travel/bookings@0.84.2
- @voyant-travel/catalog@0.84.2
- @voyant-travel/db@0.84.2
- @voyant-travel/facilities@0.84.2

## 0.84.1

### Patch Changes

- Updated dependencies [b9ef614]
  - @voyant-travel/bookings@0.84.1
  - @voyant-travel/catalog@0.84.1
  - @voyant-travel/db@0.84.1
  - @voyant-travel/facilities@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyant-travel/bookings@0.84.0
  - @voyant-travel/catalog@0.84.0
  - @voyant-travel/db@0.84.0
  - @voyant-travel/facilities@0.84.0

## 0.83.1

### Patch Changes

- @voyant-travel/bookings@0.83.1
- @voyant-travel/catalog@0.83.1
- @voyant-travel/db@0.83.1
- @voyant-travel/facilities@0.83.1

## 0.83.0

### Patch Changes

- @voyant-travel/bookings@0.83.0
- @voyant-travel/catalog@0.83.0
- @voyant-travel/db@0.83.0
- @voyant-travel/facilities@0.83.0

## 0.82.1

### Patch Changes

- @voyant-travel/bookings@0.82.1
- @voyant-travel/catalog@0.82.1
- @voyant-travel/db@0.82.1
- @voyant-travel/facilities@0.82.1

## 0.82.0

### Patch Changes

- @voyant-travel/bookings@0.82.0
- @voyant-travel/catalog@0.82.0
- @voyant-travel/db@0.82.0
- @voyant-travel/facilities@0.82.0

## 0.81.21

### Patch Changes

- Updated dependencies [b9fb5b0]
  - @voyant-travel/bookings@0.81.21
  - @voyant-travel/catalog@0.81.21
  - @voyant-travel/db@0.81.21
  - @voyant-travel/facilities@0.81.21

## 0.81.20

### Patch Changes

- Updated dependencies [e60a50d]
  - @voyant-travel/bookings@0.81.20
  - @voyant-travel/catalog@0.81.20
  - @voyant-travel/db@0.81.20
  - @voyant-travel/facilities@0.81.20

## 0.81.19

### Patch Changes

- Updated dependencies [62e4be5]
  - @voyant-travel/bookings@0.81.19
  - @voyant-travel/catalog@0.81.19
  - @voyant-travel/db@0.81.19
  - @voyant-travel/facilities@0.81.19

## 0.81.18

### Patch Changes

- @voyant-travel/bookings@0.81.18
- @voyant-travel/catalog@0.81.18
- @voyant-travel/db@0.81.18
- @voyant-travel/facilities@0.81.18

## 0.81.17

### Patch Changes

- @voyant-travel/bookings@0.81.17
- @voyant-travel/catalog@0.81.17
- @voyant-travel/db@0.81.17
- @voyant-travel/facilities@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyant-travel/bookings@0.81.16
  - @voyant-travel/catalog@0.81.16
  - @voyant-travel/db@0.81.16
  - @voyant-travel/facilities@0.81.16

## 0.81.15

### Patch Changes

- @voyant-travel/bookings@0.81.15
- @voyant-travel/catalog@0.81.15
- @voyant-travel/db@0.81.15
- @voyant-travel/facilities@0.81.15

## 0.81.14

### Patch Changes

- @voyant-travel/bookings@0.81.14
- @voyant-travel/catalog@0.81.14
- @voyant-travel/db@0.81.14
- @voyant-travel/facilities@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [28dca55]
  - @voyant-travel/bookings@0.81.13
  - @voyant-travel/catalog@0.81.13
  - @voyant-travel/db@0.81.13
  - @voyant-travel/facilities@0.81.13

## 0.81.12

### Patch Changes

- @voyant-travel/bookings@0.81.12
- @voyant-travel/catalog@0.81.12
- @voyant-travel/db@0.81.12
- @voyant-travel/facilities@0.81.12

## 0.81.11

### Patch Changes

- @voyant-travel/bookings@0.81.11
- @voyant-travel/catalog@0.81.11
- @voyant-travel/db@0.81.11
- @voyant-travel/facilities@0.81.11

## 0.81.10

### Patch Changes

- @voyant-travel/bookings@0.81.10
- @voyant-travel/catalog@0.81.10
- @voyant-travel/db@0.81.10
- @voyant-travel/facilities@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyant-travel/bookings@0.81.9
  - @voyant-travel/catalog@0.81.9
  - @voyant-travel/db@0.81.9
  - @voyant-travel/facilities@0.81.9

## 0.81.8

### Patch Changes

- Updated dependencies [688ac4f]
  - @voyant-travel/bookings@0.81.8
  - @voyant-travel/catalog@0.81.8
  - @voyant-travel/db@0.81.8
  - @voyant-travel/facilities@0.81.8

## 0.81.7

### Patch Changes

- Updated dependencies [410cd17]
  - @voyant-travel/bookings@0.81.7
  - @voyant-travel/catalog@0.81.7
  - @voyant-travel/db@0.81.7
  - @voyant-travel/facilities@0.81.7

## 0.81.6

### Patch Changes

- @voyant-travel/bookings@0.81.6
- @voyant-travel/catalog@0.81.6
- @voyant-travel/db@0.81.6
- @voyant-travel/facilities@0.81.6

## 0.81.5

### Patch Changes

- @voyant-travel/bookings@0.81.5
- @voyant-travel/catalog@0.81.5
- @voyant-travel/db@0.81.5
- @voyant-travel/facilities@0.81.5

## 0.81.4

### Patch Changes

- Updated dependencies [6daefc4]
  - @voyant-travel/bookings@0.81.4
  - @voyant-travel/catalog@0.81.4
  - @voyant-travel/db@0.81.4
  - @voyant-travel/facilities@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyant-travel/bookings@0.81.3
  - @voyant-travel/catalog@0.81.3
  - @voyant-travel/db@0.81.3
  - @voyant-travel/facilities@0.81.3

## 0.81.2

### Patch Changes

- @voyant-travel/bookings@0.81.2
- @voyant-travel/catalog@0.81.2
- @voyant-travel/db@0.81.2
- @voyant-travel/facilities@0.81.2

## 0.81.1

### Patch Changes

- @voyant-travel/bookings@0.81.1
- @voyant-travel/catalog@0.81.1
- @voyant-travel/db@0.81.1
- @voyant-travel/facilities@0.81.1

## 0.81.0

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyant-travel/bookings@0.81.0
  - @voyant-travel/catalog@0.81.0
  - @voyant-travel/db@0.81.0
  - @voyant-travel/facilities@0.81.0

## 0.80.18

### Patch Changes

- @voyant-travel/bookings@0.80.18
- @voyant-travel/catalog@0.80.18
- @voyant-travel/db@0.80.18
- @voyant-travel/facilities@0.80.18

## 0.80.17

### Patch Changes

- @voyant-travel/bookings@0.80.17
- @voyant-travel/catalog@0.80.17
- @voyant-travel/db@0.80.17
- @voyant-travel/facilities@0.80.17

## 0.80.16

### Patch Changes

- @voyant-travel/bookings@0.80.16
- @voyant-travel/catalog@0.80.16
- @voyant-travel/db@0.80.16
- @voyant-travel/facilities@0.80.16

## 0.80.15

### Patch Changes

- Updated dependencies [0d8d14e]
  - @voyant-travel/bookings@0.80.15
  - @voyant-travel/catalog@0.80.15
  - @voyant-travel/db@0.80.15
  - @voyant-travel/facilities@0.80.15

## 0.80.14

### Patch Changes

- @voyant-travel/bookings@0.80.14
- @voyant-travel/catalog@0.80.14
- @voyant-travel/db@0.80.14
- @voyant-travel/facilities@0.80.14

## 0.80.13

### Patch Changes

- @voyant-travel/bookings@0.80.13
- @voyant-travel/catalog@0.80.13
- @voyant-travel/db@0.80.13
- @voyant-travel/facilities@0.80.13

## 0.80.12

### Patch Changes

- @voyant-travel/bookings@0.80.12
- @voyant-travel/catalog@0.80.12
- @voyant-travel/db@0.80.12
- @voyant-travel/facilities@0.80.12

## 0.80.11

### Patch Changes

- @voyant-travel/bookings@0.80.11
- @voyant-travel/catalog@0.80.11
- @voyant-travel/db@0.80.11
- @voyant-travel/facilities@0.80.11

## 0.80.10

### Patch Changes

- @voyant-travel/bookings@0.80.10
- @voyant-travel/catalog@0.80.10
- @voyant-travel/db@0.80.10
- @voyant-travel/facilities@0.80.10

## 0.80.9

### Patch Changes

- Updated dependencies [37aa8b6]
  - @voyant-travel/bookings@0.80.9
  - @voyant-travel/catalog@0.80.9
  - @voyant-travel/db@0.80.9
  - @voyant-travel/facilities@0.80.9

## 0.80.8

### Patch Changes

- @voyant-travel/bookings@0.80.8
- @voyant-travel/catalog@0.80.8
- @voyant-travel/db@0.80.8
- @voyant-travel/facilities@0.80.8

## 0.80.7

### Patch Changes

- @voyant-travel/bookings@0.80.7
- @voyant-travel/catalog@0.80.7
- @voyant-travel/db@0.80.7
- @voyant-travel/facilities@0.80.7

## 0.80.6

### Patch Changes

- @voyant-travel/bookings@0.80.6
- @voyant-travel/catalog@0.80.6
- @voyant-travel/db@0.80.6
- @voyant-travel/facilities@0.80.6

## 0.80.5

### Patch Changes

- @voyant-travel/bookings@0.80.5
- @voyant-travel/catalog@0.80.5
- @voyant-travel/db@0.80.5
- @voyant-travel/facilities@0.80.5

## 0.80.4

### Patch Changes

- @voyant-travel/bookings@0.80.4
- @voyant-travel/catalog@0.80.4
- @voyant-travel/db@0.80.4
- @voyant-travel/facilities@0.80.4

## 0.80.3

### Patch Changes

- @voyant-travel/bookings@0.80.3
- @voyant-travel/catalog@0.80.3
- @voyant-travel/db@0.80.3
- @voyant-travel/facilities@0.80.3

## 0.80.2

### Patch Changes

- Updated dependencies [7a94871]
- Updated dependencies [9d6be13]
  - @voyant-travel/bookings@0.80.2
  - @voyant-travel/catalog@0.80.2
  - @voyant-travel/db@0.80.2
  - @voyant-travel/facilities@0.80.2

## 0.80.1

### Patch Changes

- @voyant-travel/bookings@0.80.1
- @voyant-travel/catalog@0.80.1
- @voyant-travel/db@0.80.1
- @voyant-travel/facilities@0.80.1

## 0.80.0

### Patch Changes

- @voyant-travel/bookings@0.80.0
- @voyant-travel/catalog@0.80.0
- @voyant-travel/db@0.80.0
- @voyant-travel/facilities@0.80.0

## 0.79.0

### Patch Changes

- @voyant-travel/bookings@0.79.0
- @voyant-travel/catalog@0.79.0
- @voyant-travel/db@0.79.0
- @voyant-travel/facilities@0.79.0

## 0.78.0

### Patch Changes

- @voyant-travel/bookings@0.78.0
- @voyant-travel/catalog@0.78.0
- @voyant-travel/db@0.78.0
- @voyant-travel/facilities@0.78.0

## 0.77.13

### Patch Changes

- @voyant-travel/bookings@0.77.13
- @voyant-travel/catalog@0.77.13
- @voyant-travel/db@0.77.13
- @voyant-travel/facilities@0.77.13

## 0.77.12

### Patch Changes

- @voyant-travel/bookings@0.77.12
- @voyant-travel/catalog@0.77.12
- @voyant-travel/db@0.77.12
- @voyant-travel/facilities@0.77.12

## 0.77.11

### Patch Changes

- @voyant-travel/bookings@0.77.11
- @voyant-travel/catalog@0.77.11
- @voyant-travel/db@0.77.11
- @voyant-travel/facilities@0.77.11

## 0.77.10

### Patch Changes

- @voyant-travel/bookings@0.77.10
- @voyant-travel/catalog@0.77.10
- @voyant-travel/db@0.77.10
- @voyant-travel/facilities@0.77.10

## 0.77.9

### Patch Changes

- @voyant-travel/bookings@0.77.9
- @voyant-travel/catalog@0.77.9
- @voyant-travel/db@0.77.9
- @voyant-travel/facilities@0.77.9

## 0.77.8

### Patch Changes

- @voyant-travel/bookings@0.77.8
- @voyant-travel/catalog@0.77.8
- @voyant-travel/db@0.77.8
- @voyant-travel/facilities@0.77.8

## 0.77.7

### Patch Changes

- @voyant-travel/bookings@0.77.7
- @voyant-travel/catalog@0.77.7
- @voyant-travel/db@0.77.7
- @voyant-travel/facilities@0.77.7

## 0.77.6

### Patch Changes

- @voyant-travel/bookings@0.77.6
- @voyant-travel/catalog@0.77.6
- @voyant-travel/db@0.77.6
- @voyant-travel/facilities@0.77.6

## 0.77.5

### Patch Changes

- @voyant-travel/bookings@0.77.5
- @voyant-travel/catalog@0.77.5
- @voyant-travel/db@0.77.5
- @voyant-travel/facilities@0.77.5

## 0.77.4

### Patch Changes

- @voyant-travel/bookings@0.77.4
- @voyant-travel/catalog@0.77.4
- @voyant-travel/db@0.77.4
- @voyant-travel/facilities@0.77.4

## 0.77.3

### Patch Changes

- @voyant-travel/bookings@0.77.3
- @voyant-travel/catalog@0.77.3
- @voyant-travel/db@0.77.3
- @voyant-travel/facilities@0.77.3

## 0.77.2

### Patch Changes

- @voyant-travel/bookings@0.77.2
- @voyant-travel/catalog@0.77.2
- @voyant-travel/db@0.77.2
- @voyant-travel/facilities@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyant-travel/bookings@0.77.1
  - @voyant-travel/catalog@0.77.1
  - @voyant-travel/db@0.77.1
  - @voyant-travel/facilities@0.77.1

## 0.77.0

### Patch Changes

- @voyant-travel/bookings@0.77.0
- @voyant-travel/catalog@0.77.0
- @voyant-travel/db@0.77.0
- @voyant-travel/facilities@0.77.0

## 0.76.0

### Patch Changes

- @voyant-travel/bookings@0.76.0
- @voyant-travel/catalog@0.76.0
- @voyant-travel/db@0.76.0
- @voyant-travel/facilities@0.76.0

## 0.75.7

### Patch Changes

- @voyant-travel/bookings@0.75.7
- @voyant-travel/catalog@0.75.7
- @voyant-travel/db@0.75.7
- @voyant-travel/facilities@0.75.7

## 0.75.6

### Patch Changes

- @voyant-travel/bookings@0.75.6
- @voyant-travel/catalog@0.75.6
- @voyant-travel/db@0.75.6
- @voyant-travel/facilities@0.75.6

## 0.75.5

### Patch Changes

- @voyant-travel/bookings@0.75.5
- @voyant-travel/catalog@0.75.5
- @voyant-travel/db@0.75.5
- @voyant-travel/facilities@0.75.5

## 0.75.4

### Patch Changes

- @voyant-travel/bookings@0.75.4
- @voyant-travel/catalog@0.75.4
- @voyant-travel/db@0.75.4
- @voyant-travel/facilities@0.75.4

## 0.75.3

### Patch Changes

- @voyant-travel/bookings@0.75.3
- @voyant-travel/catalog@0.75.3
- @voyant-travel/db@0.75.3
- @voyant-travel/facilities@0.75.3

## 0.75.2

### Patch Changes

- @voyant-travel/bookings@0.75.2
- @voyant-travel/catalog@0.75.2
- @voyant-travel/db@0.75.2
- @voyant-travel/facilities@0.75.2

## 0.75.1

### Patch Changes

- @voyant-travel/bookings@0.75.1
- @voyant-travel/catalog@0.75.1
- @voyant-travel/db@0.75.1
- @voyant-travel/facilities@0.75.1

## 0.75.0

### Patch Changes

- Updated dependencies [1eab599]
  - @voyant-travel/bookings@0.75.0
  - @voyant-travel/catalog@0.75.0
  - @voyant-travel/db@0.75.0
  - @voyant-travel/facilities@0.75.0

## 0.74.2

### Patch Changes

- @voyant-travel/bookings@0.74.2
- @voyant-travel/catalog@0.74.2
- @voyant-travel/db@0.74.2
- @voyant-travel/facilities@0.74.2

## 0.74.1

### Patch Changes

- @voyant-travel/bookings@0.74.1
- @voyant-travel/catalog@0.74.1
- @voyant-travel/db@0.74.1
- @voyant-travel/facilities@0.74.1

## 0.74.0

### Patch Changes

- @voyant-travel/bookings@0.74.0
- @voyant-travel/catalog@0.74.0
- @voyant-travel/db@0.74.0
- @voyant-travel/facilities@0.74.0

## 0.73.1

### Patch Changes

- @voyant-travel/bookings@0.73.1
- @voyant-travel/catalog@0.73.1
- @voyant-travel/db@0.73.1
- @voyant-travel/facilities@0.73.1

## 0.73.0

### Patch Changes

- @voyant-travel/bookings@0.73.0
- @voyant-travel/catalog@0.73.0
- @voyant-travel/db@0.73.0
- @voyant-travel/facilities@0.73.0

## 0.72.0

### Patch Changes

- @voyant-travel/bookings@0.72.0
- @voyant-travel/catalog@0.72.0
- @voyant-travel/db@0.72.0
- @voyant-travel/facilities@0.72.0

## 0.71.0

### Patch Changes

- @voyant-travel/bookings@0.71.0
- @voyant-travel/catalog@0.71.0
- @voyant-travel/db@0.71.0
- @voyant-travel/facilities@0.71.0

## 0.70.0

### Patch Changes

- @voyant-travel/bookings@0.70.0
- @voyant-travel/catalog@0.70.0
- @voyant-travel/db@0.70.0
- @voyant-travel/facilities@0.70.0

## 0.69.1

### Patch Changes

- @voyant-travel/bookings@0.69.1
- @voyant-travel/catalog@0.69.1
- @voyant-travel/db@0.69.1
- @voyant-travel/facilities@0.69.1

## 0.69.0

### Patch Changes

- @voyant-travel/bookings@0.69.0
- @voyant-travel/catalog@0.69.0
- @voyant-travel/db@0.69.0
- @voyant-travel/facilities@0.69.0

## 0.68.0

### Patch Changes

- @voyant-travel/bookings@0.68.0
- @voyant-travel/catalog@0.68.0
- @voyant-travel/db@0.68.0
- @voyant-travel/facilities@0.68.0

## 0.67.0

### Patch Changes

- @voyant-travel/bookings@0.67.0
- @voyant-travel/catalog@0.67.0
- @voyant-travel/db@0.67.0
- @voyant-travel/facilities@0.67.0

## 0.66.6

### Patch Changes

- @voyant-travel/bookings@0.66.6
- @voyant-travel/catalog@0.66.6
- @voyant-travel/db@0.66.6
- @voyant-travel/facilities@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyant-travel/bookings@0.66.5
  - @voyant-travel/catalog@0.66.5
  - @voyant-travel/db@0.66.5
  - @voyant-travel/facilities@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyant-travel/bookings@0.66.4
  - @voyant-travel/catalog@0.66.4
  - @voyant-travel/db@0.66.4
  - @voyant-travel/facilities@0.66.4

## 0.66.3

### Patch Changes

- @voyant-travel/bookings@0.66.3
- @voyant-travel/catalog@0.66.3
- @voyant-travel/db@0.66.3
- @voyant-travel/facilities@0.66.3

## 0.66.2

### Patch Changes

- @voyant-travel/bookings@0.66.2
- @voyant-travel/catalog@0.66.2
- @voyant-travel/db@0.66.2
- @voyant-travel/facilities@0.66.2

## 0.66.1

### Patch Changes

- @voyant-travel/bookings@0.66.1
- @voyant-travel/catalog@0.66.1
- @voyant-travel/db@0.66.1
- @voyant-travel/facilities@0.66.1

## 0.66.0

### Patch Changes

- @voyant-travel/bookings@0.66.0
- @voyant-travel/catalog@0.66.0
- @voyant-travel/db@0.66.0
- @voyant-travel/facilities@0.66.0

## 0.65.0

### Patch Changes

- @voyant-travel/bookings@0.65.0
- @voyant-travel/catalog@0.65.0
- @voyant-travel/db@0.65.0
- @voyant-travel/facilities@0.65.0

## 0.64.1

### Patch Changes

- @voyant-travel/bookings@0.64.1
- @voyant-travel/catalog@0.64.1
- @voyant-travel/db@0.64.1
- @voyant-travel/facilities@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyant-travel/bookings@0.64.0
  - @voyant-travel/catalog@0.64.0
  - @voyant-travel/db@0.64.0
  - @voyant-travel/facilities@0.64.0

## 0.63.1

### Patch Changes

- @voyant-travel/bookings@0.63.1
- @voyant-travel/catalog@0.63.1
- @voyant-travel/db@0.63.1
- @voyant-travel/facilities@0.63.1

## 0.63.0

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyant-travel/bookings@0.63.0
  - @voyant-travel/catalog@0.63.0
  - @voyant-travel/db@0.63.0
  - @voyant-travel/facilities@0.63.0

## 0.62.3

### Patch Changes

- @voyant-travel/bookings@0.62.3
- @voyant-travel/catalog@0.62.3
- @voyant-travel/db@0.62.3
- @voyant-travel/facilities@0.62.3

## 0.62.2

### Patch Changes

- @voyant-travel/bookings@0.62.2
- @voyant-travel/catalog@0.62.2
- @voyant-travel/db@0.62.2
- @voyant-travel/facilities@0.62.2

## 0.62.1

### Patch Changes

- @voyant-travel/bookings@0.62.1
- @voyant-travel/catalog@0.62.1
- @voyant-travel/db@0.62.1
- @voyant-travel/facilities@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyant-travel/bookings@0.62.0
  - @voyant-travel/catalog@0.62.0
  - @voyant-travel/db@0.62.0
  - @voyant-travel/facilities@0.62.0

## 0.61.0

### Patch Changes

- @voyant-travel/bookings@0.61.0
- @voyant-travel/catalog@0.61.0
- @voyant-travel/db@0.61.0
- @voyant-travel/facilities@0.61.0

## 0.60.0

### Patch Changes

- @voyant-travel/bookings@0.60.0
- @voyant-travel/catalog@0.60.0
- @voyant-travel/db@0.60.0
- @voyant-travel/facilities@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyant-travel/bookings@0.59.0
  - @voyant-travel/catalog@0.59.0
  - @voyant-travel/db@0.59.0
  - @voyant-travel/facilities@0.59.0

## 0.58.0

### Patch Changes

- Updated dependencies [5b21488]
  - @voyant-travel/bookings@0.58.0
  - @voyant-travel/catalog@0.58.0
  - @voyant-travel/db@0.58.0
  - @voyant-travel/facilities@0.58.0

## 0.57.0

### Patch Changes

- @voyant-travel/bookings@0.57.0
- @voyant-travel/catalog@0.57.0
- @voyant-travel/db@0.57.0
- @voyant-travel/facilities@0.57.0

## 0.56.0

### Patch Changes

- @voyant-travel/bookings@0.56.0
- @voyant-travel/catalog@0.56.0
- @voyant-travel/db@0.56.0
- @voyant-travel/facilities@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyant-travel/bookings@0.55.1
  - @voyant-travel/catalog@0.55.1
  - @voyant-travel/db@0.55.1
  - @voyant-travel/facilities@0.55.1

## 0.55.0

### Minor Changes

- f0c2a6d: Add the accommodation resale package and retire the legacy hospitality package family.

  Accommodation inventory remains available as catalog resale content for OTAs, DMCs, and tour operators, while first-party hotel-managed operations surfaces are removed from the active package, template, and UI registry surfaces. Consumers should use `@voyant-travel/accommodations` for lodging catalog and stay booking-line integrations instead of the removed `@voyant-travel/hospitality`, `@voyant-travel/hospitality-react`, and `@voyant-travel/hospitality-ui` package family.

### Patch Changes

- @voyant-travel/bookings@0.55.0
- @voyant-travel/catalog@0.55.0
- @voyant-travel/db@0.55.0
- @voyant-travel/facilities@0.55.0
