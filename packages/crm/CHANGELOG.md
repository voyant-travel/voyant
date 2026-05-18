# @voyantjs/crm

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/hono@0.52.3
  - @voyantjs/identity@0.52.3
  - @voyantjs/utils@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Expand the CRM person form and detail surface.

  - `PersonForm` gains addresses and relationships subforms with full add/remove/edit affordances; `OrganizationForm` picks up the same address widgets.
  - New exported sections `PersonAddressesSection` and `PersonRelationshipsSection` so the person detail page can render addresses/relationships outside the edit form (e.g. on the read-only detail view).
  - i18n strings for the new sections (EN + RO).
  - `@voyantjs/crm` service/validation: rename the legacy `birthday` field to `dateOfBirth` to match the rest of identity; migrations `0028_rename_birthday.sql` (dev), `0010_rename_birthday.sql` (dmc), and `0018_rename_birthday.sql` (operator) handle the column rename.
  - Document-attach service tightens its validation around the renamed field.
  - @voyantjs/core@0.52.2
  - @voyantjs/db@0.52.2
  - @voyantjs/hono@0.52.2
  - @voyantjs/identity@0.52.2
  - @voyantjs/utils@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/core@0.52.1
- @voyantjs/db@0.52.1
- @voyantjs/hono@0.52.1
- @voyantjs/identity@0.52.1
- @voyantjs/utils@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/core@0.52.0
- @voyantjs/db@0.52.0
- @voyantjs/hono@0.52.0
- @voyantjs/identity@0.52.0
- @voyantjs/utils@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/core@0.51.1
- @voyantjs/db@0.51.1
- @voyantjs/hono@0.51.1
- @voyantjs/identity@0.51.1
- @voyantjs/utils@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/core@0.51.0
- @voyantjs/db@0.51.0
- @voyantjs/hono@0.51.0
- @voyantjs/identity@0.51.0
- @voyantjs/utils@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/core@0.50.8
- @voyantjs/db@0.50.8
- @voyantjs/hono@0.50.8
- @voyantjs/identity@0.50.8
- @voyantjs/utils@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/core@0.50.7
- @voyantjs/db@0.50.7
- @voyantjs/hono@0.50.7
- @voyantjs/identity@0.50.7
- @voyantjs/utils@0.50.7

## 0.50.6

### Patch Changes

- @voyantjs/core@0.50.6
- @voyantjs/db@0.50.6
- @voyantjs/hono@0.50.6
- @voyantjs/identity@0.50.6
- @voyantjs/utils@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/core@0.50.5
- @voyantjs/db@0.50.5
- @voyantjs/hono@0.50.5
- @voyantjs/identity@0.50.5
- @voyantjs/utils@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/core@0.50.4
- @voyantjs/db@0.50.4
- @voyantjs/hono@0.50.4
- @voyantjs/identity@0.50.4
- @voyantjs/utils@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/core@0.50.3
- @voyantjs/db@0.50.3
- @voyantjs/hono@0.50.3
- @voyantjs/identity@0.50.3
- @voyantjs/utils@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/core@0.50.2
- @voyantjs/db@0.50.2
- @voyantjs/hono@0.50.2
- @voyantjs/identity@0.50.2
- @voyantjs/utils@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/core@0.50.1
- @voyantjs/db@0.50.1
- @voyantjs/hono@0.50.1
- @voyantjs/identity@0.50.1
- @voyantjs/utils@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/core@0.50.0
- @voyantjs/db@0.50.0
- @voyantjs/hono@0.50.0
- @voyantjs/identity@0.50.0
- @voyantjs/utils@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/core@0.49.0
- @voyantjs/db@0.49.0
- @voyantjs/hono@0.49.0
- @voyantjs/identity@0.49.0
- @voyantjs/utils@0.49.0

## 0.48.0

### Minor Changes

- 9132fcf: Add public storefront lead and newsletter intake backed by CRM customer signals, including host-owned spam guard hooks, newsletter double-opt-in callback wiring, and a documented `customer.signal.created` event.

### Patch Changes

- @voyantjs/core@0.48.0
- @voyantjs/db@0.48.0
- @voyantjs/hono@0.48.0
- @voyantjs/identity@0.48.0
- @voyantjs/utils@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/core@0.47.0
- @voyantjs/db@0.47.0
- @voyantjs/hono@0.47.0
- @voyantjs/identity@0.47.0
- @voyantjs/utils@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/core@0.46.0
- @voyantjs/db@0.46.0
- @voyantjs/hono@0.46.0
- @voyantjs/identity@0.46.0
- @voyantjs/utils@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/core@0.45.0
- @voyantjs/db@0.45.0
- @voyantjs/hono@0.45.0
- @voyantjs/identity@0.45.0
- @voyantjs/utils@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/core@0.44.0
- @voyantjs/db@0.44.0
- @voyantjs/hono@0.44.0
- @voyantjs/identity@0.44.0
- @voyantjs/utils@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/core@0.43.0
  - @voyantjs/db@0.43.0
  - @voyantjs/hono@0.43.0
  - @voyantjs/identity@0.43.0
  - @voyantjs/utils@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/core@0.42.0
