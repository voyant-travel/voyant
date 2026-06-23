import type { LinkableDefinition } from "@voyant-travel/core"

export const personLinkable: LinkableDefinition = {
  module: "relationships",
  entity: "person",
  table: "people",
  idPrefix: "pers",
}

export const organizationLinkable: LinkableDefinition = {
  module: "relationships",
  entity: "organization",
  table: "organizations",
  idPrefix: "org",
}

export const relationshipsLinkable = {
  person: personLinkable,
  organization: organizationLinkable,
}
