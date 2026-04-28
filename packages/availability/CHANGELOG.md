# @voyantjs/availability

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/core@0.13.0
- @voyantjs/db@0.13.0
- @voyantjs/hono@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/core@0.11.0
- @voyantjs/db@0.11.0
- @voyantjs/hono@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/core@0.8.0
- @voyantjs/db@0.8.0
- @voyantjs/hono@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/core@0.7.0
- @voyantjs/db@0.7.0
- @voyantjs/hono@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/core@0.6.9
- @voyantjs/db@0.6.9
- @voyantjs/hono@0.6.9

## 0.6.8

### Patch Changes

- b218885: Add global created-time and sort indexes for pickup administration lists that
  can paginate without a parent filter.
- b218885: Add composite list indexes for availability and pickup queries.
- Updated dependencies [b218885]
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/hono@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/core@0.6.5
- @voyantjs/db@0.6.5
- @voyantjs/hono@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/hono@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Enrich availability list responses with product names via LEFT JOIN

  Availability list endpoints (rules, start-times, slots, closeouts, pickup-points, meeting-configs) now return `productName` alongside the raw `productId`, resolved via a LEFT JOIN against a minimal products table reference. Operator UIs no longer need a secondary product lookup query just to render display labels. The `productNameById` utility in `@voyantjs/availability-react` now accepts the server-provided name as a third argument and falls back to the client-side lookup.

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/hono@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/core@0.4.1
- @voyantjs/db@0.4.1
- @voyantjs/hono@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1
