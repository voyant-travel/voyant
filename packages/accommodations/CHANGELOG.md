# @voyantjs/accommodations

## 0.105.0

### Minor Changes

- 921f4fc: Add a canonical board-basis contract enum and reuse it across accommodation meal plans, product options, and cruise sailings.

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/accommodations-contracts@0.105.0
  - @voyantjs/catalog@0.104.4
  - @voyantjs/bookings@0.105.0
  - @voyantjs/facilities@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/accommodations-contracts@0.104.1
- @voyantjs/bookings@0.104.1
- @voyantjs/catalog@0.104.1
- @voyantjs/db@0.104.1
- @voyantjs/facilities@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.104.0
- @voyantjs/bookings@0.104.0
- @voyantjs/catalog@0.104.0
- @voyantjs/db@0.104.0
- @voyantjs/facilities@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.103.0
- @voyantjs/bookings@0.103.0
- @voyantjs/catalog@0.103.0
- @voyantjs/db@0.103.0
- @voyantjs/facilities@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.102.0
- @voyantjs/bookings@0.102.0
- @voyantjs/catalog@0.102.0
- @voyantjs/db@0.102.0
- @voyantjs/facilities@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/accommodations-contracts@0.101.2
- @voyantjs/bookings@0.101.2
- @voyantjs/catalog@0.101.2
- @voyantjs/db@0.101.2
- @voyantjs/facilities@0.101.2

## 0.101.1

### Patch Changes

- Updated dependencies [f736ba5]
  - @voyantjs/accommodations-contracts@0.101.1
  - @voyantjs/bookings@0.101.1
  - @voyantjs/catalog@0.101.1
  - @voyantjs/db@0.101.1
  - @voyantjs/facilities@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.101.0
- @voyantjs/bookings@0.101.0
- @voyantjs/catalog@0.101.0
- @voyantjs/db@0.101.0
- @voyantjs/facilities@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.100.0
- @voyantjs/bookings@0.100.0
- @voyantjs/catalog@0.100.0
- @voyantjs/db@0.100.0
- @voyantjs/facilities@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.99.0
- @voyantjs/bookings@0.99.0
- @voyantjs/catalog@0.99.0
- @voyantjs/db@0.99.0
- @voyantjs/facilities@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/accommodations-contracts@0.98.0
- @voyantjs/bookings@0.98.0
- @voyantjs/catalog@0.98.0
- @voyantjs/db@0.98.0
- @voyantjs/facilities@0.98.0

## 0.97.0

### Patch Changes

- Updated dependencies [2555264]
  - @voyantjs/accommodations-contracts@0.97.0
  - @voyantjs/bookings@0.97.0
  - @voyantjs/catalog@0.97.0
  - @voyantjs/db@0.97.0
  - @voyantjs/facilities@0.97.0

## 0.96.0

### Minor Changes

- 465fb31: Extend the lightweight contract-package pattern to the remaining content
  verticals.

  `@voyantjs/accommodations-contracts`, `@voyantjs/products-contracts`,
  `@voyantjs/extras-contracts`, and `@voyantjs/charters-contracts` now own their
  respective `<vertical>/v1` rich content schema, version constant, types, and
  validator as zod-only packages, so external consumers (Voyant Connect, adapter
  authors, the Admin API SDK) can validate content payloads without installing the
  framework runtime.

  The runtime `@voyantjs/accommodations`, `@voyantjs/products`,
  `@voyantjs/extras`, and `@voyantjs/charters` packages re-export their content
  shape from the matching contract package, so existing
  `@voyantjs/<vertical>/content-shape` import paths are unchanged. The
  `mergeOverlaysInto<Vertical>Content` overlay composition stays in the runtime
  package.

  See `docs/adr/0002-contract-packages.md` for the codified pattern.

### Patch Changes

- Updated dependencies [2d8d59b]
- Updated dependencies [465fb31]
  - @voyantjs/accommodations-contracts@0.96.0
  - @voyantjs/bookings@0.96.0
  - @voyantjs/catalog@0.96.0
  - @voyantjs/db@0.96.0
  - @voyantjs/facilities@0.96.0

