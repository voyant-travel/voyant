# Migrating to 0.11

Consolidated breaking-change notes for the `0.11.0` release train. All entries here also live in the per-package `CHANGELOG.md` files (look for changeset `fe905b0`); this page exists so you can find them all in one read instead of walking 30+ changelogs.

> Long-jumping releases? See the [migrations index](./README.md) for the full list and apply each page in order. If you're coming from `0.9.x`, also apply [migrating-to-0.10.md](./migrating-to-0.10.md) first.

---

## TL;DR

- The Booking state machine is now private. `BOOKING_TRANSITIONS`, `canTransitionBooking`, `transitionBooking`, `BookingStatusPatch`, `BookingTransitionError` are removed from `@voyant-travel/bookings`.
- `PATCH /v1/bookings/:id/status` is **removed**. Use the named verb routes instead: `/start`, `/complete`, `/override-status`, plus the existing `/confirm`, `/cancel`, `/expire`.
- `bookingsService.updateBookingStatus(...)` is **removed**; use `.startBooking(...)` / `.completeBooking(...)` / `.overrideBookingStatus(...)` (or the existing `.confirmBooking` / `.cancelBooking` / `.expireBooking`).
- React: `useBookingStatusMutation` and `useBookingStatusByIdMutation` now require `currentStatus` in their input.
- Run `drizzle-kit push` to add `booking_started`, `booking_completed`, `status_overridden` to the activity-type enum.

---

## Schema changes

### Activity-type enum gains three values

| Value | Emitted by |
|---|---|
| `booking_started` | `POST /:id/start`, `bookingsService.startBooking` |
| `booking_completed` | `POST /:id/complete`, `bookingsService.completeBooking` |
| `status_overridden` | `POST /:id/override-status`, `bookingsService.overrideBookingStatus` |

Run `drizzle-kit push` to sync. Activity-log readers that switch on `activity_type` should add cases for these three values.

---

## Removed exports

### `@voyant-travel/bookings`

| Removed | Replacement |
|---|---|
| `BOOKING_TRANSITIONS` | None public. The transition graph is now an implementation detail; cross the seam via the named verbs below. |
| `canTransitionBooking(from, to)` | None public. If you need pre-flight validation, attempt the verb and handle the error. |
| `transitionBooking(from, to)` | Call the matching service verb: `startBooking` / `completeBooking` / `confirmBooking` / `cancelBooking` / `expireBooking` / `overrideBookingStatus`. |
| `BookingTransitionError` | Service verbs return / throw their own errors; catch generically or by error code. |
| `BookingStatusPatch` | Internal type, no replacement. |
| `bookingsService.updateBookingStatus(...)` | One of `startBooking` / `completeBooking` / `confirmBooking` / `cancelBooking` / `expireBooking` / `overrideBookingStatus`. |
| `updateBookingStatusSchema` | One of `startBookingSchema` / `completeBookingSchema` / `confirmBookingSchema` / `cancelBookingSchema` / `expireBookingSchema` / `overrideBookingStatusSchema`. |

`BookingStatus` (the union type) **stays exported** — it's data, not a lifecycle helper.

---

## HTTP route changes

### Removed

| Route | Replacement |
|---|---|
| `PATCH /v1/bookings/:id/status` | Use the named verb endpoint matching the `(currentStatus, targetStatus)` arrow. See dispatch table below. |

### Added

| Route | Arrow | Notes |
|---|---|---|
| `POST /v1/bookings/:id/start` | `confirmed → in_progress` | Emits `booking.started`. Body: `{ note? }`. |
| `POST /v1/bookings/:id/complete` | `in_progress → completed` | Emits `booking.completed`. Cascades confirmed allocations + items to `fulfilled`. Body: `{ note? }`. |
| `POST /v1/bookings/:id/override-status` | (any) → (any) | Admin override. Bypasses the transition graph. Updates the Booking row only; does **not** cascade. Requires non-empty `reason`. Emits `booking.status_overridden` as a privileged audit signal distinct from the normal lifecycle events. Body: `{ status, reason, note? }`. |

`POST /:id/confirm`, `/:id/cancel`, `/:id/expire`, `/:id/extend-hold` are unchanged.

