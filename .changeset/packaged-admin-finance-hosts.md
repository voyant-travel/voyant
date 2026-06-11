---
"@voyantjs/finance-ui": minor
"@voyantjs/bookings-ui": minor
---

Packaged-admin RFC finance pages delivered: the operator's finance wrappers
move into `@voyantjs/finance-ui/admin` as packaged hosts —
`InvoiceDetailHost` (operator-grade invoice page with line-item/payment/
credit-note dialogs, attachments, notes, action ledger, and the
`invoice.details.header` / `invoice.details.after-summary` widget slots
rendered through the shared `AdminWidgetSlotRenderer`), `PaymentDetailHost`,
the matching skeletons, and the payments page's `RecordPaymentDialog`.
Cross-route links resolve through the semantic destination keys (RFC §4.7)
via `useAdminHref`/`useAdminNavigate` — new keys `invoice.list` and
`payment.list`, plus shape-locked `supplier.detail`; API URLs come from the
shared finance provider context's `baseUrl` instead of a host env helper.
`createFinanceAdminExtension` contributes the finance route metadata (no
nav — the Finance group is base-nav-owned) AND resolves the
finance-ui ↔ bookings-ui cycle: the booking detail page's invoices card now
ships as the `BookingInvoicesWidget` contribution targeting the new
`booking.details.invoices-tab` slot. `@voyantjs/bookings-ui`'s
`BookingDetailHost` exposes that slot (`bookingDetailInvoicesTabSlot`),
mounts its Invoices tab whenever an app slot or a widget contribution
targets it, and hands widgets the typed `BookingDetailHostSlotContext`
(`{ booking, paidAmountCents, fullyPaidReason, openInvoiceSheet }`) as
props. Host route files shrink to param binding; `component:` stays off the
route contributions until the §4.2 code-based route assembly lands. New
finance-ui peers: `@voyantjs/admin`, `@voyantjs/bookings-react`,
`@voyantjs/suppliers-react`, `@tanstack/react-table`.
