# @voyantjs/hospitality

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/facilities@0.14.0
- @voyantjs/hono@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/facilities@0.13.0
  - @voyantjs/hono@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/facilities@0.12.0
  - @voyantjs/hono@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/db@0.11.0
  - @voyantjs/facilities@0.11.0
  - @voyantjs/hono@0.11.0

## 0.10.0

### Minor Changes

- 29a581a: Add `hospitalityService.reserveStay(db, input)` — atomic per-night inventory consumption for pooled-mode room types.

  Inside one `db.transaction`:

  1. Per-night `SELECT ... FOR UPDATE` against `room_inventory` for the date range, locks acquired in **date-sorted order** so concurrent reserves with overlapping ranges always grab locks in the same order — no deadlock.
  2. Reject if any night is `stop_sell`, missing, or has `< roomCount` available.
  3. Decrement `available_units`, increment `held_units` per night.
  4. Insert the `stay_booking_items` row.
  5. Insert per-night `stay_daily_rates`.

  6 integration tests cover concurrent-reserve races (2 reserves on the last room, 10 reserves on a 5-room slot, day-mid sold-out atomicity).

- 29a581a: Date-scoped rate variation via `priceScheduleId` (weekend bumps, seasonal pricing). `hospitalityService.resolveStayDailyRates` now consults `price_schedules` so callers can write one `room_type_rates` row per schedule (uniqueness on `(ratePlanId, roomTypeId, priceScheduleId)`) plus a default row with `priceScheduleId: null`.

  Schedule matching:

  - `weekdays` (e.g. `["fri", "sat"]`) — match by day of week.
  - `validFrom` / `validTo` — match within an inclusive ISO date window.
  - `priority` — higher wins when multiple schedules match a date.
  - `recurrenceRule` (iCal RRULE) is intentionally NOT parsed — most production usage maps cleanly to the simpler columns above. Inactive schedules (`active=false`) are ignored even if otherwise matching.

- 29a581a: Add `hospitalityService.resolveStayDailyRates(db, input)` — produces the per-night rate-card array `reserveStay`'s `dailyRates` parameter expects.

  Resolution rules:

  1. Base rate from `room_type_rates.baseAmountCents` for the (ratePlanId, roomTypeId) pair.
  2. `rate_plan_inventory_overrides` consulted for restrictions only:
     - `stop_sell` on any night → typed `stop_sell` failure.
     - `closed_to_arrival` on the first night → `closed_to_arrival`.
     - `closed_to_departure` on the last night before checkout → `closed_to_departure`.
  3. Currency from `room_type_rates.currencyCode`.

  Date-scoped rate variation (weekend bumps, seasonal pricing) is layered on top in the same release via `priceScheduleId` — see the date-scoped-rate-variation changeset.

- 29a581a: Extend `hospitalityService.reserveStay` to dispatch by the room type's `inventoryMode`. Pooled-mode (existing) decrements `room_inventory` per-night; serialized-mode (new) picks a specific `room_unit` and binds the stay to it.

  Serialized-mode flow inside `db.transaction`:

  1. Find the first available unit for (roomTypeId, date range) via a single query that excludes:
     - units in non-active status
     - units covered by an active `room_blocks` entry (per-unit OR property-wide roomType block) whose date range overlaps
     - units covered by an active `maintenance_blocks` entry on the same logic
     - units already in a `reserved` or `checked_in` `stay_booking_items` whose date range overlaps
  2. `SELECT ... FOR UPDATE` the chosen unit so concurrent reserves on the same physical room serialize through the row lock.
  3. Insert `stay_booking_items` with `roomUnitId` set.
  4. Insert `stay_daily_rates`.

  If no unit qualifies → `{ status: "no_unit_available" }`.

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
  - @voyantjs/bookings@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/facilities@0.10.0
  - @voyantjs/hono@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/facilities@0.9.0
- @voyantjs/hono@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/bookings@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/db@0.8.0
- @voyantjs/facilities@0.8.0
- @voyantjs/hono@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/db@0.7.0
  - @voyantjs/facilities@0.7.0
  - @voyantjs/hono@0.7.0

## 0.6.9

### Patch Changes

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/facilities@0.6.9
  - @voyantjs/hono@0.6.9

## 0.6.8

### Patch Changes

- b218885: Align hospitality booking and inventory indexes with active filter-and-date list queries.
- b218885: Add global date and priority indexes for hospitality booking-operation admin
  lists that can paginate without parent filters.
- b218885: Add composite indexes for hospitality inventory and rate-plan admin list queries.
- b218885: Align hospitality operations and folio indexes with active filter-and-time list queries.
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/facilities@0.6.8
  - @voyantjs/hono@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/facilities@0.6.7
- @voyantjs/hono@0.6.7

## 0.6.6

### Patch Changes

- Updated dependencies [6d115a9]
  - @voyantjs/bookings@0.6.6
  - @voyantjs/core@0.6.6
  - @voyantjs/db@0.6.6
  - @voyantjs/facilities@0.6.6
  - @voyantjs/hono@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/facilities@0.6.5
  - @voyantjs/hono@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/facilities@0.6.4
- @voyantjs/hono@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/facilities@0.6.3
  - @voyantjs/hono@0.6.3

## 0.6.2

### Patch Changes

- dd53cdd: Align hospitality parent-list indexes with the active index policy.
  - @voyantjs/bookings@0.6.2
  - @voyantjs/core@0.6.2
  - @voyantjs/db@0.6.2
  - @voyantjs/facilities@0.6.2
  - @voyantjs/hono@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [b68006e]
  - @voyantjs/bookings@0.6.1
  - @voyantjs/core@0.6.1
  - @voyantjs/db@0.6.1
  - @voyantjs/facilities@0.6.1
  - @voyantjs/hono@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/facilities@0.6.0
- @voyantjs/hono@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/facilities@0.5.0
  - @voyantjs/hono@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/facilities@0.4.5
  - @voyantjs/hono@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/bookings@0.4.4
- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/facilities@0.4.4
- @voyantjs/hono@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/facilities@0.4.3
- @voyantjs/hono@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/bookings@0.4.2
- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/facilities@0.4.2
- @voyantjs/hono@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/facilities@0.4.1
  - @voyantjs/hono@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/facilities@0.4.0
  - @voyantjs/hono@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/facilities@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/bookings@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/facilities@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/bookings@0.2.0
- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/facilities@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/bookings@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/facilities@0.1.1
- @voyantjs/hono@0.1.1
