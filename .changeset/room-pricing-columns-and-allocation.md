---
"@voyantjs/availability": minor
"@voyantjs/products-ui": patch
---

Fix room-typed pricing categories leaking into the pricing grid, and make room allocation respect the booked room type (#1476).

- **Pricing grid no longer shows a bogus price column per room type.** The rooms/seats grid built one traveler-type column from every in-scope pricing category, so a tenant whose data carries `room`/`vehicle`/`service`-typed categories — e.g. a global default set or legacy-migrated "Double room" categories — got a phantom price column for each room alongside the real Adult/Child split. Columns are now restricted to per-traveler categories via a new `isTravelerCategory` guard, with an escape hatch that still surfaces any category that actually has a price cell (no data loss). Applies to both the merged grid and the Advanced view.
- **"Generate from rooms" now creates `room`-kind resource templates keyed by `option_unit`.** Previously each room type became its own distinct template `kind`, which the allocator couldn't use to constrain a traveler to their booked room type. Templates now share `kind: "room"` and carry `refType: "option_unit"` / `refId`, so the auto-allocator's unit match keeps a Double-booked traveler in a Double room. The `(product_option_id, kind)` unique index is widened to `(product_option_id, kind, coalesce(ref_id, ''))` to allow one room template per unit, and the per-slot materializer's skip-existing check is refined to `(kind, ref_id)`.
