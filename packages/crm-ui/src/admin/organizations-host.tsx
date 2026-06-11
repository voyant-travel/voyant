"use client"

import { useAdminNavigate } from "@voyantjs/admin"

import { OrganizationsPage } from "../components/organizations-page.js"

/**
 * Packaged admin host for the canonical `OrganizationsPage` (packaged-admin
 * RFC Phase 3). Zero-prop: opening an organization resolves through the
 * semantic `organization.detail` destination (RFC §4.7) instead of a host
 * route tree, so route files can mount this component directly.
 */
export function OrganizationsHost() {
  const navigateTo = useAdminNavigate()

  return (
    <OrganizationsPage
      onOrganizationOpen={(organization) =>
        navigateTo("organization.detail", { organizationId: organization.id })
      }
    />
  )
}
