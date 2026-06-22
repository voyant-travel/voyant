import type { LinkDefinition } from "@voyant-travel/core"

import { contractBookingLink } from "./contract-booking.js"
import { contractInvoiceLink } from "./contract-invoice.js"
import { contractOrganizationLink } from "./contract-organization.js"
import { contractPersonLink } from "./contract-person.js"
import { contractSupplierLink } from "./contract-supplier.js"
import { organizationProductLink } from "./organization-product.js"
import { organizationProgramLink } from "./organization-program.js"
import { personProductLink } from "./person-product.js"
import { policyAcceptanceBookingLink } from "./policy-acceptance-booking.js"
import { policyProductLink } from "./policy-product.js"
import { programRoomBlockLink } from "./program-room-block.js"
import { quoteProgramLink } from "./quote-program.js"
import { roomBlockPropertyLink } from "./room-block-property.js"
import { roomBlockSupplierLink } from "./room-block-supplier.js"
import { sessionFunctionSpaceLink } from "./session-function-space.js"

export {
  contractBookingLink,
  contractInvoiceLink,
  contractOrganizationLink,
  contractPersonLink,
  contractSupplierLink,
  organizationProductLink,
  organizationProgramLink,
  personProductLink,
  policyAcceptanceBookingLink,
  policyProductLink,
  programRoomBlockLink,
  quoteProgramLink,
  roomBlockPropertyLink,
  roomBlockSupplierLink,
  sessionFunctionSpaceLink,
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
  programRoomBlockLink,
  roomBlockPropertyLink,
  roomBlockSupplierLink,
  organizationProgramLink,
  quoteProgramLink,
  sessionFunctionSpaceLink,
]