### Dispatch table for non-React callers

If you were calling `PATCH /v1/bookings/:id/status` directly (operator scripts, server-to-server, third-party storefront builds), the mapping from `(current, target)` to verb is:

| current | target | endpoint | body |
|---|---|---|---|
| `on_hold` | `confirmed` | `/confirm` | `{ note? }` |
| `on_hold` | `expired` | `/expire` | `{ note? }` |
| `confirmed` | `in_progress` | `/start` | `{ note? }` |
| `in_progress` | `completed` | `/complete` | `{ note? }` |
| `draft` / `on_hold` / `confirmed` / `in_progress` | `cancelled` | `/cancel` | `{ note? }` |
| (anything else) | (anything) | `/override-status` | `{ status, reason, note? }` (reason required, server returns 400 on empty) |

This table is also the body of the framework-agnostic `dispatchBookingStatusChange` helper exported from `@voyant-travel/bookings/status-dispatch` — see [PR #334](https://github.com/voyant-travel/voyant/pull/334).

```ts
import { dispatchBookingStatusChange } from "@voyant-travel/bookings/status-dispatch"

const target = dispatchBookingStatusChange(bookingId, currentStatus, targetStatus, note)
await fetch(`${apiBase}${target.path}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(target.body),
})
```

---

## Hook signature changes

### `@voyant-travel/bookings-react`

`useBookingStatusMutation` and `useBookingStatusByIdMutation` now require `currentStatus` in their input. The hook dispatches client-side to the right verb endpoint; non-adjacent jumps fall through to `/override-status`, using the operator's note as the reason.

```ts
// Before — 0.10.x
const mutation = useBookingStatusMutation(bookingId)
mutation.mutate({ status: "confirmed", note })

// After — 0.11.x
const mutation = useBookingStatusMutation(bookingId)
mutation.mutate({ currentStatus, status: "confirmed", note })
```

The `<StatusChangeDialog>` UX is unchanged — pass the booking's current status from props.

---

## Caller-code migrations

### Service-call rewrites

```ts
// Before — 0.10.x
import { transitionBooking } from "@voyant-travel/bookings"
const patch = transitionBooking(currentStatus, "confirmed")
await db.update(bookings).set(patch).where(eq(bookings.id, bookingId))

// After — 0.11.x
await bookingsService.confirmBooking(db, bookingId, { note }, { actor: { userId } })
```

| Before | After |
|---|---|
| `bookingsService.updateBookingStatus(db, id, { status: "confirmed", note })` | `bookingsService.confirmBooking(db, id, { note }, { actor })` |
| `bookingsService.updateBookingStatus(db, id, { status: "cancelled", note })` | `bookingsService.cancelBooking(db, id, { note }, { actor })` |
| `bookingsService.updateBookingStatus(db, id, { status: "expired", note })` | `bookingsService.expireBooking(db, id, { note }, { actor })` |
| `bookingsService.updateBookingStatus(db, id, { status: "in_progress", note })` | `bookingsService.startBooking(db, id, { note }, { actor })` |
| `bookingsService.updateBookingStatus(db, id, { status: "completed", note })` | `bookingsService.completeBooking(db, id, { note }, { actor })` |
| `bookingsService.updateBookingStatus(db, id, { status, note })` (data correction / non-adjacent jump) | `bookingsService.overrideBookingStatus(db, id, { status, reason: note }, { actor })` (reason required) |

### Activity-log enum readers

If your app reads `booking_activity_log.activity_type`, add cases for `booking_started`, `booking_completed`, `status_overridden`.

---

## Per-package CHANGELOGs

For full detail, including patch-level changes and dependency updates not listed here:

- [`@voyant-travel/bookings@0.11.0`](../../packages/bookings/CHANGELOG.md)
- [`@voyant-travel/bookings-react@0.11.0`](../../packages/bookings-react/CHANGELOG.md)
- [`@voyant-travel/hono@0.11.0`](../../packages/hono/CHANGELOG.md)
- [`@voyant-travel/db@0.11.0`](../../packages/db/CHANGELOG.md)
- [`@voyant-travel/core@0.11.0`](../../packages/core/CHANGELOG.md)
