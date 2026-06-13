---
"@voyantjs/commerce": minor
"@voyantjs/hono": minor
"@voyantjs/promotions": patch
"@voyantjs/bookings": patch
---

Add Commerce runtime wiring for the pricing, markets, sellability, and
promotions cluster. Templates can now declare one Commerce runtime entry while
preserving the existing package route prefixes during the v1 migration.

Allow manifest module factories in `@voyantjs/hono/composition` to expand to
multiple Hono modules. Remove the Promotions package's direct Storefront
dependency by keeping the storefront offer resolver structurally typed.
