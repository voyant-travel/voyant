import type { LinkDefinition } from "@voyant-travel/core"

import { contractBookingLink } from "./contract-booking.js"
import { contractInvoiceLink } from "./contract-invoice.js"
import { contractOrganizationLink } from "./contract-organization.js"
import { contractPersonLink } from "./contract-person.js"
import { contractSupplierLink } from "./contract-supplier.js"
import { organizationProductLink } from "./organization-product.js"
import { personProductLink } from "./person-product.js"
import { policyAcceptanceBookingLink } from "./policy-acceptance-booking.js"
import { policyProductLink } from "./policy-product.js"

export {
  contractBookingLink,
  contractInvoiceLink,
  contractOrganizationLink,
  contractPersonLink,
  contractSupplierLink,
  organizationProductLink,
  personProductLink,
  policyAcceptanceBookingLink,
  policyProductLink,
}

/**
 * All cross-module link definitions used by this template. Materialize their
 * pivot tables with `syncLinks(db, links)` from `@voyant-travel/db/links`.
 */
export const links: LinkDefinition[] = [
  personProductLink,
  organizationProductLink,
  contractBookingLink,
  contractInvoiceLink,
  contractPersonLink,
  contractOrganizationLink,
  contractSupplierLink,
  policyProductLink,
  policyAcceptanceBookingLink,
]
