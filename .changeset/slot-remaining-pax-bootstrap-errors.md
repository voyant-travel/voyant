---
"@voyant-travel/operations": patch
"@voyant-travel/bookings": patch
"@voyant-travel/storefront": patch
---

Fix silently-unbookable availability slots and opaque bootstrap errors (#2833)

- `createSlot` now seeds `remaining_pax = initial_pax` for a bounded slot when
  the caller omits `remainingPax`, so a slot created via
  `{ initialPax, unlimited: false }` no longer lands with `remaining_pax = NULL`
  and read as sold out from birth by the booking engine's capacity reservation.
- `reserveBooking` tolerates an option-less slot (`option_id = NULL`): such a
  slot is not option-scoped, so an item carrying a derived option id no longer
  fails `slot_option_mismatch`. This unblocks storefront compat bootstrap, which
  derives and stamps an option id onto the booking item.
- The storefront bootstrap error contract maps `slot_product_mismatch` and
  `slot_option_mismatch` to dedicated codes (`SLOT_PRODUCT_MISMATCH`,
  `SLOT_OPTION_MISMATCH`) instead of collapsing them into the generic
  `BOOTSTRAP_FAILED` fallback.
