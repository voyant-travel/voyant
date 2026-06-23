import type { LinkableDefinition } from "@voyant-travel/core"

/**
 * Properties and facilities exposed as linkable entities so other modules can
 * associate to them via `defineLink` (e.g. a room block -> its property). See
 * RFC voyant#1489.
 */
export const propertyLinkable: LinkableDefinition = {
  module: "operations",
  entity: "property",
  table: "properties",
  idPrefix: "prop",
}

export const facilityLinkable: LinkableDefinition = {
  module: "operations",
  entity: "facility",
  table: "facilities",
  idPrefix: "fac",
}

/** Function spaces (meeting/event sub-spaces) - linkable so a MICE session can target one. */
export const functionSpaceLinkable: LinkableDefinition = {
  module: "operations",
  entity: "functionSpace",
  table: "function_spaces",
  idPrefix: "fnsp",
}

/** Space blocks - held function-space inventory; linkable to a MICE program. */
export const spaceBlockLinkable: LinkableDefinition = {
  module: "operations",
  entity: "spaceBlock",
  table: "space_blocks",
  idPrefix: "spbl",
}

export const placesLinkable = {
  property: propertyLinkable,
  facility: facilityLinkable,
  functionSpace: functionSpaceLinkable,
  spaceBlock: spaceBlockLinkable,
}
