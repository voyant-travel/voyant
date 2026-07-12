import type { LinkableDefinition } from "@voyant-travel/core"

/** A scheduled availability slot exposed to other package schemas. */
export const departureLinkable: LinkableDefinition = {
  module: "availability",
  entity: "departure",
  table: "availability_slots",
  idPrefix: "avsl",
}

export const availabilityLinkable = {
  departure: departureLinkable,
}
