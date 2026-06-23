import type { LinkableDefinition } from "@voyant-travel/core"

export const quoteLinkable: LinkableDefinition = {
  module: "quotes",
  entity: "quote",
  table: "quotes",
  idPrefix: "quot",
}

export const quoteVersionLinkable: LinkableDefinition = {
  module: "quotes",
  entity: "quoteVersion",
  table: "quote_versions",
  idPrefix: "qver",
}

export const quotesLinkable = {
  quote: quoteLinkable,
  quoteVersion: quoteVersionLinkable,
}