- @voyantjs/db@0.42.0
- @voyantjs/hono@0.42.0
- @voyantjs/identity@0.42.0
- @voyantjs/utils@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/core@0.41.3
- @voyantjs/db@0.41.3
- @voyantjs/hono@0.41.3
- @voyantjs/identity@0.41.3
- @voyantjs/utils@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/core@0.41.2
- @voyantjs/db@0.41.2
- @voyantjs/hono@0.41.2
- @voyantjs/identity@0.41.2
- @voyantjs/utils@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/core@0.41.1
- @voyantjs/db@0.41.1
- @voyantjs/hono@0.41.1
- @voyantjs/identity@0.41.1
- @voyantjs/utils@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/core@0.41.0
- @voyantjs/db@0.41.0
- @voyantjs/hono@0.41.0
- @voyantjs/identity@0.41.0
- @voyantjs/utils@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/core@0.40.1
- @voyantjs/db@0.40.1
- @voyantjs/hono@0.40.1
- @voyantjs/identity@0.40.1
- @voyantjs/utils@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/core@0.40.0
- @voyantjs/db@0.40.0
- @voyantjs/hono@0.40.0
- @voyantjs/identity@0.40.0
- @voyantjs/utils@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/core@0.39.0
- @voyantjs/db@0.39.0
- @voyantjs/hono@0.39.0
- @voyantjs/identity@0.39.0
- @voyantjs/utils@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/core@0.38.2
- @voyantjs/db@0.38.2
- @voyantjs/hono@0.38.2
- @voyantjs/identity@0.38.2
- @voyantjs/utils@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/core@0.38.1
- @voyantjs/db@0.38.1
- @voyantjs/hono@0.38.1
- @voyantjs/identity@0.38.1
- @voyantjs/utils@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/core@0.38.0
- @voyantjs/db@0.38.0
- @voyantjs/hono@0.38.0
- @voyantjs/identity@0.38.0
- @voyantjs/utils@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/core@0.37.1
- @voyantjs/db@0.37.1
- @voyantjs/hono@0.37.1
- @voyantjs/identity@0.37.1
- @voyantjs/utils@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/core@0.37.0
- @voyantjs/db@0.37.0
- @voyantjs/hono@0.37.0
- @voyantjs/identity@0.37.0
- @voyantjs/utils@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/core@0.36.0
- @voyantjs/db@0.36.0
- @voyantjs/hono@0.36.0
- @voyantjs/identity@0.36.0
- @voyantjs/utils@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/hono@0.35.0
- @voyantjs/identity@0.35.0
- @voyantjs/utils@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [a37d4af]
  - @voyantjs/core@0.34.0
  - @voyantjs/db@0.34.0
  - @voyantjs/hono@0.34.0
  - @voyantjs/identity@0.34.0
  - @voyantjs/utils@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/core@0.33.1
- @voyantjs/db@0.33.1
- @voyantjs/hono@0.33.1
- @voyantjs/identity@0.33.1
- @voyantjs/utils@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/hono@0.33.0
- @voyantjs/identity@0.33.0
- @voyantjs/utils@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/hono@0.32.3
- @voyantjs/identity@0.32.3
- @voyantjs/utils@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/hono@0.32.2
- @voyantjs/identity@0.32.2
- @voyantjs/utils@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/hono@0.32.1
- @voyantjs/identity@0.32.1
- @voyantjs/utils@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/hono@0.32.0
  - @voyantjs/identity@0.32.0
  - @voyantjs/utils@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/hono@0.31.4
- @voyantjs/identity@0.31.4
- @voyantjs/utils@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/hono@0.31.3
  - @voyantjs/identity@0.31.3
  - @voyantjs/utils@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/hono@0.31.2
  - @voyantjs/identity@0.31.2
  - @voyantjs/utils@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/hono@0.31.1
- @voyantjs/identity@0.31.1
- @voyantjs/utils@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/hono@0.31.0
- @voyantjs/identity@0.31.0
- @voyantjs/utils@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/hono@0.30.7
- @voyantjs/identity@0.30.7
- @voyantjs/utils@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/hono@0.30.6
  - @voyantjs/identity@0.30.6
  - @voyantjs/utils@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/hono@0.30.5
  - @voyantjs/identity@0.30.5
  - @voyantjs/utils@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/hono@0.30.4
- @voyantjs/identity@0.30.4
- @voyantjs/utils@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3
  - @voyantjs/identity@0.30.3
  - @voyantjs/utils@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2
