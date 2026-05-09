# @voyantjs/storefront

## 0.29.0

### Patch Changes

- 3420711: Fix #501: cross-package schema init cycle that caused chunk-splitting bundlers (Vite 8 / Rolldown) to crash with `Cannot read properties of undefined (reading 'optional')` at module-evaluation time.

  Root cause: schema files in 4 packages dereferenced a Zod schema imported from another `@voyantjs/*` package at module top level. When the bundler placed the producer (`kmsEnvelopeSchema` from `@voyantjs/db`, `availabilitySlotStatusSchema` from `@voyantjs/availability`, `extraPricingModeSchema` from `@voyantjs/extras`) into a different chunk than the consumer, ESM live-binding init order didn't guarantee producer-before-consumer evaluation — the consumer hit the producer's TDZ and threw.

  Fix: wrap every cross-package top-level schema reference with `z.lazy(() => Schema)` so the schema is dereferenced at first parse rather than at module evaluation. This is the smallest change per the issue's suggested fixes (Option 1) and protects against the same hazard in any future bundler chunking.

  Sites updated:

  - `@voyantjs/bookings/schema/travel-details` — 3 `kmsEnvelopeSchema` fields (`identityEncrypted`, `dietaryEncrypted`, `accessibilityEncrypted`)
  - `@voyantjs/crm/validation` — 5 `kmsEnvelopeSchema` fields (`accessibilityEncrypted`, `dietaryEncrypted`, `loyaltyEncrypted`, `insuranceEncrypted`, `numberEncrypted` on personDocuments)
  - `@voyantjs/transactions/schema/participant-identity` — 1 `kmsEnvelopeSchema` field (`identityEncrypted`)
  - `@voyantjs/storefront/validation` — `availabilitySlotStatusSchema` + `extraPricingModeSchema` on the storefront departure / extension schemas

  Behavior unchanged: `z.lazy(fn).optional().nullable()` parses identically to `Schema.optional().nullable()` for valid and invalid payloads. Regression test in `packages/bookings/tests/unit/travel-details-schema.test.ts` asserts both the happy path (valid envelope round-trips) and the error path (empty `enc` violates the producer's `min(1)` validation) continue to work through the lazy wrap.

  No schema migration required, no behavior change for consumers — purely a build-time / module-init shape fix.

- Updated dependencies [828fee4]
- Updated dependencies [61673e1]
- Updated dependencies [11443d3]
- Updated dependencies [828fee4]
- Updated dependencies [06c2cf1]
- Updated dependencies [143f45c]
- Updated dependencies [2baf762]
- Updated dependencies [da3b6fd]
- Updated dependencies [583326e]
- Updated dependencies [db51715]
  - @voyantjs/availability@0.29.0
  - @voyantjs/core@0.29.0
  - @voyantjs/extras@0.29.0
  - @voyantjs/hono@0.29.0
  - @voyantjs/pricing@0.29.0
  - @voyantjs/products@0.29.0
  - @voyantjs/sellability@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
  - @voyantjs/availability@0.28.3
  - @voyantjs/core@0.28.3
  - @voyantjs/extras@0.28.3
  - @voyantjs/hono@0.28.3
  - @voyantjs/pricing@0.28.3
  - @voyantjs/products@0.28.3
  - @voyantjs/sellability@0.28.3

## 0.28.2

### Patch Changes

- Updated dependencies [4549ebc]
  - @voyantjs/availability@0.28.2
  - @voyantjs/core@0.28.2
  - @voyantjs/extras@0.28.2
  - @voyantjs/hono@0.28.2
  - @voyantjs/pricing@0.28.2
  - @voyantjs/products@0.28.2
  - @voyantjs/sellability@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/availability@0.28.1
- @voyantjs/core@0.28.1
- @voyantjs/extras@0.28.1
- @voyantjs/hono@0.28.1
- @voyantjs/pricing@0.28.1
- @voyantjs/products@0.28.1
- @voyantjs/sellability@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [b72948d]
  - @voyantjs/availability@0.28.0
  - @voyantjs/core@0.28.0
  - @voyantjs/extras@0.28.0
  - @voyantjs/hono@0.28.0
  - @voyantjs/pricing@0.28.0
  - @voyantjs/products@0.28.0
  - @voyantjs/sellability@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/availability@0.27.0
  - @voyantjs/core@0.27.0
  - @voyantjs/extras@0.27.0
  - @voyantjs/hono@0.27.0
  - @voyantjs/pricing@0.27.0
  - @voyantjs/products@0.27.0
  - @voyantjs/sellability@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/availability@0.26.9
  - @voyantjs/core@0.26.9
  - @voyantjs/extras@0.26.9
  - @voyantjs/hono@0.26.9
  - @voyantjs/pricing@0.26.9
  - @voyantjs/products@0.26.9
  - @voyantjs/sellability@0.26.9

## 0.26.8

### Patch Changes

- Updated dependencies [abc9aa0]
  - @voyantjs/availability@0.26.8
  - @voyantjs/core@0.26.8
  - @voyantjs/extras@0.26.8
  - @voyantjs/hono@0.26.8
  - @voyantjs/pricing@0.26.8
  - @voyantjs/products@0.26.8
  - @voyantjs/sellability@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/availability@0.26.7
- @voyantjs/core@0.26.7
- @voyantjs/extras@0.26.7
- @voyantjs/hono@0.26.7
- @voyantjs/pricing@0.26.7
- @voyantjs/products@0.26.7
- @voyantjs/sellability@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/availability@0.26.6
- @voyantjs/core@0.26.6
- @voyantjs/extras@0.26.6
- @voyantjs/hono@0.26.6
- @voyantjs/pricing@0.26.6
- @voyantjs/products@0.26.6
- @voyantjs/sellability@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/availability@0.26.5
- @voyantjs/core@0.26.5
- @voyantjs/extras@0.26.5
- @voyantjs/hono@0.26.5
- @voyantjs/pricing@0.26.5
- @voyantjs/products@0.26.5
- @voyantjs/sellability@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/availability@0.26.4
- @voyantjs/core@0.26.4
- @voyantjs/extras@0.26.4
- @voyantjs/hono@0.26.4
- @voyantjs/pricing@0.26.4
- @voyantjs/products@0.26.4
- @voyantjs/sellability@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/availability@0.26.3
- @voyantjs/core@0.26.3
- @voyantjs/extras@0.26.3
- @voyantjs/hono@0.26.3
- @voyantjs/pricing@0.26.3
- @voyantjs/products@0.26.3
- @voyantjs/sellability@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/availability@0.26.2
- @voyantjs/core@0.26.2
- @voyantjs/extras@0.26.2
- @voyantjs/hono@0.26.2
- @voyantjs/pricing@0.26.2
- @voyantjs/products@0.26.2
- @voyantjs/sellability@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/availability@0.26.1
- @voyantjs/core@0.26.1
- @voyantjs/extras@0.26.1
- @voyantjs/hono@0.26.1
- @voyantjs/pricing@0.26.1
- @voyantjs/products@0.26.1
- @voyantjs/sellability@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/availability@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/extras@0.26.0
- @voyantjs/hono@0.26.0
- @voyantjs/pricing@0.26.0
- @voyantjs/products@0.26.0
- @voyantjs/sellability@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/availability@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/extras@0.25.0
- @voyantjs/hono@0.25.0
- @voyantjs/pricing@0.25.0
- @voyantjs/products@0.25.0
- @voyantjs/sellability@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/availability@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/extras@0.24.3
- @voyantjs/hono@0.24.3
- @voyantjs/pricing@0.24.3
- @voyantjs/products@0.24.3
- @voyantjs/sellability@0.24.3

## 0.24.2

### Patch Changes

- bec0471: Republish packages whose 0.24.1 tarballs omitted built `dist` artifacts while their runtime exports pointed at `dist`.
  - @voyantjs/availability@0.24.2
  - @voyantjs/core@0.24.2
  - @voyantjs/extras@0.24.2
  - @voyantjs/hono@0.24.2
  - @voyantjs/pricing@0.24.2
  - @voyantjs/products@0.24.2
  - @voyantjs/sellability@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/availability@0.24.1
- @voyantjs/core@0.24.1
- @voyantjs/extras@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/pricing@0.24.1
- @voyantjs/products@0.24.1
- @voyantjs/sellability@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/availability@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/extras@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/pricing@0.24.0
- @voyantjs/products@0.24.0
- @voyantjs/sellability@0.24.0

## 0.23.0

### Minor Changes

- d177a55: Add request-aware storefront settings and offer resolution, a public product availability summary endpoint, itinerary day extension components for products UI, and an explicit open slots metric for availability overview surfaces.

### Patch Changes

- @voyantjs/availability@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/extras@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/pricing@0.23.0
- @voyantjs/products@0.23.0
- @voyantjs/sellability@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/availability@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/extras@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/pricing@0.22.0
- @voyantjs/products@0.22.0
- @voyantjs/sellability@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/availability@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/extras@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/pricing@0.21.1
- @voyantjs/products@0.21.1
- @voyantjs/sellability@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/availability@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/extras@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/pricing@0.21.0
  - @voyantjs/products@0.21.0
  - @voyantjs/sellability@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/availability@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/extras@0.20.0
- @voyantjs/hono@0.20.0
- @voyantjs/pricing@0.20.0
- @voyantjs/products@0.20.0
- @voyantjs/sellability@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/availability@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/extras@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/pricing@0.19.0
  - @voyantjs/products@0.19.0
  - @voyantjs/sellability@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/availability@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/extras@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/pricing@0.18.0
  - @voyantjs/products@0.18.0
  - @voyantjs/sellability@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/availability@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/extras@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/pricing@0.17.0
  - @voyantjs/products@0.17.0
  - @voyantjs/sellability@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [a4bc773]
  - @voyantjs/availability@0.16.0
  - @voyantjs/core@0.16.0
  - @voyantjs/extras@0.16.0
  - @voyantjs/hono@0.16.0
  - @voyantjs/pricing@0.16.0
  - @voyantjs/products@0.16.0
  - @voyantjs/sellability@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/availability@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/extras@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/pricing@0.15.0
- @voyantjs/products@0.15.0
- @voyantjs/sellability@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/availability@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/extras@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/pricing@0.14.0
- @voyantjs/products@0.14.0
- @voyantjs/sellability@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/availability@0.13.0
- @voyantjs/core@0.13.0
- @voyantjs/extras@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/pricing@0.13.0
- @voyantjs/products@0.13.0
- @voyantjs/sellability@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/availability@0.12.0
- @voyantjs/core@0.12.0
- @voyantjs/extras@0.12.0
- @voyantjs/hono@0.12.0
- @voyantjs/pricing@0.12.0
- @voyantjs/products@0.12.0
- @voyantjs/sellability@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/availability@0.11.0
- @voyantjs/core@0.11.0
- @voyantjs/extras@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/pricing@0.11.0
- @voyantjs/products@0.11.0
- @voyantjs/sellability@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/availability@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/extras@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/pricing@0.10.0
  - @voyantjs/products@0.10.0
  - @voyantjs/sellability@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/availability@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/extras@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/pricing@0.9.0
- @voyantjs/products@0.9.0
- @voyantjs/sellability@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/availability@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/extras@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/pricing@0.8.0
- @voyantjs/products@0.8.0
- @voyantjs/sellability@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/availability@0.7.0
- @voyantjs/core@0.7.0
- @voyantjs/extras@0.7.0
- @voyantjs/hono@0.7.0
- @voyantjs/pricing@0.7.0
- @voyantjs/products@0.7.0
- @voyantjs/sellability@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/availability@0.6.9
- @voyantjs/core@0.6.9
- @voyantjs/extras@0.6.9
- @voyantjs/hono@0.6.9
- @voyantjs/pricing@0.6.9
- @voyantjs/products@0.6.9
- @voyantjs/sellability@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/availability@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/extras@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/pricing@0.6.8
  - @voyantjs/products@0.6.8
  - @voyantjs/sellability@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/availability@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/extras@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/pricing@0.6.7
- @voyantjs/products@0.6.7
- @voyantjs/sellability@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/availability@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/extras@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/pricing@0.6.6
- @voyantjs/products@0.6.6
- @voyantjs/sellability@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/availability@0.6.5
- @voyantjs/core@0.6.5
- @voyantjs/extras@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/pricing@0.6.5
- @voyantjs/products@0.6.5
- @voyantjs/sellability@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/availability@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/extras@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/pricing@0.6.4
- @voyantjs/products@0.6.4
- @voyantjs/sellability@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/availability@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/extras@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/pricing@0.6.3
  - @voyantjs/products@0.6.3
  - @voyantjs/sellability@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/availability@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/extras@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/pricing@0.6.2
- @voyantjs/products@0.6.2
- @voyantjs/sellability@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [00587db]
  - @voyantjs/availability@0.6.1
  - @voyantjs/core@0.6.1
  - @voyantjs/extras@0.6.1
  - @voyantjs/hono@0.6.1
  - @voyantjs/pricing@0.6.1
  - @voyantjs/products@0.6.1
  - @voyantjs/sellability@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/availability@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/extras@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/pricing@0.6.0
- @voyantjs/products@0.6.0
- @voyantjs/sellability@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/availability@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/extras@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/pricing@0.5.0
  - @voyantjs/products@0.5.0
  - @voyantjs/sellability@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/availability@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/extras@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/pricing@0.4.5
  - @voyantjs/products@0.4.5
  - @voyantjs/sellability@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/availability@0.4.4
- @voyantjs/core@0.4.4
- @voyantjs/extras@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/pricing@0.4.4
- @voyantjs/products@0.4.4
- @voyantjs/sellability@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/availability@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/extras@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/pricing@0.4.3
- @voyantjs/products@0.4.3
- @voyantjs/sellability@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/availability@0.4.2
- @voyantjs/core@0.4.2
- @voyantjs/extras@0.4.2
- @voyantjs/hono@0.4.2
- @voyantjs/pricing@0.4.2
- @voyantjs/products@0.4.2
- @voyantjs/sellability@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/availability@0.4.1
- @voyantjs/core@0.4.1
- @voyantjs/extras@0.4.1
- @voyantjs/hono@0.4.1
- @voyantjs/pricing@0.4.1
- @voyantjs/products@0.4.1
- @voyantjs/sellability@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add first-class public storefront routes for product departure list/detail, departure price preview, product extensions, and departure itinerary, plus pluggable promotional-offer routes backed by injected resolvers, with typed schemas exported from the package root.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/availability@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/extras@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/pricing@0.4.0
  - @voyantjs/products@0.4.0
  - @voyantjs/sellability@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Advance the public storefront surface with phone contact-exists support in the
  customer portal, default-template and preview helpers in legal, localized slug
  and SEO catalog fields in products, and a new config-backed storefront settings
  module for booking/account pages.
  - @voyantjs/core@0.3.1
  - @voyantjs/hono@0.3.1
