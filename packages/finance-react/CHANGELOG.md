# @voyantjs/finance-react

## 0.14.0

### Patch Changes

- @voyantjs/finance@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/finance@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/finance@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/finance@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
  - @voyantjs/finance@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/finance@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/finance@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/finance@0.7.0
  - @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/finance@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/finance@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/finance@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/finance@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/finance@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/finance@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/finance@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/finance@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/finance@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/finance@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers`, `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

### Patch Changes

- @voyantjs/finance@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/finance@0.4.5
  - @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/finance@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/finance@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/finance@0.4.2
  - @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- a49630a: Extend the public finance surface with customer-safe document lookup by reference
  and add typed organization member/invitation exports in `@voyantjs/auth-react`
  for shared team-management UIs.
- Updated dependencies [a49630a]
  - @voyantjs/finance@0.4.1
  - @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add a public booking payment-history route and matching React helpers so
  storefronts can read booking-scoped payments with invoice context from
  `/v1/public/finance/bookings/:bookingId/payments`.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/finance@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add a booking-scoped public finance document surface for invoice and proforma
  downloads.

  `@voyantjs/finance` now exposes a public booking documents route that returns
  customer-safe invoice and proforma document metadata, including the best
  available rendition status and download URL when a ready rendition has a public
  or signed URL. `@voyantjs/finance-react` now exposes matching schemas, query
  keys, query options, operations, and a `usePublicBookingDocuments` hook.

- 8566f2d: Republish the public storefront package surfaces so published tarballs match the
  current source tree. This release restores the public finance schemas needed by
  `@voyantjs/finance-react`, publishes the public booking and product service
  exports already present in source, and ships the day/version/media product React
  exports from the package root.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/finance@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/finance@0.3.0
  - @voyantjs/react@0.3.0
