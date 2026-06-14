import { defineLink } from "@voyant-travel/core"
import { invoiceLinkable } from "@voyant-travel/finance"
import { contractLinkable } from "@voyant-travel/legal"

/**
 * A contract can be referenced by many invoices (e.g. a retainer contract
 * backs several billing invoices over the engagement).
 */
export const contractInvoiceLink = defineLink(contractLinkable, {
  linkable: invoiceLinkable,
  isList: true,
})
