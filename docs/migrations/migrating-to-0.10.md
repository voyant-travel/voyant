# Migrating to 0.10

Consolidated breaking-change notes for the `0.10.0` release train. All entries here also live in the per-package `CHANGELOG.md` files (look for changeset `29a581a` and `b7f0501`); this page exists so you can find them all in one read instead of walking 30+ changelogs.

> Long-jumping releases? See the [migrations index](./README.md) for the full list and apply each page in order.

---

## TL;DR

- Run `drizzle-kit push` after upgrading — the booking activity-type enum and a few schema changes need to land at the database level.
- Anonymous traffic on `/v1/admin/*` now returns `401` instead of `200` — `requireActor` is fail-closed.
- `booking_travelers.accessibility_needs` is dropped — read/write through the encrypted PII service instead.
- The `redeemed` booking status is gone. Read `completed` instead.
- Direct `db.update(bookings).set({ status })` is no longer permitted from caller code — use `transitionBooking()`.
- Booking-creation endpoints accept an optional `Idempotency-Key` header.

---

## Schema changes

### Dropped

| Column | Why | Replacement |
|---|---|---|
| `booking_travelers.accessibility_needs` | Disability data has tighter regulatory expectations (ADA / Equality Act) than freeform notes; moved into the KMS-encrypted bucket alongside passport / DOB / dietary. | Encrypted column `booking_traveler_travel_details.accessibility_encrypted`. Read via `createBookingPiiService.getTravelerTravelDetails`; write via `upsertTravelerTravelDetails`. |

### Added

| Column | Notes |
|---|---|
| `bookings.fx_rate_set_id` | Plain text, nullable. Soft FK into the `markets` package per the cross-domain FK rule. Drives the new FX rollup on `base_*_amount_cents`. |

### CHECK constraints (additive, may reject existing bad data)

Postgres `CHECK` constraints now enforce that if any `*_amount_cents` column is set, its companion currency column must also be set. Two flavours:

- **Strict XNOR** (`(currency IS NULL) = (amount IS NULL)`): one currency to one amount — `booking_guarantees`, `booking_item_commissions`, `payments` (base).
- **Implication** (`(amounts NULL) OR (currency NOT NULL)`): one currency covering multiple amount columns — `bookings.base_currency`, `booking_items.cost_currency`, `offer_items.cost_currency`, `order_items.cost_currency`, `invoices.base_currency`. The implication form intentionally allows "currency without amount" because the currency may be pre-declared before line items roll up.

If the migration fails, the offending rows have an amount without a currency — fix or null the amount before retrying.

---

## Removed exports

### `@voyant-travel/bookings`

| Removed | Replacement |
|---|---|
| `accessibilityNeeds` field on `BookingTraveler*` insert / update validation schemas (`insertTravelerSchema`, `updateTravelerSchema`, `insertTravelerRecordSchema`, `updateTravelerRecordSchema`) and on `redactTravelerIdentity()` output | Use `createBookingPiiService.upsertTravelerTravelDetails({ accessibilityNeeds })`. A later release adds a `bookingsService.createTravelerWithTravelDetails` convenience verb that takes the same flat payload as the old `createTravelerRecord` — see the matching migration page when it ships. |
| `redeemed` value in `BookingStatus` | Read `completed` instead. The redemption concept moved to the vouchers domain. |

---

## HTTP route changes

### Added

- `POST /v1/admin/bookings/`, `POST /v1/admin/bookings/reserve`, `POST /v1/admin/bookings/from-product`, `POST /v1/admin/bookings/from-offer/:offerId/reserve`, `POST /v1/admin/bookings/from-order/:orderId/reserve`, `POST /v1/public/bookings/sessions`, and `POST /v1/public/bookings/sessions/:sessionId/confirm` accept an optional `Idempotency-Key` header. Same key + same body replays the original response; same key + different body returns `409 Conflict`. Records expire after 24h.

  No client change required (header defaults to `required: false`). Templates can flip a route to `required: true` per endpoint once their client has rolled out.

### Behaviour change — fail-closed `requireActor`

`requireActor` middleware now returns `401 Unauthorized` when no actor is set on the request, instead of defaulting to `"staff"`.

- Earlier versions silently granted operator privileges to anonymous traffic if `requireAuth` was missing, misordered, or a route mounted before auth. The fail-open default has been replaced with fail-closed.
- `requireAuth` now sets `actor: "staff"` explicitly on the core-owned API key path (`voy_` prefix) — server-to-server integrations behave the same.
- Custom `auth.resolve` integrations that previously relied on the implicit `"staff"` fallback must now return an explicit `actor` from `resolve()`.
- Anonymous requests on `/v1/admin/*` now return `401` instead of `200`. Anonymous requests on `/v1/public/*` continue to receive `actor: "customer"` via the `publicPaths` bypass when applicable, and `401` otherwise.
- The differentiation between `401` (no actor) and `403` (actor not in the allowed list) is now reliable — earlier the no-actor path returned `403` for some surfaces and `200` for others.