## 0.95.0

### Patch Changes

- Updated dependencies [a8d3a3f]
  - @voyantjs/bookings@0.95.0
  - @voyantjs/catalog@0.95.0
  - @voyantjs/db@0.95.0
  - @voyantjs/facilities@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/bookings@0.94.0
- @voyantjs/catalog@0.94.0
- @voyantjs/db@0.94.0
- @voyantjs/facilities@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/bookings@0.93.0
- @voyantjs/catalog@0.93.0
- @voyantjs/db@0.93.0
- @voyantjs/facilities@0.93.0

## 0.92.0

### Patch Changes

- Updated dependencies [5de3d72]
  - @voyantjs/bookings@0.92.0
  - @voyantjs/catalog@0.92.0
  - @voyantjs/db@0.92.0
  - @voyantjs/facilities@0.92.0

## 0.91.0

### Patch Changes

- Updated dependencies [dc8554b]
  - @voyantjs/bookings@0.91.0
  - @voyantjs/catalog@0.91.0
  - @voyantjs/db@0.91.0
  - @voyantjs/facilities@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/bookings@0.90.0
- @voyantjs/catalog@0.90.0
- @voyantjs/db@0.90.0
- @voyantjs/facilities@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/bookings@0.89.0
- @voyantjs/catalog@0.89.0
- @voyantjs/db@0.89.0
- @voyantjs/facilities@0.89.0

## 0.88.0

### Patch Changes

- Updated dependencies [27afa4b]
  - @voyantjs/bookings@0.88.0
  - @voyantjs/catalog@0.88.0
  - @voyantjs/db@0.88.0
  - @voyantjs/facilities@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/bookings@0.87.1
- @voyantjs/catalog@0.87.1
- @voyantjs/db@0.87.1
- @voyantjs/facilities@0.87.1

## 0.87.0

### Patch Changes

- Updated dependencies [85505e6]
  - @voyantjs/bookings@0.87.0
  - @voyantjs/catalog@0.87.0
  - @voyantjs/db@0.87.0
  - @voyantjs/facilities@0.87.0

## 0.86.0

### Patch Changes

- Updated dependencies [ddf4a19]
  - @voyantjs/bookings@0.86.0
  - @voyantjs/catalog@0.86.0
  - @voyantjs/db@0.86.0
  - @voyantjs/facilities@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/bookings@0.85.4
- @voyantjs/catalog@0.85.4
- @voyantjs/db@0.85.4
- @voyantjs/facilities@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/bookings@0.85.3
- @voyantjs/catalog@0.85.3
- @voyantjs/db@0.85.3
- @voyantjs/facilities@0.85.3

## 0.85.2

### Patch Changes

- Updated dependencies [2aac1f9]
  - @voyantjs/bookings@0.85.2
  - @voyantjs/catalog@0.85.2
  - @voyantjs/db@0.85.2
  - @voyantjs/facilities@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/bookings@0.85.1
- @voyantjs/catalog@0.85.1
- @voyantjs/db@0.85.1
- @voyantjs/facilities@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/bookings@0.85.0
- @voyantjs/catalog@0.85.0
- @voyantjs/db@0.85.0
- @voyantjs/facilities@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/bookings@0.84.4
- @voyantjs/catalog@0.84.4
- @voyantjs/db@0.84.4
- @voyantjs/facilities@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/bookings@0.84.3
  - @voyantjs/catalog@0.84.3
  - @voyantjs/db@0.84.3
  - @voyantjs/facilities@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/bookings@0.84.2
- @voyantjs/catalog@0.84.2
- @voyantjs/db@0.84.2
- @voyantjs/facilities@0.84.2

## 0.84.1

### Patch Changes

- Updated dependencies [b9ef614]
  - @voyantjs/bookings@0.84.1
  - @voyantjs/catalog@0.84.1
  - @voyantjs/db@0.84.1
  - @voyantjs/facilities@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/bookings@0.84.0
  - @voyantjs/catalog@0.84.0
  - @voyantjs/db@0.84.0
  - @voyantjs/facilities@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/bookings@0.83.1
