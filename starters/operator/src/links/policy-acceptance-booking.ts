import { bookingLinkable } from "@voyant-travel/bookings"
import { defineLink } from "@voyant-travel/core"
import { policyAcceptanceLinkable } from "@voyant-travel/legal"

/**
 * A booking can have many policy acceptances (one per policy kind accepted
 * at checkout); each acceptance attaches to at most one booking.
 */
export const policyAcceptanceBookingLink = defineLink(
  { linkable: policyAcceptanceLinkable, isList: true },
  bookingLinkable,
)
