---
"@voyantjs/bookings-ui": minor
---

Packaged-admin RFC Phase 3, bookings pages delivered: the operator's bookings
page wrappers move into `@voyantjs/bookings-ui/admin` as packaged hosts —
`BookingsHost` (list page bound to the packaged search contract) and
`BookingDetailHost` (canonical detail page wired to breadcrumbs, paid-amount
aggregation across invoices, payment-row delete, the in-place
`BookingInvoiceSheet`, and the `booking.details.header` /
`booking.details.after-summary` widget slots via the shared
`AdminWidgetSlotRenderer` extensions context). Cross-route links (bookings
list/detail/create, CRM person/organization, product editor, availability
slot, finance payment/invoice) resolve through new semantic destination keys
(RFC §4.7) via `useAdminHref`/`useAdminNavigate`; API access comes from the
shell's provider contexts (the invoice-attachment download href is built from
the finance context base URL instead of an app env helper). Also exports the
package-owned search contracts (`bookingsIndexSearchSchema`,
`bookingDetailSearchSchema`, `bookingsSearchToFilters`/
`bookingsFiltersToSearch`), the route skeletons (`BookingsListSkeleton`,
`BookingDetailSkeleton`), and `createBookingsAdminExtension` (route metadata
only — bookings navigation stays base-nav-owned). App-local booking-detail
cards whose data access has no package equivalent yet (admin payment
sessions, payment-schedule regenerate, contract generation, booking action
ledger, attachment uploads) stay injectable through the host's typed slots;
the payment dialogs stay app-side because `@voyantjs/finance-ui` depends on
this package. Host route files shrink to param/search binding; `component:`
stays off the route contributions until the §4.2 code-based route assembly
gives packaged pages router-agnostic route state. New peer:
`@voyantjs/admin`.
