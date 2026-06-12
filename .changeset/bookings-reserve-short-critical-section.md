---
"@voyantjs/bookings": patch
---

`reserveBooking` holds its `FOR UPDATE` slot locks for far less time (perf T7). Catalog snapshot resolution (`resolveBookingItemSnapshot` — product/option/unit names + departure label) and hold-policy resolution now run BEFORE the transaction opens instead of inside it while locks were held; the snapshot reads only immutable catalog data the slot lock never protected. Inside the transaction, the per-item insert loop is replaced by ONE batched `bookingItems` insert and ONE batched `bookingAllocations` insert (item ids pre-generated app-side so allocations link without relying on RETURNING order). For a 3-item booking the transaction shrinks from ~29 statements (incl. 4 cross-table snapshot reads per item under lock) to 10. Returned shape, error codes (slot_not_found / slot_unavailable / insufficient_capacity / mismatches), capacity semantics, and all-or-nothing rollback are unchanged.
