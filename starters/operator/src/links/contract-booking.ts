import { bookingLinkable } from "@voyant-travel/bookings"
import { defineLink } from "@voyant-travel/core"
import { contractLinkable } from "@voyant-travel/legal"

/**
 * A booking can have many contracts (customer travel contract, supplier
 * addendum, amendment). Each contract attaches to at most one booking.
 */
export const contractBookingLink = defineLink(
  { linkable: contractLinkable, isList: true },
  bookingLinkable,
)
