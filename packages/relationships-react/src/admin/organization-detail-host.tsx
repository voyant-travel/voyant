"use client"

import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyant-travel/admin"
import { OrganizationDetailPage } from "../components/organization-detail-page.js"
import { useOrganization } from "../index.js"

export interface OrganizationDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the canonical `OrganizationDetailPage`
 * (packaged-admin RFC Phase 3). Owns everything package-clean:
 *
 *   - Cross-route links resolve through semantic destinations (RFC §4.7):
 *     `organization.list` (back / after delete), `person.detail` (the
 *     organization's people) — no host route tree import.
 *   - Admin chrome breadcrumbs (`useAdminBreadcrumbs`). The organization
 *     fetch is mirrored here for the breadcrumb label; TanStack Query
 *     dedupes by key, so this doesn't issue a second network request.
 */
export function OrganizationDetailHost({ id }: OrganizationDetailHostProps) {
  const messages = useOperatorAdminMessages().crm.organizationDetail
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const organizationQuery = useOrganization(id)
  const organization = organizationQuery.data

  const organizationsHref = resolveHref("organization.list", {})
  useAdminBreadcrumbs(
    organization
      ? [{ label: messages.breadcrumbRoot, href: organizationsHref }, { label: organization.name }]
      : [{ label: messages.breadcrumbRoot, href: organizationsHref }],
  )

  return (
    <OrganizationDetailPage
      id={id}
      onBack={() => navigateTo("organization.list", {})}
      onPersonOpen={(personId) => navigateTo("person.detail", { personId })}
    />
  )
}
