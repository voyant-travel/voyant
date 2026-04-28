# @voyantjs/customer-portal-react

## 0.14.0

### Patch Changes

- @voyantjs/customer-portal@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/customer-portal@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/customer-portal@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/customer-portal@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/customer-portal@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/customer-portal@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/customer-portal@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/customer-portal@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- 7619ef0: Continue the traveler-first booking contract cleanup across the published booking surfaces while preserving compatibility aliases.

  - `@voyantjs/bookings`: add traveler-first public aliases for booking travel details, group traveler routes, public booking-session traveler input, and traveler-facing validation/error wording while keeping legacy participant/passenger compatibility routes and schemas.
  - `@voyantjs/bookings-react`: make traveler hooks, query options, schemas, and exports the primary surface again; keep passenger/item-participant names as compatibility aliases instead of separate primaries.
  - `@voyantjs/customer-portal` and `@voyantjs/customer-portal-react`: move booking import schemas, operations, and exports to traveler-first names while preserving legacy participant aliases and routes.
  - `@voyantjs/transactions`: expose traveler-first request/response aliases and traveler route aliases for offer/order traveler and item-traveler flows while preserving legacy participant compatibility endpoints.
  - `@voyantjs/auth-react`: add exported query keys, query options, and schemas for current workspace, organization members, and organization invitations so app surfaces can consume the auth workspace contract directly.
  - `@voyantjs/products` and `@voyantjs/products-react`: tighten the itinerary-facing public surface and query/schema exports used by the shared product itinerary UI.
  - `@voyantjs/legal` and `@voyantjs/notifications`: keep template authoring and Liquid exports available from the package roots while aligning the notification/template surface with the updated booking traveler contract.
  - Supporting packages and tests also picked up repo-wide import-order, lint, and small compatibility cleanups across auth, booking requirements, checkout, octo, pricing, sellability, storefront, and utilities as part of bringing the whole worktree back to a green release state.
  - Align the touched app/template compatibility wrappers with the new primary traveler and workspace surfaces, and keep repo `typecheck` / `lint` green after the broader cleanup.

- Updated dependencies [7619ef0]
  - @voyantjs/customer-portal@0.6.9
  - @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- @voyantjs/customer-portal@0.6.8
- @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/customer-portal@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/customer-portal@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/customer-portal@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/customer-portal@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/customer-portal@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/customer-portal@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/customer-portal@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/customer-portal@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/customer-portal@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/customer-portal@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/customer-portal@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/customer-portal@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/customer-portal@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [c3f3ccf]
  - @voyantjs/customer-portal@0.4.1
  - @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Expose booking billing contact through customer-portal booking detail and a
  dedicated public route, with React query helpers for storefront payment and
  remainder flows.
- e84fe0f: Add `productTitle` and native `paymentStatus` to public customer-portal
  booking summaries so storefront account lists can render booking rows without
  separate booking-detail and finance hydration calls.
- e84fe0f: Promote public companion traveler identity fields into the shared
  customer-portal contract with first-class `typeKey` and typed person, address,
  and document shapes instead of forcing apps to read and write those values only
  through untyped companion metadata.
- e84fe0f: Add a first-class customer-portal action to import accessible booking
  participants into companions with duplicate detection, plus matching React
  operations and mutation support.
- e84fe0f: Enrich the public customer-portal profile with middle name, top-level
  date-of-birth/address fields, consent provenance/source, and encrypted travel
  document reads/writes backed by `user_profiles.documentsEncrypted`.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/customer-portal@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Advance the public storefront surface with phone contact-exists support in the
  customer portal, default-template and preview helpers in legal, localized slug
  and SEO catalog fields in products, and a new config-backed storefront settings
  module for booking/account pages.
- Updated dependencies [8566f2d]
  - @voyantjs/customer-portal@0.3.1
  - @voyantjs/react@0.3.1
