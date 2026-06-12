/**
 * Widget slot ids exposed by the CRM admin host pages.
 *
 * Kept in their own module (no component imports) so slot-id consumers —
 * other domains' admin extension factories, which live in the host's
 * eagerly-evaluated workspace-chrome chunk — can import them without
 * pulling the heavy person detail host into the entry graph.
 */

/**
 * Widget slot rendered as the person detail page's Bookings tab
 * (packaged-admin RFC §4.7 cycle resolution): `@voyantjs/bookings-react/ui`
 * depends on this package, so the host cannot import the bookings-owned
 * person-bookings card directly — instead the bookings admin extension
 * contributes a widget targeting this slot and the host mounts the tab
 * whenever a contribution exists. Widgets receive
 * {@link PersonDetailBookingsTabContext} as props.
 */
export const personDetailBookingsTabSlot = "person.details.bookings-tab"

/**
 * Render context handed to widget contributions targeting
 * {@link personDetailBookingsTabSlot}.
 */
export interface PersonDetailBookingsTabContext {
  /** The person whose detail page hosts the tab. */
  personId: string
}
