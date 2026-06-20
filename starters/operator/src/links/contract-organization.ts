import { defineLink } from "@voyant-travel/core"
import { contractLinkable } from "@voyant-travel/legal"
import { organizationLinkable } from "@voyant-travel/relationships"

/**
 * An organization can hold many contracts; each contract names at most one
 * organization. Replaces the former hard `contracts.organization_id →
 * organizations.id` cross-package FK (module decoupling: links, not FKs).
 */
export const contractOrganizationLink = defineLink(
  { linkable: contractLinkable, isList: true },
  organizationLinkable,
)
