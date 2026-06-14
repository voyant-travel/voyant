---
"@voyant-travel/commerce": minor
"@voyant-travel/hono": minor
"@voyant-travel/bookings": patch
---

Add Commerce runtime wiring for the pricing, markets, sellability, and
promotions cluster. Templates can now declare one Commerce runtime entry while
preserving the existing package route prefixes during the v1 migration.

Allow manifest module factories in `@voyant-travel/hono/composition` to expand to
multiple Hono modules. Remove the Promotions package's direct Storefront
dependency by keeping the storefront offer resolver structurally typed.
