---
"@voyant-travel/storefront": minor
---

Add a first-class storefront booking **compatibility bootstrap** for imported catalog departures (issue voyant#1984).

- **New endpoint** `POST /v1/public/bookings/sessions/compat-bootstrap` accepts the minimal `{ productId, departureId, pax, currency?, locale?, optionId?, optionUnitId?, ... }` contract a host can always build for an imported departure. The server derives the current slot, option, and authoritative price itself, then returns a normal booking session — so this path never fails with `quote stale`.
- **Machine-readable error contract** across every bootstrap surface (sync, compat, and the async intent poll). A single `STOREFRONT_BOOTSTRAP_ERROR_CODES` table maps each internal status to a stable `code` (`DEPARTURE_NOT_FOUND`, `PRODUCT_MISMATCH`, `SLOT_DEPARTURE_MISMATCH`, `PRICING_UNAVAILABLE`, `QUOTE_STALE`, `SLOT_UNAVAILABLE`, `INSUFFICIENT_CAPACITY`, `BOOTSTRAP_FAILED`), an HTTP status, and a `retryable` hint. `QUOTE_STALE` is the one expected, retryable rejection and now carries those fields alongside its `repricing` snapshot.
- New exports: `bootstrapStorefrontBookingSessionCompat` machinery via the service, `describeStorefrontBootstrapError`, `STOREFRONT_BOOTSTRAP_ERROR_CODES`, plus the `storefrontBookingSessionCompatBootstrapInputSchema` / `storefrontBookingBootstrapRejectionSchema` schemas and types.

No breaking changes — the existing `bootstrap` endpoint is unchanged except for the additive `code`/`retryable` fields on its error responses.
