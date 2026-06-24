---
"@voyant-travel/openapi": minor
---

Republish the framework OpenAPI spec with the backfilled public surface (voyant#2114).

The generated `framework-storefront` document now covers the full storefront public
surface — products/taxonomy/pricing, promotional offers, lead + newsletter intake,
email/SMS verification, and the customer portal (profile, companions, documents,
bookings) — plus the bookings public routes, all generated from the composed app
and drift-gated. Consumers (e.g. Voyant Cloud) that depend on this artifact now
receive the complete framework-standard surface instead of only the initial
inventory/pricing routes from 0.1.0.

Operator-local route families (cruises, charters) are documented in the operator
deployment spec, not this framework artifact, by design.
