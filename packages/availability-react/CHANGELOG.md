# @voyantjs/availability-react

## 0.27.0

### Patch Changes

- @voyantjs/availability@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/availability@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/availability@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/availability@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/availability@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/availability@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/availability@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/availability@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/availability@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/availability@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/availability@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/availability@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/availability@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/availability@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/availability@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/availability@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/availability@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/availability@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/availability@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/availability@0.21.0
- @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/availability@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/availability@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/availability@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- @voyantjs/availability@0.17.0
- @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/availability@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/availability@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/availability@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/availability@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/availability@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/availability@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/availability@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/availability@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/availability@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/availability@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/availability@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/availability@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/availability@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/availability@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/availability@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/availability@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/availability@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/availability@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/availability@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/availability@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Enrich availability list responses with product names via LEFT JOIN

  Availability list endpoints (rules, start-times, slots, closeouts, pickup-points, meeting-configs) now return `productName` alongside the raw `productId`, resolved via a LEFT JOIN against a minimal products table reference. Operator UIs no longer need a secondary product lookup query just to render display labels. The `productNameById` utility in `@voyantjs/availability-react` now accepts the server-provided name as a third argument and falls back to the client-side lookup.

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/availability@0.5.0
  - @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/availability@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/availability@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/availability@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/availability@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/availability@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- @voyantjs/availability@0.4.0
- @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/availability@0.3.1
- @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/availability@0.3.0
  - @voyantjs/react@0.3.0