- @voyantjs/identity@0.30.2
- @voyantjs/utils@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1
- @voyantjs/identity@0.30.1
- @voyantjs/utils@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0
- @voyantjs/identity@0.30.0
- @voyantjs/utils@0.30.0

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

- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0
  - @voyantjs/identity@0.29.0
  - @voyantjs/utils@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/core@0.28.3
- @voyantjs/db@0.28.3
- @voyantjs/hono@0.28.3
- @voyantjs/identity@0.28.3
- @voyantjs/utils@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2
- @voyantjs/identity@0.28.2
- @voyantjs/utils@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1
- @voyantjs/identity@0.28.1
- @voyantjs/utils@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0
- @voyantjs/identity@0.28.0
- @voyantjs/utils@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0
- @voyantjs/identity@0.27.0
- @voyantjs/utils@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9
- @voyantjs/identity@0.26.9
- @voyantjs/utils@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8
- @voyantjs/identity@0.26.8
- @voyantjs/utils@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7
- @voyantjs/identity@0.26.7
- @voyantjs/utils@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6
- @voyantjs/db@0.26.6
- @voyantjs/hono@0.26.6
- @voyantjs/identity@0.26.6
- @voyantjs/utils@0.26.6

## 0.26.5

### Patch Changes

- 7a92aba: Replace the `person_directory_projections` cache table with a Postgres view (closes #446).

  The projection table existed to avoid `LATERAL` joins on every people list read, but no current consumer pushes the projection to a search index — it was pure overhead with a rebuild step on every contact-point change. The new `person_directory` view computes the same `(email, phone, website)` triple per person on demand via `LATERAL` lookups against `identity_contact_points`, leaning on the existing `idx_identity_contact_points_entity_kind_primary_created` index.

  Net effect:

  - `crm.people` list reads now flow through the view; `hydratePeople` returns the same shape it always did.
  - The rebuild path is gone — `syncPersonIdentity` no longer calls `rebuildPersonDirectoryProjection`, and the `rebuildPersonDirectoryProjection(s)` exports are removed.
  - Stale-cache risk is eliminated: edits to `identity_contact_points` flow through immediately on the next read.

  Migration: `templates/operator/migrations/0028_person_directory_view.sql` drops the projection table and creates the view; registered in `meta/_journal.json`.

  Out of scope (deferred): if a future Typesense / search pipeline needs materialized snapshots, it can build a `MATERIALIZED VIEW` or its own table from `person_directory` rather than reusing the deprecated projection.

- Updated dependencies [7a92aba]
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5
  - @voyantjs/identity@0.26.5
  - @voyantjs/utils@0.26.5

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
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4
  - @voyantjs/identity@0.26.4
  - @voyantjs/utils@0.26.4

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
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3
  - @voyantjs/identity@0.26.3
  - @voyantjs/utils@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2
  - @voyantjs/identity@0.26.2
  - @voyantjs/utils@0.26.2

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
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1
  - @voyantjs/identity@0.26.1
  - @voyantjs/utils@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0
- @voyantjs/identity@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0
- @voyantjs/identity@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3
- @voyantjs/identity@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/core@0.24.2
- @voyantjs/db@0.24.2
- @voyantjs/hono@0.24.2
- @voyantjs/identity@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/core@0.24.1
- @voyantjs/db@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/identity@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/identity@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/identity@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/identity@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/identity@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/identity@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0
- @voyantjs/identity@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/identity@0.19.0

## 0.18.0

### Minor Changes

- 8932f60: Make schema discovery declarative and unblock downstream `drizzle-kit generate` against published packages.

  **Exports — `default` condition added everywhere (fixes #380)**

  Every `@voyantjs/*` package's `publishConfig.exports` previously declared only `types` and `import`. drizzle-kit (and any CJS-based resolver) walked the `require` branch, hit nothing, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED` on subpaths like `@voyantjs/db/schema`. Each subpath now also declares a `default` condition pointing at the same `.js` file, so downstream consumers can resolve subpaths and run their own `drizzle-kit generate` against the canonical runtime schema.

  **Operator template baseline regenerated (fixes #378, #379)**

  `templates/operator/migrations/0000_striped_jubilee.sql` was missing `bookings.fx_rate_set_id` (causing `GET /v1/admin/bookings` to 500), and `@voyantjs/cruises`'s 14 tables had never made it into any baseline. Added `@voyantjs/cruises` to `templates/operator/drizzle.config.ts` and emitted `0004_steady_molten_man.sql` covering all drift (cruise tables/enums, the missing `fx_rate_set_id`, idempotency keys, vouchers, voucher redemptions, the `accessibility_needs` → encrypted-jsonb move, several check constraints, new enum values). Pruned 7 stale orphan migrations that were on disk but not in `_journal.json`. Schema baseline + runtime now match — `drizzle-kit generate` against a freshly migrated DB returns "No schema changes".

  **One `./schema` per module — sub-paths removed (BREAKING)**

  Each module now exposes exactly one schema entrypoint, `./schema`, that re-exports everything DB-related the module owns. Granular sub-paths are deleted from `exports` and `publishConfig.exports`:

  - `@voyantjs/bookings/schema/travel-details` → fold into `@voyantjs/bookings/schema`
  - `@voyantjs/legal/contracts/schema` and `@voyantjs/legal/policies/schema` → fold into the new `@voyantjs/legal/schema`
  - `@voyantjs/{products,crm,cruises,distribution,transactions,charters}/schema` now also re-export the pgTables declared inside `./booking-extension`. The runtime `./booking-extension` HonoExtension export is unchanged.

  Consumers importing from any of the removed sub-paths must switch to the consolidated `./schema` import.

  **Declarative dependency graph in `package.json`**

  Every module package gained a `voyant: { schema, requiresSchemas: [...] }` block declaring its schema entrypoint and the other modules' schemas it needs at the SQL level (e.g. `hospitality` requires `facilities` and `bookings`; `ground` requires `facilities` and `identity`; `suppliers` requires `facilities`; everyone implicitly requires `db`). The CLI reads this block to compute the dependency closure for a project.

  **`@voyantjs/cli` — `resolveSchemas` helper + `voyant db schemas` command**

  New `@voyantjs/cli/drizzle` entrypoint exporting `resolveSchemas(config, options?)` — walks `voyant.requiresSchemas` transitively from the modules listed in `voyant.config.ts`, dedupes, returns specifier strings (default) or absolute file paths (`style: "file"`). Throws on circular dependencies. New `voyant db schemas` debug command prints the resolved closure.

  ```ts
  // drizzle.config.ts
  import { defineConfig } from "drizzle-kit";
  import { resolveSchemas } from "@voyantjs/cli/drizzle";
  import voyantConfig from "./voyant.config";

  export default defineConfig({
    schema: resolveSchemas(voyantConfig),
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
  });
  ```

  Adding a new module to `voyant.config.ts` now picks up its schema (and transitive schema deps) automatically — no more manual schema lists, no forgotten modules.

  **Migration impact for existing operator deployments**

  Apply `0004_steady_molten_man.sql` (column + new tables, non-destructive aside from the deliberate `accessibility_needs` text → encrypted-jsonb move) and `0005_condemned_nomad.sql` (cruise booking-extension tables — only relevant when the cruises module is mounted).

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/identity@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/identity@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/core@0.16.0
- @voyantjs/db@0.16.0
- @voyantjs/hono@0.16.0
- @voyantjs/identity@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/identity@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/identity@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/core@0.13.0
- @voyantjs/db@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/identity@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/identity@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/core@0.11.0
- @voyantjs/db@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/identity@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/identity@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/identity@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/core@0.8.0
- @voyantjs/db@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/identity@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/core@0.7.0
- @voyantjs/db@0.7.0
- @voyantjs/hono@0.7.0
- @voyantjs/identity@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/core@0.6.9
- @voyantjs/db@0.6.9
- @voyantjs/hono@0.6.9
- @voyantjs/identity@0.6.9

## 0.6.8

### Patch Changes

- b218885: Add composite indexes for CRM communication history lists scoped by person and
  for the segment recency list.
- b218885: Add a composite index for custom field value admin lists filtered by entity type
  and ordered by update time.
- b218885: Add a CRM-owned person directory projection so person list, detail, and export
  reads no longer hydrate email, phone, website, and primary address fields
  directly from identity tables on every read. Also align CRM child-list indexes
  with the actual parent-and-sort query shapes used for notes, communications,
  pipelines, stages, activity links/participants, opportunity participants and
  products, and quote lines.
- b218885: Add global sort indexes for CRM pipeline and stage admin lists that order by
  sort position and creation time without a parent filter.
- b218885: add crm root admin list composite indexes
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/identity@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/identity@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/identity@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/core@0.6.5
- @voyantjs/db@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/identity@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/identity@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/identity@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/identity@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/identity@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/identity@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/identity@0.5.0

## 0.4.5

### Patch Changes

- e3f6e72: Standardize TypeID prefixes to a first-N-chars convention for better DX.

  Root entities now use the shortest unambiguous first-N chars of the entity name
  (e.g. `pers` instead of `prsn`, `org` instead of `orgn`). Child entities use a
  2-char module code plus 2-char suffix. 19 prefixes renamed in total.

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/identity@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/identity@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/identity@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/hono@0.4.2
- @voyantjs/identity@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/core@0.4.1
- @voyantjs/db@0.4.1
- @voyantjs/hono@0.4.1
- @voyantjs/identity@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/identity@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/identity@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/identity@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0
- @voyantjs/identity@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/identity@0.1.1