### Behaviour change — admin booking reads gain mandatory PII redaction + audit

`GET /v1/admin/bookings`, `GET /v1/admin/bookings/:id`, and `GET /v1/admin/bookings/:id/travelers` now mask contact PII (name, email, phone, address) in the response unless the caller has the `bookings-pii:read` (or `bookings-pii:*` / `*` superuser) scope, or the request is internal. Every call also writes a `booking_pii_access_log` row with reason (`list_redacted` / `detail_reveal` / `insufficient_scope`) and metadata including row count.

If your operator UI relies on contact data being present in list responses, grant the operator user the `bookings-pii:read` scope or upgrade to detail reveal.

---

## Caller-code migrations

### State machine — direct status writes are no longer permitted

Bookings now move through a typed state graph:

```
draft → on_hold → confirmed → in_progress → completed
                                    ↓
                              cancelled / expired (terminal exits)
```

Replace any `db.update(bookings).set({ status: ... })` in caller code with `transitionBooking(bookingId, nextStatus, ctx)`, which enforces `BOOKING_TRANSITIONS` and emits an activity log row per transition.

> **Note**: as of `@voyant-travel/bookings@0.11`, `transitionBooking` itself is no longer exported — the lifecycle laws live behind named verb routes / service methods. See [migrating-to-0.11.md](./migrating-to-0.11.md). If you're long-jumping from `0.9` to `0.11+`, you can skip the `transitionBooking()` step and go straight to the verb endpoints.

### Encrypted accessibility data — read/write contract change

```ts
// Before — 0.9.x
await bookingsService.createTravelerRecord(db, bookingId, {
  // ...plaintext fields
  accessibilityNeeds: "wheelchair access",
})

// After — 0.10.x (two-call protocol)
const traveler = await bookingsService.createTravelerRecord(db, bookingId, {
  // ...plaintext fields only
})
const pii = createBookingPiiService({ kms })
await pii.upsertTravelerTravelDetails(db, traveler.id, {
  accessibilityNeeds: "wheelchair access",
})

// After — single-call convenience verb (added in a later release)
const result = await bookingsService.createTravelerWithTravelDetails(
  db,
  bookingId,
  { /* ...plaintext + accessibilityNeeds + other encrypted fields */ },
  { pii },
)
```

Reads of accessibility data go through `createBookingPiiService.getTravelerTravelDetails`, which decrypts via `decryptOptionalJsonEnvelope` + audits the access. Same authorisation gate as the existing dietary / identity buckets.

Contact identifiers (email, phone, names, address) and `specialRequests` deliberately stay plaintext — see `docs/architecture/booking-pii.md` for the cost-benefit decision.

### `redeemed` status removed

Anything that filtered on `BookingStatus === "redeemed"` should now look at `"completed"`. The redemption event itself still exists in `booking_redemption_events` — the change was just to the lifecycle terminal value.

---

## New capabilities (non-breaking, but worth knowing)

- **`bookingsService.recomputeBookingTotal(db, bookingId)`** — auto-rolls up the parent total from `booking_items` on `createItem` / `updateItem` / `deleteItem`, each wrapped in `db.transaction`. Also exposed publicly for ad-hoc invocation (saga compensation, fix-up scripts). Base-currency totals are NOT recomputed by this rollup — that's the FX rollup, see below.
- **FX rollup for `base_*_amount_cents`** — re-derives `baseSellAmountCents` / `baseCostAmountCents` from per-item totals when the booking declares a `baseCurrency` and `fxRateSetId`. Handles single-currency (no-op), multi-currency with valid FX, missing rate (short-circuits with `fxStatus: "missing_rate"`), and skipped (no `fxRateSetId`).
- **`refundBooking` saga** — atomic credit-note + hold-release + supplier-reverse + notify, built on the existing `createWorkflow` primitive. Side-effect dependencies are injected (no compile-time pull on finance / transactions / notifications) so the package stays slim; templates wire the deps. Exports `refundBooking(input, deps)` and `buildRefundBookingWorkflow(deps)`.
- **`idempotencyKey({ scope, required? })` middleware** in `@voyant-travel/hono` — see Added routes above. Pair with `purgeExpiredIdempotencyKeys()` for daily-cron cleanup.

---

## Per-package CHANGELOGs

For full detail, including patch-level changes and dependency updates not listed here:

- [`@voyant-travel/bookings@0.10.0`](../../packages/bookings/CHANGELOG.md)
- [`@voyant-travel/hono@0.10.0`](../../packages/hono/CHANGELOG.md)
- [`@voyant-travel/db@0.10.0`](../../packages/db/CHANGELOG.md)
- [`@voyant-travel/core@0.10.0`](../../packages/core/CHANGELOG.md)
