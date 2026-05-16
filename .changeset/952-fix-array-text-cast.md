---
"@voyantjs/availability": patch
"@voyantjs/bookings": patch
---

Fix `cannot cast type record to text[]` crash on `getSlotAllocationManifest`, `validateSlotAllocationCapacity`, `autoAllocateSlotResources`, and the bookings per-resource capacity guard whenever the array being interpolated had 2+ elements.

drizzle-orm's `sql\`…${jsArray}…\`` template spreads JS arrays into a Postgres row constructor (`($1, $2)`) — and `($1, $2)::text[]` is a record cast, which Postgres refuses. Single-element arrays happened to work because `(($1)::text[])` evaluates as the lone scalar. So the bug stayed latent in fresh dev environments with one booking per slot, then hit production immediately on the second booking.

All raw-SQL sites that previously wrote `${array}::text[]` now go through a tiny local helper that emits `ARRAY[$1, $2, …]::text[]` via `sql.join`. Affects nine call sites across `service-allocation.ts`, `service-allocation-automation.ts`, and `bookings/service.ts`. Added an integration regression test that loads the manifest for a slot with 3 bookings.
