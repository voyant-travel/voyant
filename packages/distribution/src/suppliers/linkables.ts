import type { LinkableDefinition } from "@voyant-travel/core"

export const supplierLinkable: LinkableDefinition = {
  module: "suppliers",
  entity: "supplier",
  table: "suppliers",
  idPrefix: "supp",
}

export const suppliersLinkable = {
  supplier: supplierLinkable,
}
