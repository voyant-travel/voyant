import type { LinkableDefinition } from "@voyant-travel/core"

/**
 * Room blocks are the accommodations module's first linkable surface - a
 * standard, package-owned allotment primitive that any deployment can use
 * (the MICE spine merely links to it). See RFC voyant#1489.
 */
export const roomBlockLinkable: LinkableDefinition = {
  module: "accommodations",
  entity: "roomBlock",
  table: "room_blocks",
  idPrefix: "hrbl",
}

export const accommodationsLinkable = {
  roomBlock: roomBlockLinkable,
}
