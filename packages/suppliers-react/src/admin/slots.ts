/**
 * Widget slot ids exposed by the suppliers admin host pages.
 *
 * Kept in their own module (no component imports) so slot-id consumers —
 * other domains' admin extension factories, which live in the host's
 * eagerly-evaluated workspace-chrome chunk — can import them without
 * pulling the heavy supplier detail host into the entry graph.
 */

/**
 * Widget slot rendered as the supplier detail page's customer-payment-policy
 * card (packaged-admin RFC §4.7 cycle resolution): `@voyantjs/finance-react/ui`
 * depends on this package, so the host cannot import the finance-owned
 * payment-policy form/preview directly — instead finance's admin extension
 * contributes a widget targeting this slot and the host renders the section
 * whenever a contribution exists. Widgets receive
 * `SupplierDetailHostSlotContext` as props.
 */
export const supplierDetailPaymentPolicySlot = "supplier.details.payment-policy"
