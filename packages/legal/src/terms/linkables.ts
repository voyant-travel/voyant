import type { LinkableDefinition } from "@voyant-travel/core"

export const legalTermLinkable: LinkableDefinition = {
  module: "legal",
  entity: "term",
  table: "legal_terms",
  idPrefix: "ortm",
}

export const legalTermsLinkable = {
  term: legalTermLinkable,
}
