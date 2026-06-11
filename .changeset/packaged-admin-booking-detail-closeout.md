---
"@voyantjs/bookings-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/bookings-ui": minor
"@voyantjs/finance-ui": minor
---

Packaged-admin RFC booking-detail close-out: the operator's last
booking-detail wrappers move into the packages, backed by new client hooks
for existing server endpoints. `@voyantjs/bookings-react` gains
`useBookingActionLedger` (cursor-paged
`GET /v1/admin/bookings/:id/action-ledger` feed with traveler labels) and
`useBookingContractGenerationMutation` (preview + generate modes of
`POST /v1/admin/bookings/:id/generate-contract`).
`@voyantjs/finance-react` gains `usePaymentSessions`
(`GET /v1/admin/finance/payment-sessions` with booking/status filters),
`usePaymentSessionMutation` (`POST …/payment-sessions/:id/complete` and
`/cancel`) and `useBookingPaymentScheduleRegenerateMutation`
(`POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate`), plus the
matching payment-session / payment-policy schemas and
`financeQueryKeys.paymentSessions*` keys.

On top of those hooks, `@voyantjs/bookings-ui/admin` now owns the unified
Documents tab (`BookingDocumentsTable` + `BookingContractDialog`, linking
contract rows through a shape-locked `contract.detail` destination and the
legal provider context's `baseUrl`) and merges the booking's central
action-ledger entries into the Activity timeline natively
(`useBookingActionLedgerEvents`); `BookingDetailHost` renders the Documents
tab by default, exposes two new widget slots —
`booking.details.finance-start` / `booking.details.finance-end`
(`bookingDetailFinanceStartSlot` / `bookingDetailFinanceEndSlot`) — and
forwards a new `onGenerateLink` host prop through
`BookingDetailHostSlotContext`. `@voyantjs/finance-ui/admin` contributes the
finance-tab cards onto those slots (RFC §4.7 cycle resolution, same as the
invoices tab): `BookingPendingPaymentSessionsWidget` (pending payment links
with copy/mark-received/cancel) and `BookingPaymentPolicyWidget` (cascade
trace + booking-level override + schedule regenerate). The operator's
booking-detail wrapper shrinks to the two payment dialogs
(`CollectPaymentDialog` / `RecordBookingPaymentDialog`), which stay
app-side because `@voyantjs/checkout-ui` / `@voyantjs/finance-ui` depend on
`bookings-ui`; the dead `booking-catalog-source-card`,
`booking-pricing-summary-card`, `booking-paid-payment-sessions` and
`booking-note-dialog` wrappers are deleted.
