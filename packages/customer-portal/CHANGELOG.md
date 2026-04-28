# @voyantjs/customer-portal

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/crm@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/finance@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/identity@0.14.0
- @voyantjs/legal@0.14.0
- @voyantjs/utils@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/crm@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/finance@0.13.0
  - @voyantjs/hono@0.13.0
  - @voyantjs/identity@0.13.0
  - @voyantjs/legal@0.13.0
  - @voyantjs/utils@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/crm@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/finance@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/identity@0.12.0
  - @voyantjs/legal@0.12.0
  - @voyantjs/utils@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/crm@0.11.0
  - @voyantjs/db@0.11.0
  - @voyantjs/finance@0.11.0
  - @voyantjs/hono@0.11.0
  - @voyantjs/identity@0.11.0
  - @voyantjs/legal@0.11.0
  - @voyantjs/utils@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
- Updated dependencies [29a581a]
  - @voyantjs/bookings@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/crm@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/identity@0.10.0
  - @voyantjs/legal@0.10.0
  - @voyantjs/utils@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/crm@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/identity@0.9.0
- @voyantjs/legal@0.9.0
- @voyantjs/utils@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/bookings@0.8.0
  - @voyantjs/core@0.8.0
  - @voyantjs/crm@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/finance@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/identity@0.8.0
  - @voyantjs/legal@0.8.0
  - @voyantjs/utils@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/crm@0.7.0
  - @voyantjs/db@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/identity@0.7.0
  - @voyantjs/legal@0.7.0
  - @voyantjs/utils@0.7.0

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
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/crm@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/finance@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/identity@0.6.9
  - @voyantjs/legal@0.6.9
  - @voyantjs/utils@0.6.9

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
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/crm@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/identity@0.6.8
  - @voyantjs/legal@0.6.8
  - @voyantjs/utils@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/crm@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/identity@0.6.7
- @voyantjs/legal@0.6.7
- @voyantjs/utils@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/crm@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/identity@0.6.6
- @voyantjs/legal@0.6.6
- @voyantjs/utils@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/crm@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/finance@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/identity@0.6.5
  - @voyantjs/legal@0.6.5
  - @voyantjs/utils@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/crm@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/identity@0.6.4
- @voyantjs/legal@0.6.4
- @voyantjs/utils@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/crm@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/identity@0.6.3
  - @voyantjs/legal@0.6.3
  - @voyantjs/utils@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/crm@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/identity@0.6.2
- @voyantjs/legal@0.6.2
- @voyantjs/utils@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/crm@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/identity@0.6.1
- @voyantjs/legal@0.6.1
- @voyantjs/utils@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/crm@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/identity@0.6.0
- @voyantjs/legal@0.6.0
- @voyantjs/utils@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/crm@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/finance@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/identity@0.5.0
  - @voyantjs/legal@0.5.0
  - @voyantjs/utils@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/crm@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/identity@0.4.5
  - @voyantjs/legal@0.4.5
  - @voyantjs/utils@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/bookings@0.4.4
- @voyantjs/core@0.4.4
- @voyantjs/crm@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/finance@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/identity@0.4.4
- @voyantjs/legal@0.4.4
- @voyantjs/utils@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/crm@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/finance@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/identity@0.4.3
- @voyantjs/legal@0.4.3
- @voyantjs/utils@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/bookings@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/crm@0.4.2
  - @voyantjs/db@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/identity@0.4.2
  - @voyantjs/legal@0.4.2
  - @voyantjs/utils@0.4.2

## 0.4.1

### Patch Changes

- c3f3ccf: Stop importing the deep `@voyantjs/db/schema/iam/kms` subpath from the published customer portal bundle and use the stable `@voyantjs/db/schema/iam` entrypoint instead. This avoids downstream SSR bundler alias workarounds in setups like Astro/Vite under pnpm.
- Updated dependencies [4c4ea3c]
- Updated dependencies [a49630a]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/crm@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/finance@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/identity@0.4.1
  - @voyantjs/legal@0.4.1
  - @voyantjs/utils@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Expose booking billing contact through customer-portal booking detail and a
  dedicated public route, with React query helpers for storefront payment and
  remainder flows.
- e84fe0f: Expand customer-portal booking document coverage.

  - include booking-linked contract attachments in
    `/v1/public/customer-portal/bookings/:bookingId/documents` when they have a
    customer-safe download URL
  - include booking-linked invoice and proforma renditions in that same document
    list when a customer-safe download URL exists
  - add a `source` discriminator plus `mimeType` and `reference` fields to the
    customer-portal booking document schema

- e84fe0f: Add `productTitle` and native `paymentStatus` to public customer-portal
  booking summaries so storefront account lists can render booking rows without
  separate booking-detail and finance hydration calls.
- e84fe0f: Promote public companion traveler identity fields into the shared
  customer-portal contract with first-class `typeKey` and typed person, address,
  and document shapes instead of forcing apps to read and write those values only
  through untyped companion metadata.
- e84fe0f: Add a first-class customer-portal action to import accessible booking
  travelers into companions with duplicate detection, plus matching React
  operations and mutation support.
- e84fe0f: Expand the public customer-portal contract with booking financial history and a
  first-class billing-address object on customer records.

  Changes:

  - add `financials.documents` and `financials.payments` to public booking detail
  - include booking-linked invoice/proforma summaries and payment history in the
    booking detail route
  - expose `customerRecord.billingAddress` on public profile/bootstrap payloads
  - support updating the linked customer billing address through the public
    profile update and bootstrap flows

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
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/crm@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/identity@0.4.0
  - @voyantjs/legal@0.4.0
  - @voyantjs/utils@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Advance the public storefront surface with phone contact-exists support in the
  customer portal, default-template and preview helpers in legal, localized slug
  and SEO catalog fields in products, and a new config-backed storefront settings
  module for booking/account pages.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/crm@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/identity@0.3.1