- @voyantjs/catalog@0.83.1
- @voyantjs/db@0.83.1
- @voyantjs/facilities@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/bookings@0.83.0
- @voyantjs/catalog@0.83.0
- @voyantjs/db@0.83.0
- @voyantjs/facilities@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/bookings@0.82.1
- @voyantjs/catalog@0.82.1
- @voyantjs/db@0.82.1
- @voyantjs/facilities@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/bookings@0.82.0
- @voyantjs/catalog@0.82.0
- @voyantjs/db@0.82.0
- @voyantjs/facilities@0.82.0

## 0.81.21

### Patch Changes

- Updated dependencies [b9fb5b0]
  - @voyantjs/bookings@0.81.21
  - @voyantjs/catalog@0.81.21
  - @voyantjs/db@0.81.21
  - @voyantjs/facilities@0.81.21

## 0.81.20

### Patch Changes

- Updated dependencies [e60a50d]
  - @voyantjs/bookings@0.81.20
  - @voyantjs/catalog@0.81.20
  - @voyantjs/db@0.81.20
  - @voyantjs/facilities@0.81.20

## 0.81.19

### Patch Changes

- Updated dependencies [62e4be5]
  - @voyantjs/bookings@0.81.19
  - @voyantjs/catalog@0.81.19
  - @voyantjs/db@0.81.19
  - @voyantjs/facilities@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/bookings@0.81.18
- @voyantjs/catalog@0.81.18
- @voyantjs/db@0.81.18
- @voyantjs/facilities@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/bookings@0.81.17
- @voyantjs/catalog@0.81.17
- @voyantjs/db@0.81.17
- @voyantjs/facilities@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/bookings@0.81.16
  - @voyantjs/catalog@0.81.16
  - @voyantjs/db@0.81.16
  - @voyantjs/facilities@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/bookings@0.81.15
- @voyantjs/catalog@0.81.15
- @voyantjs/db@0.81.15
- @voyantjs/facilities@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/bookings@0.81.14
- @voyantjs/catalog@0.81.14
- @voyantjs/db@0.81.14
- @voyantjs/facilities@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [28dca55]
  - @voyantjs/bookings@0.81.13
  - @voyantjs/catalog@0.81.13
  - @voyantjs/db@0.81.13
  - @voyantjs/facilities@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/bookings@0.81.12
- @voyantjs/catalog@0.81.12
- @voyantjs/db@0.81.12
- @voyantjs/facilities@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/bookings@0.81.11
- @voyantjs/catalog@0.81.11
- @voyantjs/db@0.81.11
- @voyantjs/facilities@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/bookings@0.81.10
- @voyantjs/catalog@0.81.10
- @voyantjs/db@0.81.10
- @voyantjs/facilities@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyantjs/bookings@0.81.9
  - @voyantjs/catalog@0.81.9
  - @voyantjs/db@0.81.9
  - @voyantjs/facilities@0.81.9

## 0.81.8

### Patch Changes

- Updated dependencies [688ac4f]
  - @voyantjs/bookings@0.81.8
  - @voyantjs/catalog@0.81.8
  - @voyantjs/db@0.81.8
  - @voyantjs/facilities@0.81.8

## 0.81.7

### Patch Changes

- Updated dependencies [410cd17]
  - @voyantjs/bookings@0.81.7
  - @voyantjs/catalog@0.81.7
  - @voyantjs/db@0.81.7
  - @voyantjs/facilities@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/bookings@0.81.6
- @voyantjs/catalog@0.81.6
- @voyantjs/db@0.81.6
- @voyantjs/facilities@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/bookings@0.81.5
- @voyantjs/catalog@0.81.5
- @voyantjs/db@0.81.5
- @voyantjs/facilities@0.81.5

## 0.81.4

### Patch Changes

- Updated dependencies [6daefc4]
  - @voyantjs/bookings@0.81.4
  - @voyantjs/catalog@0.81.4
  - @voyantjs/db@0.81.4
  - @voyantjs/facilities@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyantjs/bookings@0.81.3
  - @voyantjs/catalog@0.81.3
  - @voyantjs/db@0.81.3
  - @voyantjs/facilities@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/bookings@0.81.2
