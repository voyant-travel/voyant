---
"@voyantjs/products": minor
"@voyantjs/availability": minor
---

Part 3 of #493: ship the departures child-entity catalog registry — denormalize per-product departure-date aggregations from `availability_slots` onto the product search document so storefront filters can match "departing in May", "available next 30 days", "available now", etc. with a single equality / range query.

New surface (`@voyantjs/products`):

- `productDeparturesCatalogPolicy` (`@voyantjs/products/catalog-policy-departures`) — `FieldPolicy[]` declaring `nextDepartureAt`, `nextDepartureDate`, `hasUpcomingDeparture`, `upcomingDepartureCount`, `departureDates[]`, `departureMonths[]`, `availableUnitsTotal`. Compose with `productCatalogPolicy` via `createFieldPolicyRegistry([...productCatalogPolicy, ...productDeparturesCatalogPolicy])`.

New surface (`@voyantjs/availability`):

- `createProductDeparturesProjectionExtension` (`@voyantjs/availability/service-catalog-plane-departures`) — runtime extension that scans `availability_slots` for `(productId, status='open', startsAt > now)` within a 24-month window, then aggregates: earliest departure, count, distinct local dates capped at 180 days, distinct `YYYY-MM` months capped at 24, and `remainingPax` sum (`null` when any slot is unlimited). Pluggable `now` and `loadBookingMode` for testing.

Why the projection lives in `@voyantjs/availability` (not products): the data lives there, and `availability` already depends on `products` for the FK schema — adding a `products → availability` import would create a circular dep. The contract type (`ProductProjectionExtension`) flows products → availability, matching the existing direction.

Operator template:

- Composes `productDeparturesCatalogPolicy` into the products registry alongside destinations + taxonomy.
- Catalog bridge subscribes to `availability.slot.changed` and reindexes the slot's product. Cross-package event subscription keeps the products `ProductContentChangedEvent.axis` union free of availability concerns.

Behavior decisions:

- Only `status='open'` slots count. Sold-out / cancelled / closed are excluded so storefront filters never surface unavailable departures. A "show sold-out" UX is a query-time concern.
- Products with `bookingMode='open'` (anytime tours, no fixed slots) emit empty arrays / nulls — gated server-side via the booking mode read so we don't issue a slot scan per anytime product.
- Bucket by `availability_slots.dateLocal` (the slot's local-calendar date), not by `products.timezone`. A 9am-Madrid departure is "May 5" globally even when the UTC `startsAt` crosses midnight.
- `availableUnitsTotal` is `null` when any counted slot is `unlimited=true` — emitting a partial sum would mislead storefronts ("3 seats left" when one slot is actually unlimited).

Out of scope:

- Per-option splits (today the projection rolls up to product). Follow-up if storefronts need it.
- Duration buckets (slots carry `nights` / `days` but mixed-duration products can't be summarized in one number).
- Closeout-aware filtering. The projection reads `slots.status` directly; closeouts that mark a date range without flipping the slot status aren't reflected. Separate event design.
