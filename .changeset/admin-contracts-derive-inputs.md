---
"@voyantjs/admin-contracts": minor
"@voyantjs/admin-client": patch
---

Derive admin operation inputs from the module contracts (single source of truth).

`@voyantjs/admin-contracts` now derives its operation **input** schemas from the
canonical route validation in `@voyantjs/bookings-contracts` and
`@voyantjs/finance-contracts` instead of re-declaring them:

- `recordPaymentInput` / `createPaymentLinkInput` are now `.pick()`ed from the
  finance route schemas (removing the duplicated `PAYMENT_METHODS` enum), and
  `confirmBookingInput` / `cancelBookingInput` reuse the bookings route schemas.
  This eliminates the descriptor↔route drift class by construction — the SDK
  input is the route's schema.
- Output DTOs (`BookingSummary`, `InvoiceSummary`, `Payment`) stay curated and
  loose (`status: z.string()`) for forward-compatibility with server-added enum
  values.

`InferInput` now resolves to `z.input` (the caller-facing, pre-parse type) so
schema defaults (e.g. a payment `status` that defaults to `"pending"`) are
optional for the caller rather than required.
