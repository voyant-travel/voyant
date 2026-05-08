---
"@voyantjs/octo": patch
---

`listProjectedBookings` and `listProjectedProducts` now force `sortBy: "createdAt"` / `sortDir: "desc"` when calling through to the underlying bookings / products services, so OCTO list responses are stable across pages instead of inheriting whatever the caller (or default service ordering) happened to use. Pagination over the OCTO `/products` and `/bookings` endpoints no longer skips or duplicates rows when new records are inserted between requests.
