# Booking PII handling

This document describes how Voyant treats personally identifiable
information (PII) on bookings and travelers.

## Surface area

There are three classes of PII on a booking:

1. **High-sensitivity** — passport, national ID, date of birth,
   nationality, dietary requirements, **accessibility needs**. Stored
   in `booking_traveler_travel_details` as KMS-encrypted JSON envelopes.
   See `packages/bookings/src/schema/travel-details.ts` and
   `createBookingPiiService`. Accessibility info has tighter regulatory
   bar in many jurisdictions (ADA / Equality Act) so it lives with the
   passport-class data, not with the freeform notes.
2. **Contact identifiers** — first/last name, email, phone, address,
   postal code. Stored as plaintext columns on `bookings.contact_*` and
   `booking_travelers.{first,last}_name / email / phone`. Plaintext is a
   deliberate choice so the operator UI can search and sort.
3. **Operational notes** — `special_requests`, `notes`. Plaintext,
   redacted in flight. These are too freeform to warrant encryption —
   "anniversary trip", "high floor please", "VIP guest" cover most of
   the production use, and operators sort/filter on them.

## Posture

| Class | At rest | In flight (default) | In flight (with `bookings-pii:read` scope) |
|---|---|---|---|
| High-sensitivity | Encrypted (KMS envelope) | Not returned by list/get unless explicitly requested through the travel-details endpoint, which always audits | Decrypted and returned |
| Contact identifiers | Plaintext | **Redacted** (email → `a***e@host`, phone → `***1234`, name/address → `***`) | Returned verbatim |
| Operational notes | Plaintext | **Redacted** to `***` | Returned verbatim |

## Authorisation gate — `shouldRevealBookingPii(ctx)`

Returns `true` when ANY of:

- `ctx.isInternalRequest === true` (server-to-server inside the trust boundary)
- `ctx.scopes` contains `*` (superuser)
- `ctx.scopes` contains `bookings-pii:*`
- `ctx.scopes` contains `bookings-pii:read`

Plain staff sessions WITHOUT the scope do NOT reveal — staff are
authorised to operate on bookings but not necessarily to read every
contact identifier on every booking. Granting `bookings-pii:read` is an
explicit decision, defaulted off in role templates.

## Audit

Every PII access — both reveals and redactions — is recorded in
`booking_pii_access_log` with:

- `actor_id` (the user id from auth)
- `actor_type` (staff / customer / partner / supplier)
- `caller_type` (session / api_key / internal)
- `action` (read / update / delete)
- `outcome` (allowed / denied)
- `reason` (free-form, e.g. `list_redacted`, `detail_reveal`,
  `insufficient_scope`)
- `metadata` (arbitrary JSON — current contents include `rowCount`,
  `reveal: boolean`)

The list endpoints log a single row per request, not per row, with the
`rowCount` in metadata.

## Why contact identifiers stay plaintext

Encrypting `email` / `phone` / `firstName` / `lastName` at rest would
require either deterministic encryption (which is weak — ciphertext
patterns leak) or a parallel search-token column built from a
salted-hash of the value, plus a migration script for existing rows.
Both add friction to every read path for a threat — disk-level
exfiltration of a single-tenant Postgres deployment — that's already
substantially mitigated by:

- Voyant Cloud's deployment-boundary isolation (one DB per org, see
  `docs/adr/0001-tenant-scoping.md`)
- Disk-level encryption on managed Postgres (Neon, RDS, etc.)
- The redaction layer, which limits what a compromised app credential
  can dump

The cost-benefit didn't pencil out; routine contact info stays
plaintext + redacted. Self-hosters with stricter regulatory bars can
turn on disk-level encryption on their underlying Postgres.

## How to apply this in route code

Use the helpers from `@voyant-travel/voyant-bookings`:

```ts
import {
  redactBookingContact,
  redactTravelerIdentity,
  shouldRevealBookingPii,
} from "@voyant-travel/voyant-bookings"

const reveal = shouldRevealBookingPii({
  actor: c.get("actor"),
  scopes: c.get("scopes"),
  callerType: c.get("callerType"),
  isInternalRequest: c.get("isInternalRequest"),
})
await logBookingPiiAccess(c, {
  bookingId: row.id,
  action: "read",
  outcome: "allowed",
  reason: reveal ? "detail_reveal" : "detail_redacted",
  metadata: { reveal },
})
return c.json({ data: reveal ? row : redactBookingContact(row) })
```

The bookings module's admin routes (`GET /v1/admin/bookings`,
`GET /v1/admin/bookings/:id`, `GET /v1/admin/bookings/:id/travelers`)
already follow this pattern. Public routes (`/v1/public/*`) currently
do not return contact identifiers, so they do not need redaction.
