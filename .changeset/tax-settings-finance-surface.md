---
"@voyant-travel/finance": minor
"@voyant-travel/finance-react": minor
"@voyant-travel/operator-settings": minor
---

Move the finance tax-settings admin surface and drop the operator FX reference-source setting.

- **Tax settings moved to the finance surface.** `GET`/`PATCH /tax-settings`
  now serve from `/v1/admin/finance/tax-settings` instead of
  `/v1/admin/bookings/tax-settings`. On the managed operator runtime admin
  routes dispatch per-unit with prefix-first-match, so the bookings package's
  `GET /{id}` route was capturing `/tax-settings` (id = "tax-settings") and
  returning 404 — leaving the Settings → Invoicing controls permanently
  disabled. The booking-tax extension now splits into two API entries: tax
  settings on the finance mount (`mount: "finance"`) and the tax-preview
  route left on the bookings mount (`POST /v1/admin/bookings/tax-preview`,
  where it does not collide and `bookings-react` consumes it).
- **Operator FX reference-source setting removed.** The FX reference *source*
  is not an operator choice: Voyant Cloud serves managed FX by default,
  self-hosters supply their own adapter through the `finance.fx-reference.runtime`
  port, and for jurisdictions like RO the source (BNR) is legally mandated. The
  operator-facing "Reference exchange rates" control, the `fxReferenceSource`
  field on the tax-settings surface, and the `fx_reference_source` column are
  removed (additive drop migration). The `finance.fx-reference.runtime` port and
  its `resolveReferenceRate` helper are kept as the self-host/managed adapter
  seam; the source is now the host adapter's own and reported only as an output
  label on the returned rate.
