import { bookingLinkable } from "@voyant-travel/bookings/linkables"
import { defineLink } from "@voyant-travel/core"
import { supplierLinkable } from "@voyant-travel/distribution/suppliers/linkables"
import { invoiceLinkable } from "@voyant-travel/finance/linkables"
import { inventoryProductCompatibilityLinkable as productLinkable } from "@voyant-travel/inventory/linkables"
import {
  organizationLinkable,
  personLinkable,
} from "@voyant-travel/relationships/linkables"

import { contractLinkable, policyAcceptanceLinkable, policyLinkable } from "./linkables.js"

export const contractBookingLink = defineLink(
  { linkable: contractLinkable, isList: true },
  bookingLinkable,
)

export const contractInvoiceLink = defineLink(contractLinkable, {
  linkable: invoiceLinkable,
  isList: true,
})

export const contractOrganizationLink = defineLink(
  { linkable: contractLinkable, isList: true },
  organizationLinkable,
)

export const contractPersonLink = defineLink(
  { linkable: contractLinkable, isList: true },
  personLinkable,
)

export const contractSupplierLink = defineLink(
  { linkable: contractLinkable, isList: true },
  supplierLinkable,
)

export const policyAcceptanceBookingLink = defineLink(
  { linkable: policyAcceptanceLinkable, isList: true },
  bookingLinkable,
)

export const policyProductLink = defineLink(
  { linkable: policyLinkable, isList: true },
  { linkable: productLinkable, isList: true },
)
