---
"@voyantjs/crm": minor
"@voyantjs/bookings": minor
---

Add CRM person resolution to the storefront booking flow (issue #961).

Before this change, `publicBookingsService.createSession` and `updateSessionState` never created or linked a CRM `people` row. Storefront bookings landed with `bookings.person_id = NULL` and `booking_travelers.person_id = NULL`, so customers who completed a booking ended up outside the CRM even though the same package's lead/newsletter intake (`createStorefrontLeadSignal` / `subscribeStorefrontNewsletter`) did upsert people. Every operator-side repo had to wire its own `booking.confirmed` subscriber to bridge contact → person, racing with the next lead form that created duplicates.

**`@voyantjs/crm`** — new resolution primitives, exported from the package root and rolled into `crmService`:

- `personNameFromContact(contact)` — derives `{ firstName, lastName }` from a partial contact snapshot. Prefers explicit first/last, then a `name` split, then the email local-part. Never inserts the literal `"Unknown"` (acceptance criterion from the issue); falls back to `"Customer" / "Guest"` only when there is nothing else to work with.
- `findPersonByContactPoint(db, { kind, value })` — looks a person up by normalized email/phone/website via `identity_contact_points`.
- `upsertPersonFromContact(db, contact, { source, sourceRef })` — finds-or-creates a CRM person. Lookup order: email → phone. Creates with the supplied source/sourceRef so the audit trail mirrors lead/newsletter signals.

**`@voyantjs/bookings`** — wires CRM-free resolver hooks through `BookingRouteRuntime` (mirrors the existing `ResolveBookingTravelSnapshot` pattern, so the bookings package stays free of any direct CRM dependency):

- New runtime fields: `resolveBillingPerson` and `resolveTravelerPerson`. Templates supply them via `createBookingsHonoModule({ resolveBillingPerson, resolveTravelerPerson })` — typically wired to `crmService.upsertPersonFromContact`.
- `publicBookingsService.createSession` / `updateSession` / `updateSessionState` now accept an optional `PublicBookingsServiceResolvers` arg. Public routes pull the resolvers from the runtime container and pass them through.
- `createSession` and `updateSession` resolve a CRM person per traveler before inserting `booking_travelers` rows.
- `updateSessionState` resolves a CRM person from the billing contact when the wizard's billing payload first arrives, and stamps `bookings.person_id`. Existing `bookings.person_id` values are never overwritten.
- Resolver failures are caught and logged; the booking still lands without a person link rather than aborting the flow.
- Default behaviour (resolvers omitted) is unchanged — bookings continue to land with `person_id = NULL`, so the feature is opt-in via template wiring.

**Tests** — five unit tests for `personNameFromContact`, plus DB-gated integration tests for `findPersonByContactPoint` / `upsertPersonFromContact` covering the dedupe-vs-create path and the email-local-part fallback from the issue acceptance criteria.
