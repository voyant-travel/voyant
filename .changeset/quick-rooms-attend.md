---
"@voyant-travel/bookings-react": patch
---

Block booking commit on un-priceable quotes and surface checkout failures.

The booking journey now treats a settled quote that reports an `invalidReason`
(e.g. the owned accommodation handler's `rates_missing`) or is explicitly
unavailable as un-priceable: Next, contract acceptance, and Confirm are gated
and a clear "adjust your selection" message is shown, instead of letting the
buyer commit an unpriced booking that fails with a 502 `RESERVE_FAILED` at
`/book`. A checkout handler that throws (e.g. the storefront `/book` +
`/checkout/start` flow) now renders a visible error in the checkout UI rather
than dropping the customer back on Review with only a console log.
