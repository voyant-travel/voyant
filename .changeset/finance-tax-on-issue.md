---
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/finance-ui": patch
---

Finance: tax-on-issue + invoice flow refresh.

- `finance/service-issue.ts` is the new home for the invoice-issue pipeline: it computes line-level tax at issue time, snapshots the resolved tax regime onto the invoice, and emits the events expected by the SmartBill plugin.
- `service-booking-create.ts` and `service.ts` route through the issue service so converting a booking to an invoice picks up the same tax/regime logic as a direct issue.
- New route added to expose the tax-preview surface consumed by `useBookingTaxPreview`.
- `useInvoiceMutation` refreshes the booking invoices/pricing caches after issue/void/refund so detail pages no longer go stale.
- `PaymentsPage` styling and empty-state polish; new i18n strings for the issue/preview flow (EN + RO via `i18n/admin/finance`).