- @voyantjs/catalog@0.81.2
- @voyantjs/db@0.81.2
- @voyantjs/facilities@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/bookings@0.81.1
- @voyantjs/catalog@0.81.1
- @voyantjs/db@0.81.1
- @voyantjs/facilities@0.81.1

## 0.81.0

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyantjs/bookings@0.81.0
  - @voyantjs/catalog@0.81.0
  - @voyantjs/db@0.81.0
  - @voyantjs/facilities@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/bookings@0.80.18
- @voyantjs/catalog@0.80.18
- @voyantjs/db@0.80.18
- @voyantjs/facilities@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/bookings@0.80.17
- @voyantjs/catalog@0.80.17
- @voyantjs/db@0.80.17
- @voyantjs/facilities@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/bookings@0.80.16
- @voyantjs/catalog@0.80.16
- @voyantjs/db@0.80.16
- @voyantjs/facilities@0.80.16

## 0.80.15

### Patch Changes

- Updated dependencies [0d8d14e]
  - @voyantjs/bookings@0.80.15
  - @voyantjs/catalog@0.80.15
  - @voyantjs/db@0.80.15
  - @voyantjs/facilities@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/bookings@0.80.14
- @voyantjs/catalog@0.80.14
- @voyantjs/db@0.80.14
- @voyantjs/facilities@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/bookings@0.80.13
- @voyantjs/catalog@0.80.13
- @voyantjs/db@0.80.13
- @voyantjs/facilities@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/bookings@0.80.12
- @voyantjs/catalog@0.80.12
- @voyantjs/db@0.80.12
- @voyantjs/facilities@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/bookings@0.80.11
- @voyantjs/catalog@0.80.11
- @voyantjs/db@0.80.11
- @voyantjs/facilities@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/bookings@0.80.10
- @voyantjs/catalog@0.80.10
- @voyantjs/db@0.80.10
- @voyantjs/facilities@0.80.10

## 0.80.9

### Patch Changes

- Updated dependencies [37aa8b6]
  - @voyantjs/bookings@0.80.9
  - @voyantjs/catalog@0.80.9
  - @voyantjs/db@0.80.9
  - @voyantjs/facilities@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/bookings@0.80.8
- @voyantjs/catalog@0.80.8
- @voyantjs/db@0.80.8
- @voyantjs/facilities@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/bookings@0.80.7
- @voyantjs/catalog@0.80.7
- @voyantjs/db@0.80.7
- @voyantjs/facilities@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/bookings@0.80.6
- @voyantjs/catalog@0.80.6
- @voyantjs/db@0.80.6
- @voyantjs/facilities@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/bookings@0.80.5
- @voyantjs/catalog@0.80.5
- @voyantjs/db@0.80.5
- @voyantjs/facilities@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/bookings@0.80.4
- @voyantjs/catalog@0.80.4
- @voyantjs/db@0.80.4
- @voyantjs/facilities@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/bookings@0.80.3
- @voyantjs/catalog@0.80.3
- @voyantjs/db@0.80.3
- @voyantjs/facilities@0.80.3

## 0.80.2

### Patch Changes

- Updated dependencies [7a94871]
- Updated dependencies [9d6be13]
  - @voyantjs/bookings@0.80.2
  - @voyantjs/catalog@0.80.2
  - @voyantjs/db@0.80.2
  - @voyantjs/facilities@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/bookings@0.80.1
