import type { LinkableDefinition } from "@voyant-travel/core"

export const bookingLinkable: LinkableDefinition = {
  module: "bookings",
  entity: "booking",
  table: "bookings",
  idPrefix: "book",
}

export const bookingsLinkable = {
  booking: bookingLinkable,
}
