/**
 * Widget slot ids exposed by the bookings admin host pages.
 *
 * Kept in their own module (no component imports) so slot-id consumers —
 * other domains' admin extension factories, which live in the host's
 * eagerly-evaluated workspace-chrome chunk — can import them without
 * pulling the heavy booking detail host into the entry graph.
 */

/**
 * Widget slot rendered as the booking detail page's Invoices tab
 * (packaged-admin RFC §4.7 cycle resolution): `@voyant-travel/finance-react/ui` depends
 * on this package, so the host cannot import the finance-owned invoices card
 * directly — instead finance's admin extension contributes a widget targeting
 * this slot and the host mounts the tab whenever a contribution exists.
 * Widgets receive `BookingDetailHostSlotContext` as props.
 */
export const bookingDetailInvoicesTabSlot = "booking.details.invoices-tab"

/**
 * Widget slot rendered at the top of the booking detail page's Finance tab
 * (same §4.7 cycle resolution as {@link bookingDetailInvoicesTabSlot}).
 * `@voyant-travel/finance-react/ui` contributes its pending payment-sessions card here.
 * Widgets receive `BookingDetailHostSlotContext` as props.
 */
export const bookingDetailFinanceStartSlot = "booking.details.finance-start"

/**
 * Widget slot rendered at the bottom of the booking detail page's Finance
 * tab. `@voyant-travel/finance-react/ui` contributes its payment-policy override card
 * here. Widgets receive `BookingDetailHostSlotContext` as props.
 */
export const bookingDetailFinanceEndSlot = "booking.details.finance-end"

/** Widget slot rendered beside the primary action on the bookings list. */
export const bookingsListHeaderActionsSlot = "bookings.list.header-actions"

/**
 * Controller slot for selected finance packages to provide payment-dialog
 * callbacks without replacing the package-owned booking detail route.
 */
export const bookingDetailPaymentControllerSlot = "booking.details.payment-controller"
