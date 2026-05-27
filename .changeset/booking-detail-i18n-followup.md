---
"@voyantjs/bookings-ui": patch
"@voyantjs/finance-ui": patch
"@voyantjs/i18n": patch
---

Follow-up to the booking-detail UX overhaul (#1332): satisfy the `i18n:check:ui-literals` CI scan.

- `PaymentScheduleSection`: drop the unreachable `?? "Remove"` / `?? "Add installment"` fallbacks on the add / remove installment controls — the canonical `messages.paymentScheduleSection.labels` declares both keys as required, so the fallbacks were dead code that just tripped the linter.
- `BookingInvoiceDialog`: mark the `SCHEDULE_DESCRIPTION_FALLBACK` entries (`"Deposit"`, `"Installment"`, `"Balance"`, `"Hold"`, `"Payment"`) with `i18n-literal-ok`. These persist as the invoice's line-item description and ship with the PDF — operator-managed copy intentionally English at the data layer.
- Operator `BookingInvoiceSheet` had a literal `Download` button label on the attachment row. New nested key `bookings.detail.invoiceSheet.attachmentDownload` (`Download` / `Descarca`) threaded through as a `downloadLabel` prop so the helper stays hook-free.
