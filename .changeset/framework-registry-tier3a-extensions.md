---
"@voyant-travel/framework": minor
---

Relocate the 6 pure singleton standard **extensions** into `frameworkComposition.extensions` (Workstream B, Tier 3a): bookings/booking-supplier, finance/bookings-create, inventory/booking, inventory/authoring, quotes/booking, and distribution (booking) extensions. These take no providers, so they move like the Tier 1 singletons; the deployment now spreads `...frameworkComposition.extensions`. The two injection-shaped extensions (distribution/channel-push, finance/booking-tax) remain in the deployment for Tier 3b.
