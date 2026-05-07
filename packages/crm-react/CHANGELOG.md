# @voyantjs/crm-react

## 0.26.9

### Patch Changes

- @voyantjs/crm@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/crm@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/crm@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/crm@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/crm@0.26.5
  - @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- 6493f62: Add `customer_signals` table for the pre-pipeline interest surface (closes #444).

  Customer signals are the lighter-than-opportunities, heavier-than-segments space — wishlist entries, "notify when this departure opens", inquiry calls captured by an operator, abandoned-cart recovery, request-offer leads. The new `crm.customer_signals` table records:

  - `kind` — `wishlist | notify | inquiry | request_offer | referral`.
  - `source` — `form | phone | admin | abandoned_cart | website | booking`.
  - `status` — `new | contacted | qualified | converted | lost | expired`, default `new`.
  - `priority` (text, validation-layer enum `low | normal | high | urgent`), `notes`, `tags`, `assignedToUserId`, `followUpAt`, `sourceSubmissionId`, `metadata`.
  - `productId`, `optionUnitId`, `resolvedBookingId` as plain `text()` columns — cross-module references stay loose per the project FK rule.

  API:

  - `crmService.listCustomerSignals(db, { personId?, assignedToUserId?, status?, kind?, productId?, search? })` paginated.
  - `crmService.listSignalsForPerson(db, personId)` chronological convenience.
  - CRUD + `crmService.resolveCustomerSignalToBooking(db, signalId, bookingId)` which marks the signal `converted` and pins the bookingId.
  - Admin routes: `GET/POST /v1/admin/crm/customer-signals`, `GET/PATCH/DELETE /v1/admin/crm/customer-signals/:id`, `POST /v1/admin/crm/customer-signals/:id/resolve`, `GET /v1/admin/crm/people/:id/signals`.
  - React hooks: `useCustomerSignals(filters)`, `useCustomerSignalsForPerson(personId)`, `useCustomerSignal(id)`, `useCustomerSignalMutation()` returning `{ create, update, remove, resolve }`.

  Migration: `templates/operator/migrations/0027_customer_signals.sql`, registered in `meta/_journal.json`.

  Out of scope (deferred): full "create booking from signal" orchestration UI; auto-expiry cron that sweeps stale signals to `expired`. The data layer supports both.

- Updated dependencies [6493f62]
  - @voyantjs/crm@0.26.4
  - @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- 372cad5: Add person-to-person relationships table for kinship, emergency contacts, and travel companions (closes #442).

  New `crm.person_relationships` table records directed `fromPerson → toPerson` edges of one of eleven kinds (`spouse`, `partner`, `parent`, `child`, `sibling`, `guardian`, `ward`, `emergency_contact`, `friend`, `travel_companion`, `other`). The optional `inverseKind` lets the service auto-write the symmetric edge in the same transaction (parent↔child, guardian↔ward, etc.) so operator UIs don't have to maintain both sides; the auto-inverse path is idempotent on retry. `(from_person_id, to_person_id, kind)` is uniquely indexed and a CHECK constraint rejects self-edges. Migration: `templates/operator/migrations/0026_person_relationships.sql` (registered in `meta/_journal.json`).

  API surface:

  - `crmService.listPersonRelationships(db, personId, { direction?: "from" | "to" | "both" })` — defaults to `both` so the typical "Jane's family" view returns the union.
  - `crmService.createPersonRelationship(db, fromPersonId, { toPersonId, kind, inverseKind?, autoInverse? })`
  - `crmService.getPersonRelationship` / `updatePersonRelationship` / `deletePersonRelationship`
  - Admin routes: `GET/POST /v1/admin/crm/people/:id/relationships`, `GET/PATCH/DELETE /v1/admin/crm/person-relationships/:id`.
  - React hooks: `usePersonRelationships(personId, { direction, kind })`, `usePersonRelationshipMutation(personId)` returning `{ create, update, remove }`.

  Out of scope (deferred): UI components for the relationship graph; phone-keyed emergency-contact convenience helpers (use `metadata` for now). The data layer is ready for both.

- Updated dependencies [372cad5]
  - @voyantjs/crm@0.26.3
  - @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/crm@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- c0507a6: Move toxic PII to `crm.people` and add structured `person_documents` (closes #440 and #443).

  `user_profiles` is no longer the home for encrypted PII. The four free-text slots (accessibility / dietary / loyalty / insurance) move to `crm.people` so operator-managed humans without auth accounts can carry them, and identity documents graduate to a structured `person_documents` table with type / expiry / issuing authority / attachment + a partial unique index pinning a single primary doc per type per person.

  Booking travelers now snapshot dietary, accessibility, and the primary passport from the linked person record at create time (snapshot-on-create, explicit input always wins) via a new `POST /v1/admin/bookings/:id/travelers/with-travel-details` route. Templates wire the snapshot via `createBookingsHonoModule({ resolveTravelSnapshot })` delegating to `crmService.loadPersonTravelSnapshot` — bookings stays free of any direct CRM dependency.

  Customer portal exposes plaintext `accessibility/dietary/loyalty/insurance` on `/me` plus full CRUD over `/me/documents`. CRM admin gains server-side encrypt/decrypt endpoints (`travel-snapshot`, `profile-pii`, `*/from-plaintext`) so the operator booking-traveler dialog can pre-fill from profile and push diverging values back without the browser holding KMS material. The dialog itself now ships a "Travel details" section with passport / dietary / accessibility fields, plus "Pre-fill from profile" and "Save to profile" affordances when a CRM person is linked.

  Breaking changes (intentionally landed pre-1.0):

  - `user_profiles.documentsEncrypted/accessibilityEncrypted/dietaryEncrypted/loyaltyEncrypted/insuranceEncrypted` columns are removed. Migration ships `templates/operator/migrations/0024_people_pii_documents.sql`.
  - `customerPortalProfileSchema.documents` (array) replaced with separate `accessibility/dietary/loyalty/insurance` plaintext string fields. Document CRUD lives at `/v1/public/customer-portal/me/documents`.
  - `bookingsHonoModule` and `crmHonoModule` are still exported but the env-driven default factory `createBookingsHonoModule()` / `createCrmHonoModule()` is the new recommended entry point.

- Updated dependencies [c0507a6]
  - @voyantjs/crm@0.26.1
  - @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/crm@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/crm@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/crm@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/crm@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/crm@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/crm@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/crm@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/crm@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/crm@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/crm@0.21.0
- @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/crm@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/crm@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/crm@0.18.0
  - @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- @voyantjs/crm@0.17.0
- @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/crm@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/crm@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/crm@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/crm@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/crm@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/crm@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/crm@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/crm@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/crm@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/crm@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/crm@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/crm@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/crm@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/crm@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/crm@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/crm@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/crm@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/crm@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/crm@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/crm@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/crm@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/crm@0.4.5
  - @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/crm@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/crm@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/crm@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/crm@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- @voyantjs/crm@0.4.0
- @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/crm@0.3.1
- @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- e57725d: Flatten frontend provider wiring around a shared `@voyantjs/react` config provider so module react packages can share one app-level Voyant context.
- Updated dependencies [e57725d]
  - @voyantjs/crm@0.3.0
  - @voyantjs/react@0.3.0

## 0.2.0

### Minor Changes

- 8d16e77: Introduce `@voyantjs/crm-react` as the publishable CRM React runtime package and update first-party starters to consume it instead of the private Voyant UI registry workspace.

### Patch Changes

- @voyantjs/crm@0.2.0