- @voyantjs/catalog@0.80.1
- @voyantjs/db@0.80.1
- @voyantjs/facilities@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/bookings@0.80.0
- @voyantjs/catalog@0.80.0
- @voyantjs/db@0.80.0
- @voyantjs/facilities@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/bookings@0.79.0
- @voyantjs/catalog@0.79.0
- @voyantjs/db@0.79.0
- @voyantjs/facilities@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/bookings@0.78.0
- @voyantjs/catalog@0.78.0
- @voyantjs/db@0.78.0
- @voyantjs/facilities@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/bookings@0.77.13
- @voyantjs/catalog@0.77.13
- @voyantjs/db@0.77.13
- @voyantjs/facilities@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/bookings@0.77.12
- @voyantjs/catalog@0.77.12
- @voyantjs/db@0.77.12
- @voyantjs/facilities@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/bookings@0.77.11
- @voyantjs/catalog@0.77.11
- @voyantjs/db@0.77.11
- @voyantjs/facilities@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/bookings@0.77.10
- @voyantjs/catalog@0.77.10
- @voyantjs/db@0.77.10
- @voyantjs/facilities@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/bookings@0.77.9
- @voyantjs/catalog@0.77.9
- @voyantjs/db@0.77.9
- @voyantjs/facilities@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/bookings@0.77.8
- @voyantjs/catalog@0.77.8
- @voyantjs/db@0.77.8
- @voyantjs/facilities@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/bookings@0.77.7
- @voyantjs/catalog@0.77.7
- @voyantjs/db@0.77.7
- @voyantjs/facilities@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/bookings@0.77.6
- @voyantjs/catalog@0.77.6
- @voyantjs/db@0.77.6
- @voyantjs/facilities@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/bookings@0.77.5
- @voyantjs/catalog@0.77.5
- @voyantjs/db@0.77.5
- @voyantjs/facilities@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/bookings@0.77.4
- @voyantjs/catalog@0.77.4
- @voyantjs/db@0.77.4
- @voyantjs/facilities@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/bookings@0.77.3
- @voyantjs/catalog@0.77.3
- @voyantjs/db@0.77.3
- @voyantjs/facilities@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/bookings@0.77.2
- @voyantjs/catalog@0.77.2
- @voyantjs/db@0.77.2
- @voyantjs/facilities@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyantjs/bookings@0.77.1
  - @voyantjs/catalog@0.77.1
  - @voyantjs/db@0.77.1
  - @voyantjs/facilities@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/bookings@0.77.0
- @voyantjs/catalog@0.77.0
- @voyantjs/db@0.77.0
- @voyantjs/facilities@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/bookings@0.76.0
- @voyantjs/catalog@0.76.0
- @voyantjs/db@0.76.0
- @voyantjs/facilities@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/bookings@0.75.7
- @voyantjs/catalog@0.75.7
- @voyantjs/db@0.75.7
- @voyantjs/facilities@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/bookings@0.75.6
- @voyantjs/catalog@0.75.6
- @voyantjs/db@0.75.6
- @voyantjs/facilities@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/bookings@0.75.5
- @voyantjs/catalog@0.75.5
- @voyantjs/db@0.75.5
- @voyantjs/facilities@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/bookings@0.75.4
- @voyantjs/catalog@0.75.4
- @voyantjs/db@0.75.4
- @voyantjs/facilities@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/bookings@0.75.3
- @voyantjs/catalog@0.75.3
- @voyantjs/db@0.75.3
- @voyantjs/facilities@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/bookings@0.75.2
- @voyantjs/catalog@0.75.2
- @voyantjs/db@0.75.2
- @voyantjs/facilities@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/bookings@0.75.1
- @voyantjs/catalog@0.75.1
- @voyantjs/db@0.75.1
- @voyantjs/facilities@0.75.1

## 0.75.0

### Patch Changes

- Updated dependencies [1eab599]
  - @voyantjs/bookings@0.75.0
  - @voyantjs/catalog@0.75.0
  - @voyantjs/db@0.75.0
  - @voyantjs/facilities@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/bookings@0.74.2
