import type { LinkableDefinition } from "@voyant-travel/core"

export const contractLinkable: LinkableDefinition = {
  module: "legal",
  entity: "contract",
  table: "contracts",
  idPrefix: "cont",
}

export const contractTemplateLinkable: LinkableDefinition = {
  module: "legal",
  entity: "contractTemplate",
  table: "contract_templates",
  idPrefix: "ctpl",
}

export const contractsLinkable = {
  contract: contractLinkable,
  contractTemplate: contractTemplateLinkable,
}