- @voyantjs/catalog@0.74.2
- @voyantjs/db@0.74.2
- @voyantjs/facilities@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/bookings@0.74.1
- @voyantjs/catalog@0.74.1
- @voyantjs/db@0.74.1
- @voyantjs/facilities@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/bookings@0.74.0
- @voyantjs/catalog@0.74.0
- @voyantjs/db@0.74.0
- @voyantjs/facilities@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/bookings@0.73.1
- @voyantjs/catalog@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/facilities@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/bookings@0.73.0
- @voyantjs/catalog@0.73.0
- @voyantjs/db@0.73.0
- @voyantjs/facilities@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/bookings@0.72.0
- @voyantjs/catalog@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/facilities@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/bookings@0.71.0
- @voyantjs/catalog@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/facilities@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/bookings@0.70.0
- @voyantjs/catalog@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/facilities@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/bookings@0.69.1
- @voyantjs/catalog@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/facilities@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/bookings@0.69.0
- @voyantjs/catalog@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/facilities@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/bookings@0.68.0
- @voyantjs/catalog@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/facilities@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/bookings@0.67.0
- @voyantjs/catalog@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/facilities@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/bookings@0.66.6
- @voyantjs/catalog@0.66.6
- @voyantjs/db@0.66.6
- @voyantjs/facilities@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyantjs/bookings@0.66.5
  - @voyantjs/catalog@0.66.5
  - @voyantjs/db@0.66.5
  - @voyantjs/facilities@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyantjs/bookings@0.66.4
  - @voyantjs/catalog@0.66.4
  - @voyantjs/db@0.66.4
  - @voyantjs/facilities@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/bookings@0.66.3
- @voyantjs/catalog@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/facilities@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/bookings@0.66.2
- @voyantjs/catalog@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/facilities@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/bookings@0.66.1
- @voyantjs/catalog@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/facilities@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/bookings@0.66.0
- @voyantjs/catalog@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/facilities@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/bookings@0.65.0
- @voyantjs/catalog@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/facilities@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/bookings@0.64.1
- @voyantjs/catalog@0.64.1
- @voyantjs/db@0.64.1
- @voyantjs/facilities@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/bookings@0.64.0
  - @voyantjs/catalog@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/facilities@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/bookings@0.63.1
- @voyantjs/catalog@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/facilities@0.63.1

## 0.63.0

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/bookings@0.63.0
  - @voyantjs/catalog@0.63.0
  - @voyantjs/db@0.63.0
  - @voyantjs/facilities@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/bookings@0.62.3
- @voyantjs/catalog@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/facilities@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/bookings@0.62.2
- @voyantjs/catalog@0.62.2
- @voyantjs/db@0.62.2
- @voyantjs/facilities@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/bookings@0.62.1
- @voyantjs/catalog@0.62.1
- @voyantjs/db@0.62.1
- @voyantjs/facilities@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyantjs/bookings@0.62.0
  - @voyantjs/catalog@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/facilities@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/bookings@0.61.0
- @voyantjs/catalog@0.61.0
- @voyantjs/db@0.61.0
- @voyantjs/facilities@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/bookings@0.60.0
- @voyantjs/catalog@0.60.0
- @voyantjs/db@0.60.0
- @voyantjs/facilities@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/bookings@0.59.0
  - @voyantjs/catalog@0.59.0
  - @voyantjs/db@0.59.0
  - @voyantjs/facilities@0.59.0

## 0.58.0

### Patch Changes

- Updated dependencies [5b21488]
  - @voyantjs/bookings@0.58.0
  - @voyantjs/catalog@0.58.0
  - @voyantjs/db@0.58.0
  - @voyantjs/facilities@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/bookings@0.57.0
- @voyantjs/catalog@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/facilities@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/bookings@0.56.0
- @voyantjs/catalog@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/facilities@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/bookings@0.55.1
  - @voyantjs/catalog@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/facilities@0.55.1

## 0.55.0

### Minor Changes

- f0c2a6d: Add the accommodation resale package and retire the legacy hospitality package family.

  Accommodation inventory remains available as catalog resale content for OTAs, DMCs, and tour operators, while first-party hotel-managed operations surfaces are removed from the active package, template, and UI registry surfaces. Consumers should use `@voyantjs/accommodations` for lodging catalog and stay booking-line integrations instead of the removed `@voyantjs/hospitality`, `@voyantjs/hospitality-react`, and `@voyantjs/hospitality-ui` package family.

### Patch Changes

- @voyantjs/bookings@0.55.0
- @voyantjs/catalog@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/facilities@0.55.0
